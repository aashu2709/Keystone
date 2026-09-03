param (
    [Parameter(Mandatory=$true)]
    [string]$action,
    
    [Parameter(Mandatory=$true)]
    [string]$vm_ip,
    
    [Parameter(Mandatory=$true)]
    [string]$admin_user,
    
    [Parameter(Mandatory=$false)]
    [string]$service_name = ""
)

$ErrorActionPreference = "Stop"
$InformationPreference = "SilentlyContinue"
$WarningPreference = "SilentlyContinue"

# Read password from Stdin
$admin_pass_plain = [Console]::In.ReadLine()
if (-not $admin_pass_plain) {
    Write-Output '{"success":false,"message":"Admin password was not provided via stdin."}'
    exit 1
}

$secure_admin_pass = ConvertTo-SecureString $admin_pass_plain -AsPlainText -Force
$credential = New-Object System.Management.Automation.PSCredential ($admin_user, $secure_admin_pass)

# Return standard wrapper
Function Output-Result {
    param([bool]$success, [string]$message, $data = $null)
    
    $obj = @{
        success = $success
        message = $message
    }
    
    if ($null -ne $data) {
        $obj.data = $data
    }
    
    $json = $obj | ConvertTo-Json -Depth 5 -Compress
    Write-Output $json
    exit 0
}

try {
    # Test connection
    $wsmanTest = Test-WSMan -ComputerName $vm_ip -ErrorAction SilentlyContinue
    if (-not $wsmanTest) {
        Output-Result -success $false -message "Failed to connect to VM $vm_ip via WinRM."
    }
} catch {
    Output-Result -success $false -message "Failed to connect to VM $vm_ip via WinRM: $_"
}

try {
    $scriptBlock = {
        param([string]$Action, [string]$ServiceName)
        
        try {
            if ($Action -eq "list") {
                # Get all services and format
                $services = Get-Service | Select-Object Name, DisplayName, Status, StartType, Description
                
                $resultList = @()
                foreach ($svc in $services) {
                    $resultList += @{
                        Name = $svc.Name
                        DisplayName = $svc.DisplayName
                        Status = $svc.Status.ToString()
                        StartType = $svc.StartType.ToString()
                        Description = [string]$svc.Description
                    }
                }
                return @{ success = $true; message = "Services listed"; data = $resultList }
            }
            elseif ($Action -eq "start") {
                if ([string]::IsNullOrEmpty($ServiceName)) {
                    throw "ServiceName is required for Start action."
                }
                Start-Service -Name $ServiceName -ErrorAction Stop
                
                # Check status
                $status = (Get-Service -Name $ServiceName).Status.ToString()
                return @{ success = $true; message = "Service '$ServiceName' started successfully."; data = @{ Name = $ServiceName; Status = $status } }
            }
            elseif ($Action -eq "stop") {
                if ([string]::IsNullOrEmpty($ServiceName)) {
                    throw "ServiceName is required for Stop action."
                }
                Stop-Service -Name $ServiceName -Force -ErrorAction Stop
                
                # Check status
                $status = (Get-Service -Name $ServiceName).Status.ToString()
                return @{ success = $true; message = "Service '$ServiceName' stopped successfully."; data = @{ Name = $ServiceName; Status = $status } }
            }
            elseif ($Action -eq "restart") {
                if ([string]::IsNullOrEmpty($ServiceName)) {
                    throw "ServiceName is required for Restart action."
                }
                Restart-Service -Name $ServiceName -Force -ErrorAction Stop
                
                # Check status
                $status = (Get-Service -Name $ServiceName).Status.ToString()
                return @{ success = $true; message = "Service '$ServiceName' restarted successfully."; data = @{ Name = $ServiceName; Status = $status } }
            }
            else {
                throw "Unknown action: $Action"
            }
        }
        catch {
            return @{ success = $false; message = "Remote execution failed: $_" }
        }
    }
    
    $invokeResult = $null
    try {
        $invokeResult = Invoke-Command -ComputerName $vm_ip -Credential $credential -ScriptBlock $scriptBlock -ArgumentList $action, $service_name -ErrorAction Stop
    } catch {
        $invokeResult = Invoke-Command -ComputerName $vm_ip -Credential $credential -Authentication Basic -ScriptBlock $scriptBlock -ArgumentList $action, $service_name -ErrorAction Stop
    }
    
    if ($invokeResult.success) {
        Output-Result -success $true -message $invokeResult.message -data $invokeResult.data
    } else {
        Output-Result -success $false -message $invokeResult.message
    }
    
} catch {
    Output-Result -success $false -message "Failed to execute service management: $_"
}
