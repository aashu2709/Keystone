param (
    [Parameter(Mandatory=$true)][string]$target_user
)

# Enable strict error handling
$ErrorActionPreference = "Stop"

try {
    # 1. Read Admin Password from Stdin
    $admin_pass_plain = [Console]::In.ReadLine()
    if (-not $admin_pass_plain) { throw "Admin password input is empty" }
    
    # 2. Get VM IP and Admin User from Environment (Passed by Python)
    $vm_ip = $env:VM_IP
    $admin_user = $env:ADMIN_USER
    
    if (-not $vm_ip) { throw "Environment variable VM_IP is missing" }
    if (-not $admin_user) { throw "Environment variable ADMIN_USER is missing" }

    # 3. Create Credential
    $secpasswd = ConvertTo-SecureString $admin_pass_plain -AsPlainText -Force
    $cred = New-Object System.Management.Automation.PSCredential ($admin_user, $secpasswd)

    # 4. Connect to Remote VM with smart fallback (Negotiate -> Basic)
    $sessionOpt = New-PSSessionOption -SkipCACheck -SkipCNCheck
    $session = $null
    try {
        $session = New-PSSession -ComputerName $vm_ip -Credential $cred -SessionOption $sessionOpt -ErrorAction Stop
    } catch {
        $session = New-PSSession -ComputerName $vm_ip -Credential $cred -Authentication Basic -SessionOption $sessionOpt -ErrorAction Stop
    }
    
    # 5. Run Command on Remote VM
    $result = Invoke-Command -Session $session -ScriptBlock {
        param($targetUser)
        $user = Get-LocalUser -Name $targetUser -ErrorAction SilentlyContinue
        
        if (-not $user) {
            return @{ success = $false; error = "User '$targetUser' not found on VM" }
        }
        
        if ($user.PasswordExpires) {
            $daysLeft = ($user.PasswordExpires - (Get-Date)).Days
            return @{
                success = $true
                days_until_expiry = $daysLeft
                expires_at = $user.PasswordExpires.ToString("yyyy-MM-dd HH:mm:ss")
            }
        } else {
            return @{
                success = $true
                days_until_expiry = $null
                never_expires = $true
            }
        }
    } -ArgumentList $target_user
    
    Remove-PSSession $session
    
    # 6. Output Result as JSON
    Write-Output ($result | ConvertTo-Json -Compress)

} catch {
    # Catch ANY error and output as JSON
    $err = @{ success = $false; error = $_.Exception.Message }
    Write-Output ($err | ConvertTo-Json -Compress)
}