param (
    [Parameter(Mandatory=$true)]
    [ValidateSet("create", "disable", "enable", "unlock", "delete", "list", "reset-password")]
    [string]$action,

    [Parameter(Mandatory=$true)]
    [ValidatePattern('^(\d{1,3}\.){3}\d{1,3}$')]
    [string]$vm_ip,

    [Parameter(Mandatory=$true)]
    [string]$admin_user,

    [Parameter(Mandatory=$false)]
    [string]$target_user = "",

    [Parameter(Mandatory=$false)]
    [string]$target_password = "",

    [Parameter(Mandatory=$false)]
    [string]$full_name = "",

    [Parameter(Mandatory=$false)]
    [string]$description = "",

    [Parameter(Mandatory=$false)]
    [ValidateSet("standard", "administrator")]
    [string]$user_type = "standard",

    [Parameter(Mandatory=$false)]
    [ValidateSet("true", "false")]
    [string]$must_change_password = "false",

    [Parameter(Mandatory=$false)]
    [ValidateSet("true", "false")]
    [string]$enable_rdp = "true"
)

# ============================================
# LOGGING
# ============================================
$log_dir = "logs"
if (!(Test-Path $log_dir)) { New-Item -ItemType Directory -Path $log_dir -Force | Out-Null }
$ps_log_file = Join-Path $log_dir "manage_user.log"

function Write-Log {
    param(
        [string]$Level,
        [string]$Message
    )
    $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    $log_entry = "$timestamp - [$Level] - $Message"
    Add-Content -Path $ps_log_file -Value $log_entry
}

# ============================================
# JSON OUTPUT HELPER
# ============================================
function Write-JsonResult {
    param(
        [bool]$Success,
        [string]$Message,
        [object]$Data = $null
    )
    $result = @{
        success = $Success
        message = $Message
    }
    if ($Data) {
        $result.data = $Data
    }
    $json = $result | ConvertTo-Json -Depth 5 -Compress
    Write-Output $json
}

# ============================================
# MAIN EXECUTION
# ============================================
try {
    Write-Log -Level "INFO" -Message "=== Starting manage_user: action=$action, vm=$vm_ip, target=$target_user ==="

    # 1. Read admin password from stdin
    $admin_pass_plain = [Console]::In.ReadLine()
    if (-not $admin_pass_plain) {
        Write-JsonResult -Success $false -Message "Admin password was not provided via stdin."
        exit 1
    }

    # 2. Create credential for WinRM
    $secure_admin_pass = ConvertTo-SecureString $admin_pass_plain -AsPlainText -Force
    $cred = New-Object System.Management.Automation.PSCredential($admin_user, $secure_admin_pass)

    # 3. Test WinRM connectivity
    Write-Log -Level "DEBUG" -Message "Testing WinRM connectivity to $vm_ip..."
    $wsmanTest = Test-WSMan -ComputerName $vm_ip -ErrorAction SilentlyContinue
    if (-not $wsmanTest) {
        Write-JsonResult -Success $false -Message "WinRM not reachable on $vm_ip. Check if the VM is running and WinRM is configured."
        exit 1
    }
    Write-Log -Level "DEBUG" -Message "WinRM is reachable on $vm_ip"

function Invoke-WinRMSmart {
    param(
        [string]$ComputerName,
        [PSCredential]$Credential,
        [scriptblock]$ScriptBlock,
        [array]$ArgumentList = @(),
        [string]$ErrorAction = "Stop"
    )
    try {
        if ($ArgumentList.Count -gt 0) {
            return Invoke-Command -ComputerName $ComputerName -Credential $Credential -ScriptBlock $ScriptBlock -ArgumentList $ArgumentList -ErrorAction $ErrorAction
        } else {
            return Invoke-Command -ComputerName $ComputerName -Credential $Credential -ScriptBlock $ScriptBlock -ErrorAction $ErrorAction
        }
    } catch {
        if ($ArgumentList.Count -gt 0) {
            return Invoke-Command -ComputerName $ComputerName -Credential $Credential -Authentication Basic -ScriptBlock $ScriptBlock -ArgumentList $ArgumentList -ErrorAction $ErrorAction
        } else {
            return Invoke-Command -ComputerName $ComputerName -Credential $Credential -Authentication Basic -ScriptBlock $ScriptBlock -ErrorAction $ErrorAction
        }
    }
}

    # ============================================
    # ACTION: LIST USERS
    # ============================================
    if ($action -eq "list") {
        Write-Log -Level "INFO" -Message "Listing local users on $vm_ip"

        $usersData = Invoke-WinRMSmart -ComputerName $vm_ip -Credential $cred -ErrorAction Stop -ScriptBlock {
            $users = Get-LocalUser | ForEach-Object {
                @{
                    name             = $_.Name
                    full_name        = $_.FullName
                    enabled          = $_.Enabled
                    description      = $_.Description
                    last_logon       = if ($_.LastLogon) { $_.LastLogon.ToString("yyyy-MM-ddTHH:mm:ss") } else { $null }
                    password_last_set = if ($_.PasswordLastSet) { $_.PasswordLastSet.ToString("yyyy-MM-ddTHH:mm:ss") } else { $null }
                    password_changeable = $_.PasswordChangeableDate
                    user_may_change_password = $_.UserMayChangePassword
                    password_required = $_.PasswordRequired
                    account_source   = $_.PrincipalSource.ToString()
                }
            }
            # Get lock status separately (Get-LocalUser doesn't expose it directly)
            $lockInfo = @{}
            foreach ($u in Get-LocalUser) {
                try {
                    $netUser = net user $u.Name 2>$null
                    $lockedLine = $netUser | Where-Object { $_ -match "Account active" }
                    $lockLine = $netUser | Where-Object { $_ -match "Account locked" }
                    $locked = $false
                    if ($lockLine -match "Yes") { $locked = $true }
                    $lockInfo[$u.Name] = $locked
                } catch {
                    $lockInfo[$u.Name] = $false
                }
            }
            return @{
                users = $users
                lock_info = $lockInfo
            }
        }

        # Merge lock info into users
        $usersList = @()
        foreach ($u in $usersData.users) {
            $u.locked_out = if ($usersData.lock_info[$u.name]) { $true } else { $false }
            $usersList += $u
        }

        Write-Log -Level "INFO" -Message "Found $($usersList.Count) users on $vm_ip"
        Write-JsonResult -Success $true -Message "Found $($usersList.Count) users" -Data @{ users = $usersList }
        exit 0
    }

    # ============================================
    # VALIDATION: target_user required for non-list actions
    # ============================================
    if (-not $target_user) {
        Write-JsonResult -Success $false -Message "target_user is required for action '$action'"
        exit 1
    }

    # ============================================
    # ACTION: CREATE USER
    # ============================================
    if ($action -eq "create") {
        Write-Log -Level "INFO" -Message "Creating user '$target_user' on $vm_ip"

        if (-not $target_password) {
            Write-JsonResult -Success $false -Message "Password is required for creating a user."
            exit 1
        }

        $createResult = Invoke-WinRMSmart -ComputerName $vm_ip -Credential $cred -ErrorAction Stop -ScriptBlock {
            param($username, $password, $fullname, $desc, $usertype, $mustchange, $enablerdp)

            # Check if user already exists
            $existing = Get-LocalUser -Name $username -ErrorAction SilentlyContinue
            if ($existing) {
                return @{ success = $false; message = "User '$username' already exists on this server." }
            }

            try {
                # Create the user
                $securePass = ConvertTo-SecureString $password -AsPlainText -Force
                $params = @{
                    Name        = $username
                    Password    = $securePass
                    FullName    = $fullname
                    Description = $desc
                    PasswordNeverExpires = $false
                    UserMayNotChangePassword = $false
                    AccountNeverExpires = $true
                }
                New-LocalUser @params -ErrorAction Stop | Out-Null

                # Add to appropriate group
                if ($usertype -eq "administrator") {
                    Add-LocalGroupMember -Group "Administrators" -Member $username -ErrorAction Stop
                } else {
                    # Add to Users group (standard)
                    Add-LocalGroupMember -Group "Users" -Member $username -ErrorAction SilentlyContinue
                    
                    # Conditionally add to Remote Desktop Users
                    if ($enablerdp -eq "true") {
                        Write-Output "Adding user $username to Remote Desktop Users group..."
                        Add-LocalGroupMember -Group "Remote Desktop Users" -Member $username -ErrorAction SilentlyContinue
                    } else {
                        Write-Output "Skipping Remote Desktop Users group for $username."
                    }
                }

                # Force password change at next logon if requested
                if ($mustchange -eq "true") {
                    net user $username /logonpasswordchg:yes 2>&1 | Out-Null
                }

                return @{ success = $true; message = "User '$username' created successfully." }
            }
            catch {
                return @{ success = $false; message = "Failed to create user: $($_.Exception.Message)" }
            }
        } -ArgumentList $target_user, $target_password, $full_name, $description, $user_type, $must_change_password, $enable_rdp

        if ($createResult.success) {
            Write-Log -Level "INFO" -Message "User '$target_user' created successfully on $vm_ip"
            Write-JsonResult -Success $true -Message $createResult.message
        } else {
            Write-Log -Level "ERROR" -Message "Failed to create user '$target_user' on ${vm_ip}: $($createResult.message)"
            Write-JsonResult -Success $false -Message $createResult.message
            exit 1
        }
        exit 0
    }

    # ============================================
    # ACTION: DISABLE USER
    # ============================================
    if ($action -eq "disable") {
        Write-Log -Level "INFO" -Message "Disabling user '$target_user' on $vm_ip"

        $result = Invoke-WinRMSmart -ComputerName $vm_ip -Credential $cred -ErrorAction Stop -ScriptBlock {
            param($username)
            try {
                $user = Get-LocalUser -Name $username -ErrorAction Stop
                if (-not $user.Enabled) {
                    return @{ success = $true; message = "User '$username' is already disabled." }
                }
                Disable-LocalUser -Name $username -ErrorAction Stop
                return @{ success = $true; message = "User '$username' has been disabled." }
            }
            catch [Microsoft.PowerShell.Commands.UserNotFoundException] {
                return @{ success = $false; message = "User '$username' does not exist on this server." }
            }
            catch {
                return @{ success = $false; message = "Failed to disable user: $($_.Exception.Message)" }
            }
        } -ArgumentList $target_user

        if ($result.success) {
            Write-Log -Level "INFO" -Message $result.message
            Write-JsonResult -Success $true -Message $result.message
        } else {
            Write-Log -Level "ERROR" -Message $result.message
            Write-JsonResult -Success $false -Message $result.message
            exit 1
        }
        exit 0
    }

    # ============================================
    # ACTION: ENABLE USER
    # ============================================
    if ($action -eq "enable") {
        Write-Log -Level "INFO" -Message "Enabling user '$target_user' on $vm_ip"

        $result = Invoke-WinRMSmart -ComputerName $vm_ip -Credential $cred -ErrorAction Stop -ScriptBlock {
            param($username)
            try {
                $user = Get-LocalUser -Name $username -ErrorAction Stop
                if ($user.Enabled) {
                    return @{ success = $true; message = "User '$username' is already enabled." }
                }
                Enable-LocalUser -Name $username -ErrorAction Stop
                return @{ success = $true; message = "User '$username' has been enabled." }
            }
            catch [Microsoft.PowerShell.Commands.UserNotFoundException] {
                return @{ success = $false; message = "User '$username' does not exist on this server." }
            }
            catch {
                return @{ success = $false; message = "Failed to enable user: $($_.Exception.Message)" }
            }
        } -ArgumentList $target_user

        if ($result.success) {
            Write-Log -Level "INFO" -Message $result.message
            Write-JsonResult -Success $true -Message $result.message
        } else {
            Write-Log -Level "ERROR" -Message $result.message
            Write-JsonResult -Success $false -Message $result.message
            exit 1
        }
        exit 0
    }

    # ============================================
    # ACTION: UNLOCK USER
    # ============================================
    if ($action -eq "unlock") {
        Write-Log -Level "INFO" -Message "Unlocking user '$target_user' on $vm_ip"

        $result = Invoke-WinRMSmart -ComputerName $vm_ip -Credential $cred -ErrorAction Stop -ScriptBlock {
            param($username)
            try {
                $user = Get-LocalUser -Name $username -ErrorAction Stop
                # Use net user to unlock - most reliable method
                $netResult = net user $username /active:yes 2>&1
                if ($LASTEXITCODE -eq 0) {
                    return @{ success = $true; message = "User '$username' has been unlocked." }
                } else {
                    return @{ success = $false; message = "Failed to unlock: $netResult" }
                }
            }
            catch [Microsoft.PowerShell.Commands.UserNotFoundException] {
                return @{ success = $false; message = "User '$username' does not exist on this server." }
            }
            catch {
                return @{ success = $false; message = "Failed to unlock user: $($_.Exception.Message)" }
            }
        } -ArgumentList $target_user

        if ($result.success) {
            Write-Log -Level "INFO" -Message $result.message
            Write-JsonResult -Success $true -Message $result.message
        } else {
            Write-Log -Level "ERROR" -Message $result.message
            Write-JsonResult -Success $false -Message $result.message
            exit 1
        }
        exit 0
    }

    # ============================================
    # ACTION: DELETE USER
    # ============================================
    if ($action -eq "delete") {
        Write-Log -Level "INFO" -Message "Deleting user '$target_user' on $vm_ip"

        $result = Invoke-WinRMSmart -ComputerName $vm_ip -Credential $cred -ErrorAction Stop -ScriptBlock {
            param($username)
            try {
                # Safety check: prevent deleting built-in accounts
                $builtInAccounts = @("Administrator", "DefaultAccount", "Guest", "WDAGUtilityAccount")
                if ($builtInAccounts -contains $username) {
                    return @{ success = $false; message = "Cannot delete built-in account '$username'." }
                }

                $user = Get-LocalUser -Name $username -ErrorAction Stop
                Remove-LocalUser -Name $username -ErrorAction Stop
                return @{ success = $true; message = "User '$username' has been deleted." }
            }
            catch [Microsoft.PowerShell.Commands.UserNotFoundException] {
                return @{ success = $false; message = "User '$username' does not exist on this server." }
            }
            catch {
                return @{ success = $false; message = "Failed to delete user: $($_.Exception.Message)" }
            }
        } -ArgumentList $target_user

        if ($result.success) {
            Write-Log -Level "INFO" -Message $result.message
            Write-JsonResult -Success $true -Message $result.message
        } else {
            Write-Log -Level "ERROR" -Message $result.message
            Write-JsonResult -Success $false -Message $result.message
            exit 1
        }
        exit 0
    }

    # ============================================
    # ACTION: RESET PASSWORD
    # ============================================
    if ($action -eq "reset-password") {
        Write-Log -Level "INFO" -Message "Resetting password for user '$target_user' on $vm_ip"

        if (-not $target_password) {
            Write-JsonResult -Success $false -Message "New password is required for reset."
            exit 1
        }

        $result = Invoke-WinRMSmart -ComputerName $vm_ip -Credential $cred -ErrorAction Stop -ScriptBlock {
            param($username, $password)
            try {
                $user = Get-LocalUser -Name $username -ErrorAction Stop
                $securePass = ConvertTo-SecureString $password -AsPlainText -Force
                
                # Perform reset
                Set-LocalUser -Name $username -Password $securePass -ErrorAction Stop
                
                return @{ success = $true; message = "Password for user '$username' has been reset successfully." }
            }
            catch [Microsoft.PowerShell.Commands.UserNotFoundException] {
                return @{ success = $false; message = "User '$username' does not exist on this server." }
            }
            catch {
                return @{ success = $false; message = "Failed to reset password: $($_.Exception.Message)" }
            }
        } -ArgumentList $target_user, $target_password

        if ($result.success) {
            Write-Log -Level "INFO" -Message $result.message
            Write-JsonResult -Success $true -Message $result.message
        } else {
            Write-Log -Level "ERROR" -Message $result.message
            Write-JsonResult -Success $false -Message $result.message
            exit 1
        }
        exit 0
    }
}
catch {
    $errorMsg = $_.Exception.Message
    Write-Log -Level "ERROR" -Message "Unhandled error: $errorMsg"
    
    # Translate common errors
    if ($errorMsg -match "Access is denied") {
        $errorMsg = "Access denied. Check admin credentials."
    }
    elseif ($errorMsg -match "network path was not found") {
        $errorMsg = "VM is unreachable. Check network connection."
    }
    elseif ($errorMsg -match "WinRM") {
        $errorMsg = "WinRM connection failed. Check if WinRM is configured on the VM."
    }

    Write-JsonResult -Success $false -Message $errorMsg
    exit 1
}
