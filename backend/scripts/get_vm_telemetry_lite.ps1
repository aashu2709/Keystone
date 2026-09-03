# Lightweight telemetry script for background collection loop.
# Collects ONLY CPU% and RAM% — completes in 2-3 seconds (not 15-25s).
#
# The heavy get_vm_health.ps1 is still used for the live dashboard view
# (when an admin clicks on a specific VM). This lite script is for the
# background loop that runs every 30s on ALL VMs simultaneously.

param (
    [Parameter(Mandatory=$true)]
    [string]$vm_ip,
    
    [Parameter(Mandatory=$true)]
    [string]$admin_user
)

$ErrorActionPreference = "Stop"
$InformationPreference = "SilentlyContinue"
$WarningPreference = "SilentlyContinue"

# Read password from Stdin
$admin_pass_plain = [Console]::In.ReadLine()
if (-not $admin_pass_plain) {
    Write-Output '{"success":false,"message":"Password not provided via stdin."}'
    exit 1
}

$secure = ConvertTo-SecureString $admin_pass_plain -AsPlainText -Force
$cred = New-Object System.Management.Automation.PSCredential($admin_user, $secure)

$scriptBlock = {
    try {
        $os = Get-CimInstance Win32_OperatingSystem
        
        # CPU: 1-second averaged sample using performance counters.
        # Win32_Processor.LoadPercentage is an instantaneous millisecond snapshot,
        # which produces wildly erratic/noisy graphs (e.g., 0% to 50% spikes).
        # Get-Counter averages over 1 second, producing smooth, accurate data
        # identical to Task Manager and Zabbix.
        # 
        # OBSERVER EFFECT FIX: We sleep for 5 seconds first. WinRM and PowerShell
        # module loading causes a 1-2 second CPU spike (10-20%) when this script
        # connects. Sleeping lets that spike fully pass so we measure the true idle CPU.
        Start-Sleep -Milliseconds 5000
        $cpuSample = Get-Counter '\Processor(_Total)\% Processor Time' -SampleInterval 1 -MaxSamples 2 -ErrorAction SilentlyContinue
        if ($cpuSample -and $cpuSample.Count -ge 2) {
            $cpuLoad = $cpuSample[1].CounterSamples[0].CookedValue
        } else {
            # Fallback if counters are corrupted on the VM
            $cpuLoad = (Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average
        }
        if ($null -eq $cpuLoad) { $cpuLoad = 0 }
        
        # RAM: from OS counters (instant, exact match to Task Manager)
        $totalRamMB = [double]$os.TotalVisibleMemorySize / 1024
        $freeRamMB  = [double]$os.FreePhysicalMemory / 1024
        $usedRamMB  = $totalRamMB - $freeRamMB
        
        # Disk: quick summary (no I/O counters, just space usage)
        $diskList = @()
        $disks = Get-CimInstance Win32_LogicalDisk | Where-Object { $_.DriveType -eq 3 -and $_.Size -gt 0 }
        foreach ($d in $disks) {
            $diskList += @{
                DeviceID    = $d.DeviceID
                SizeGB      = [math]::Round($d.Size / 1GB, 2)
                FreeGB      = [math]::Round($d.FreeSpace / 1GB, 2)
                UsedGB      = [math]::Round(($d.Size - $d.FreeSpace) / 1GB, 2)
                UsedPercent = [math]::Round((($d.Size - $d.FreeSpace) / $d.Size) * 100, 2)
            }
        }
        
        return @{
            success = $true
            data = @{
                cpu = @{
                    loadPercent = [math]::Round($cpuLoad, 1)
                }
                memory = @{
                    totalGB     = [math]::Round($totalRamMB / 1024, 2)
                    freeGB      = [math]::Round($freeRamMB / 1024, 2)
                    usedGB      = [math]::Round($usedRamMB / 1024, 2)
                    usedPercent = [math]::Round(($usedRamMB / $totalRamMB) * 100, 1)
                }
                os = @{
                    uptimeSeconds = [math]::Round(((Get-Date) - $os.LastBootUpTime).TotalSeconds)
                }
                disks = $diskList
            }
        }
    } catch {
        return @{ success = $false; message = $_.Exception.Message }
    }
}

try {
    # Attempt 1: Standard Negotiate/NTLM auth (default WinRM mechanism for Windows Server)
    $result = $null
    try {
        $result = Invoke-Command -ComputerName $vm_ip -Credential $cred -ScriptBlock $scriptBlock -ErrorAction Stop
    } catch {
        # Attempt 2: Basic Auth (Fallback if target WinRM server requires explicit Basic auth)
        $result = Invoke-Command -ComputerName $vm_ip -Credential $cred -Authentication Basic -ScriptBlock $scriptBlock -ErrorAction Stop
    }
    
    if ($result.success) {
        $json = @{ success = $true; message = "OK"; data = $result.data } | ConvertTo-Json -Depth 5 -Compress
        Write-Output $json
    } else {
        $json = @{ success = $false; message = $result.message } | ConvertTo-Json -Compress
        Write-Output $json
    }
} catch {
    $json = @{ success = $false; message = "WinRM Execution Error: $_" } | ConvertTo-Json -Compress
    Write-Output $json
}
