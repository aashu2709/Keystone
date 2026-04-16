param (
    [Parameter(Mandatory=$true)]
    [ValidateSet("list", "add", "delete", "toggle", "update")]
    [string]$action,

    [Parameter(Mandatory=$true)]
    [ValidatePattern('^(\d{1,3}\.){3}\d{1,3}$')]
    [string]$vm_ip,

    [Parameter(Mandatory=$true)]
    [string]$admin_user,

    [Parameter(Mandatory=$false)]
    [string]$rule_name = "",

    [Parameter(Mandatory=$false)]
    [string]$rule_description = "",

    [Parameter(Mandatory=$false)]
    [string]$direction = "Inbound",

    [Parameter(Mandatory=$false)]
    [string]$rule_action = "Allow",

    [Parameter(Mandatory=$false)]
    [string]$profile = "Any",

    [Parameter(Mandatory=$false)]
    [string]$protocol = "Any",

    [Parameter(Mandatory=$false)]
    [string]$local_port = "Any",

    [Parameter(Mandatory=$false)]
    [string]$remote_port = "Any",

    [Parameter(Mandatory=$false)]
    [string]$local_address = "Any",

    [Parameter(Mandatory=$false)]
    [string]$remote_address = "Any",

    [Parameter(Mandatory=$false)]
    [string]$program_path = "Any",

    [Parameter(Mandatory=$false)]
    [string]$service_name = "Any",

    [Parameter(Mandatory=$false)]
    [string]$icmp_type = "Any",

    [Parameter(Mandatory=$false)]
    [string]$icmp_code = "Any",

    [Parameter(Mandatory=$false)]
    [string]$authentication = "NotRequired",

    [Parameter(Mandatory=$false)]
    [string]$encryption = "NotRequired",
    
    [Parameter(Mandatory=$false)]
    [string]$predefined_group = "",

    [Parameter(Mandatory=$false)]
    [string]$enabled = "True",

    [Parameter(Mandatory=$false)]
    [string]$edge_traversal = "Block",

    [Parameter(Mandatory=$false)]
    [string]$interface_types = "Any"
)

# ============================================
# LOGGING & OUTPUT
# ============================================
$log_dir = "logs"
if (!(Test-Path $log_dir)) { New-Item -ItemType Directory -Path $log_dir -Force | Out-Null }
$ps_log_file = Join-Path $log_dir "manage_firewall.log"

function Write-Log {
    param([string]$Level, [string]$Message)
    $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    Add-Content -Path $ps_log_file -Value "$timestamp - [$Level] - $Message"
}

function Write-JsonResult {
    param([bool]$Success, [string]$Message, [object]$Data = $null)
    $result = @{ success = $Success; message = $Message }
    if ($Data) { $result.data = $Data }
    Write-Output ($result | ConvertTo-Json -Depth 5 -Compress)
}

# ============================================
# MAIN EXECUTION
# ============================================
try {
    Write-Log -Level "INFO" -Message "=== Starting manage_firewall: action=$action, vm=$vm_ip ==="

    $admin_pass_plain = [Console]::In.ReadLine()
    if (-not $admin_pass_plain) {
        Write-JsonResult -Success $false -Message "Admin password was not provided via stdin."
        exit 1
    }

    $secure_admin_pass = ConvertTo-SecureString $admin_pass_plain -AsPlainText -Force
    $cred = New-Object System.Management.Automation.PSCredential($admin_user, $secure_admin_pass)

    Write-Log -Level "DEBUG" -Message "Testing WinRM connectivity to $vm_ip..."
    $wsmanTest = Test-WSMan -ComputerName $vm_ip -ErrorAction SilentlyContinue
    if (-not $wsmanTest) {
        Write-JsonResult -Success $false -Message "WinRM not reachable on $vm_ip."
        exit 1
    }

    # ============================================
    # ACTION: LIST
    # ============================================
    if ($action -eq "list") {
        # We will retrieve all rules and all filters in one go to prevent slow N+1 querying.
        $rulesData = Invoke-Command -ComputerName $vm_ip -Credential $cred -Authentication Basic -ScriptBlock {
            $ports = Get-NetFirewallPortFilter
            $addrs = Get-NetFirewallAddressFilter
            $apps = Get-NetFirewallApplicationFilter

            $portMap = @{}
            foreach ($p in $ports) { $portMap[$p.InstanceID] = $p }

            $addrMap = @{}
            foreach ($a in $addrs) { $addrMap[$a.InstanceID] = $a }

            $appMap = @{}
            foreach ($ap in $apps) { $appMap[$ap.InstanceID] = $ap }

            # Also fetch interface type filters
            $intfs = Get-NetFirewallInterfaceTypeFilter
            $intfMap = @{}
            foreach ($itf in $intfs) { $intfMap[$itf.InstanceID] = $itf }

            $rules = Get-NetFirewallRule | ForEach-Object {
                $pf = $portMap[$_.Name]
                $af = $addrMap[$_.Name]
                $apf = $appMap[$_.Name]
                $itf = $intfMap[$_.Name]

                [PSCustomObject]@{
                    Name = $_.Name
                    DisplayName = $_.DisplayName
                    Description = $_.Description
                    Enabled = $_.Enabled.ToString()
                    Direction = $_.Direction.ToString()
                    Action = $_.Action.ToString()
                    Profile = $_.Profile.ToString()
                    EdgeTraversalPolicy = $_.EdgeTraversalPolicy.ToString()
                    Protocol = if ($pf -and $pf.Protocol) { $pf.Protocol.ToString() } else { "Any" }
                    LocalPort = if ($pf -and $pf.LocalPort) { ($pf.LocalPort -join ',') } else { "Any" }
                    RemotePort = if ($pf -and $pf.RemotePort) { ($pf.RemotePort -join ',') } else { "Any" }
                    LocalAddress = if ($af -and $af.LocalAddress) { ($af.LocalAddress -join ',') } else { "Any" }
                    RemoteAddress = if ($af -and $af.RemoteAddress) { ($af.RemoteAddress -join ',') } else { "Any" }
                    Program = if ($apf -and $apf.Program) { $apf.Program } else { "Any" }
                    InterfaceType = if ($itf -and $itf.InterfaceType) { $itf.InterfaceType.ToString() } else { "Any" }
                    IcmpType = if ($pf -and $pf.IcmpType) { $pf.IcmpType.ToString() } else { "Any" }
                    IcmpCode = if ($pf -and $pf.IcmpCode) { $pf.IcmpCode.ToString() } else { "Any" }
                }
            }
            return @{ rules = @($rules) }
        }

        Write-JsonResult -Success $true -Message "Found $($rulesData.rules.Count) rules" -Data @{ rules = $rulesData.rules }
        exit 0
    }

    # All non-list/non-enable-group actions required a rule_name
    if ($action -ne "list" -and $action -ne "enable-group" -and -not $rule_name) {
        Write-JsonResult -Success $false -Message "rule_name is required for action $action"
        exit 1
    }

    # ============================================
    # ACTION: ENABLE-GROUP
    # ============================================
    if ($action -eq "enable-group") {
        if (-not $predefined_group) {
            Write-JsonResult -Success $false -Message "predefined_group is required for action enable-group"
            exit 1
        }
        $result = Invoke-Command -ComputerName $vm_ip -Credential $cred -Authentication Basic -ScriptBlock {
            param($groupName)
            try {
                Enable-NetFirewallRule -Group $groupName -ErrorAction Stop
                return @{ success = $true; message = "Firewall group '$groupName' enabled." }
            } catch {
                return @{ success = $false; message = "Failed to enable group: $($_.Exception.Message)" }
            }
        } -ArgumentList $predefined_group

        Write-JsonResult -Success $result.success -Message $result.message
        exit 0
    }

    # ============================================
    # ACTION: ADD
    # ============================================
    if ($action -eq "add") {
        $result = Invoke-Command -ComputerName $vm_ip -Credential $cred -Authentication Basic -ScriptBlock {
            param($rName, $rDesc, $rDir, $rAct, $rProf, $rProt, $rLPort, $rRPort, $rLAddr, $rRAddr, $rProg, $rService, $rEnabled, $icmpType, $icmpCode, $auth, $enc, $rEdge, $rIntf)
            
            # Check if exists
            $existing = Get-NetFirewallRule -DisplayName $rName -ErrorAction SilentlyContinue
            if ($existing) {
                return @{ success = $false; message = "Rule with name '$rName' already exists." }
            }

            try {
                $params = @{
                    DisplayName = $rName
                    Direction = $rDir
                    Action = $rAct
                    Enabled = $rEnabled
                }

                if ($rDesc) { $params.Description = $rDesc }
                if ($rProf -ne "Any") { $params.Profile = $rProf }
                if ($rProt -ne "Any") { $params.Protocol = $rProt }
                if ($rLPort -and $rLPort.Trim() -ne "Any" -and $rLPort.Trim() -ne "") { 
                    $params.LocalPort = $rLPort.Split(",") | ForEach-Object { $_.Trim() }
                    if ($rProt -eq "Any") { $params.Protocol = "TCP" }
                }
                if ($rRPort -and $rRPort.Trim() -ne "Any" -and $rRPort.Trim() -ne "") { 
                    $params.RemotePort = $rRPort.Split(",") | ForEach-Object { $_.Trim() }
                    if ($rProt -eq "Any") { $params.Protocol = "TCP" }
                }
                if ($rLAddr -ne "Any") { $params.LocalAddress = $rLAddr }
                if ($rRAddr -ne "Any") { $params.RemoteAddress = $rRAddr }
                if ($rProg -ne "Any") { $params.Program = $rProg }
                if ($rService -ne "Any") { $params.Service = $rService }
                
                # ICMP Settings
                if ($rProt -match "ICMP" -or $rProt -eq "1" -or $rProt -eq "58") {
                    if ($icmpType -ne "Any") { $params.IcmpType = $icmpType }
                    if ($icmpCode -ne "Any") { $params.IcmpCode = $icmpCode }
                }

                # IPsec / Authentication
                if ($auth -ne "NotRequired") { $params.Authentication = $auth }
                if ($enc -ne "NotRequired") { $params.Encryption = $enc }

                # Edge Traversal Policy
                if ($rEdge -and $rEdge -ne "Block") {
                    $params.EdgeTraversalPolicy = $rEdge
                }

                $newRule = New-NetFirewallRule @params -ErrorAction Stop

                # Interface Type (must be set after creation via filter)
                if ($rIntf -and $rIntf -ne "Any") {
                    $newRule | Get-NetFirewallInterfaceTypeFilter | Set-NetFirewallInterfaceTypeFilter -InterfaceType $rIntf -ErrorAction Stop
                }

                return @{ success = $true; message = "Firewall rule '$rName' created." }
            } catch {
                return @{ success = $false; message = "Failed to create rule: $($_.Exception.Message)" }
            }
        } -ArgumentList $rule_name, $rule_description, $direction, $rule_action, $profile, $protocol, $local_port, $remote_port, $local_address, $remote_address, $program_path, $service_name, $enabled, $icmp_type, $icmp_code, $authentication, $encryption, $edge_traversal, $interface_types

        Write-JsonResult -Success $result.success -Message $result.message
        exit 0
    }

    # ============================================
    # ACTION: TOGGLE
    # ============================================
    if ($action -eq "toggle") {
        $result = Invoke-Command -ComputerName $vm_ip -Credential $cred -Authentication Basic -ScriptBlock {
            param($rName)
            try {
                $rule = Get-NetFirewallRule -DisplayName $rName -ErrorAction Stop
                if ($rule.Enabled -eq "True") {
                    Disable-NetFirewallRule -DisplayName $rName -ErrorAction Stop
                    return @{ success = $true; message = "Rule '$rName' disabled." }
                } else {
                    Enable-NetFirewallRule -DisplayName $rName -ErrorAction Stop
                    return @{ success = $true; message = "Rule '$rName' enabled." }
                }
            } catch {
                return @{ success = $false; message = "Failed to toggle rule: $($_.Exception.Message)" }
            }
        } -ArgumentList $rule_name

        Write-JsonResult -Success $result.success -Message $result.message
        exit 0
    }

    # ============================================
    # ACTION: DELETE
    # ============================================
    if ($action -eq "delete") {
        $result = Invoke-Command -ComputerName $vm_ip -Credential $cred -Authentication Basic -ScriptBlock {
            param($rName)
            try {
                Remove-NetFirewallRule -DisplayName $rName -ErrorAction Stop
                return @{ success = $true; message = "Rule '$rName' deleted." }
            } catch {
                return @{ success = $false; message = "Failed to delete rule: $($_.Exception.Message)" }
            }
        } -ArgumentList $rule_name

        Write-JsonResult -Success $result.success -Message $result.message
        exit 0
    }

    # ============================================
    # ACTION: UPDATE
    # ============================================
    if ($action -eq "update") {
        $result = Invoke-Command -ComputerName $vm_ip -Credential $cred -Authentication Basic -ScriptBlock {
            param($rName, $rDesc, $rDir, $rAct, $rProf, $rProt, $rLPort, $rRPort, $rLAddr, $rRAddr, $rProg, $rService, $rEnabled, $icmpType, $icmpCode, $auth, $enc, $rEdge, $rIntf)
            
            try {
                $rule = Get-NetFirewallRule -DisplayName $rName -ErrorAction Stop
                
                $params = @{
                    DisplayName = $rName
                    Direction = $rDir
                    Action = $rAct
                    Enabled = $rEnabled
                }

                if ($rDesc) { $params.Description = $rDesc }
                if ($rProf) { $params.Profile = if ($rProf -eq "Any") { "Any" } else { $rProf } }
                if ($rProt) { $params.Protocol = if ($rProt -eq "Any") { "Any" } else { $rProt } }
                
                if ($rLPort) {
                    if ($rLPort.Trim() -ne "Any" -and $rLPort.Trim() -ne "") {
                        $params.LocalPort = $rLPort.Split(",") | ForEach-Object { $_.Trim() }
                        if ($rProt -eq "Any" -or $null -eq $rProt) { $params.Protocol = "TCP" }
                    } else {
                        $params.LocalPort = "Any"
                    }
                }
                
                if ($rRPort) {
                    if ($rRPort.Trim() -ne "Any" -and $rRPort.Trim() -ne "") {
                        $params.RemotePort = $rRPort.Split(",") | ForEach-Object { $_.Trim() }
                        if ($rProt -eq "Any" -or $null -eq $rProt) { $params.Protocol = "TCP" }
                    } else {
                        $params.RemotePort = "Any"
                    }
                }

                if ($rLAddr) { $params.LocalAddress = $rLAddr }
                if ($rRAddr) { $params.RemoteAddress = $rRAddr }
                if ($rProg) { $params.Program = $rProg }
                if ($rService) { $params.Service = $rService }

                # ICMP Settings
                if ($rProt -match "ICMP" -or $rProt -eq "1" -or $rProt -eq "58") {
                    if ($icmpType -ne "Any") { $params.IcmpType = $icmpType }
                    if ($icmpCode -ne "Any") { $params.IcmpCode = $icmpCode }
                }

                # IPsec / Authentication
                if ($auth) { $params.Authentication = $auth }
                if ($enc) { $params.Encryption = $enc }

                # Edge Traversal Policy
                if ($rEdge) { $params.EdgeTraversalPolicy = $rEdge }

                # Apply main updates
                Set-NetFirewallRule -InputObject $rule @params -ErrorAction Stop

                # Interface Type (secondary filter)
                if ($rIntf) {
                    $rule | Get-NetFirewallInterfaceTypeFilter | Set-NetFirewallInterfaceTypeFilter -InterfaceType $rIntf -ErrorAction Stop
                }

                return @{ success = $true; message = "Firewall rule '$rName' updated." }
            } catch {
                return @{ success = $false; message = "Failed to update rule: $($_.Exception.Message)" }
            }
        } -ArgumentList $rule_name, $rule_description, $direction, $rule_action, $profile, $protocol, $local_port, $remote_port, $local_address, $remote_address, $program_path, $service_name, $enabled, $icmp_type, $icmp_code, $authentication, $encryption, $edge_traversal, $interface_types

        Write-JsonResult -Success $result.success -Message $result.message
        exit 0
    }
} catch {
    $errorMsg = $_.Exception.Message
    Write-Log -Level "ERROR" -Message "Unhandled error: $errorMsg"
    if ($errorMsg -match "Access is denied") { $errorMsg = "Access denied. Check admin credentials." }
    elseif ($errorMsg -match "WinRM") { $errorMsg = "WinRM connection failed." }
    Write-JsonResult -Success $false -Message $errorMsg
    exit 1
}
