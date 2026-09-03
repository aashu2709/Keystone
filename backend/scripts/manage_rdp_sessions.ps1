param (
    [Parameter(Mandatory=$true)]
    [string]$vm_ip,
    
    [Parameter(Mandatory=$true)]
    [string]$admin_user,

    [Parameter(Mandatory=$true)]
    [string]$action,

    [Parameter(Mandatory=$true)]
    [int]$session_id
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
    $scriptBlock = {
        param([string]$act, [int]$sid)
        try {
            if ($act -eq "logoff") {
                logoff $sid
                return @{ success = $true; message = "Session $sid logged off successfully." }
            } elseif ($act -eq "disconnect") {
                tsdiscon $sid
                return @{ success = $true; message = "Session $sid disconnected successfully." }
            } else {
                return @{ success = $false; message = "Invalid action: $act" }
            }
        } catch {
            return @{ success = $false; message = $_.Exception.Message }
        }
    }

    $session = $null
    try {
        $session = New-PSSession -ComputerName $vm_ip -Credential $credential -ErrorAction Stop
    } catch {
        $session = New-PSSession -ComputerName $vm_ip -Credential $credential -Authentication Basic -ErrorAction Stop
    }
    $remoteResult = Invoke-Command -Session $session -ScriptBlock $scriptBlock -ArgumentList $action, $session_id
    Remove-PSSession $session
    
    if ($remoteResult.success) {
        Output-Result -success $true -message $remoteResult.message
    } else {
        Output-Result -success $false -message $remoteResult.message
    }
} catch {
    Output-Result -success $false -message "WinRM Execution Error: $_"
}
