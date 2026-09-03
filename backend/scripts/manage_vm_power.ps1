param (
    [Parameter(Mandatory=$true)]
    [string]$vm_ip,
    
    [Parameter(Mandatory=$true)]
    [string]$admin_user,

    [Parameter(Mandatory=$true)]
    [string]$action
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

Function Output-Result {
    param([bool]$success, [string]$message, $data = $null)
    $obj = @{
        success = $success
        message = $message
    }
    if ($null -ne $data) {
        $obj.data = $data
    }
    $json = $obj | ConvertTo-Json -Depth 10 -Compress
    Write-Output $json
    exit 0
}

try {
    if ($action -eq "reboot") {
        # Restart-Computer -ComputerName is optimized for remote reboots and returns quickly
        Restart-Computer -ComputerName $vm_ip -Credential $credential -Force -ErrorAction Stop
        Output-Result -success $true -message "Reboot command sent successfully to $vm_ip."
    } elseif ($action -eq "shutdown") {
        Stop-Computer -ComputerName $vm_ip -Credential $credential -Force -ErrorAction Stop
        Output-Result -success $true -message "Shutdown command sent successfully to $vm_ip."
    } else {
        Output-Result -success $false -message "Invalid action: $action"
    }
} catch {
    Output-Result -success $false -message "WinRM Power Action Error: $_"
}
