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
         try {
            $os = Get-CimInstance Win32_OperatingSystem
            $cs = Get-CimInstance Win32_ComputerSystem
            $procs = Get-CimInstance Win32_Processor
            
            $totalCores = ($procs | Measure-Object -Property NumberOfCores -Sum).Sum
            $logicalProcs = $cs.NumberOfLogicalProcessors
            $model = $procs[0].Name.Trim()
            $uptime = (Get-Date) - $os.LastBootUpTime

            $disks = Get-CimInstance Win32_LogicalDisk | Where-Object { $_.DriveType -eq 3 } | Select-Object DeviceID, Size, FreeSpace
            $diskList = @()
            foreach ($d in $disks) {
                if ($d.Size -gt 0) {
                    $diskList += @{
                        DeviceID = $d.DeviceID
                        SizeGB = [math]::Round($d.Size / 1GB, 2)
                        FreeGB = [math]::Round($d.FreeSpace / 1GB, 2)
                        UsedGB = [math]::Round(($d.Size - $d.FreeSpace) / 1GB, 2)
                        UsedPercent = [math]::Round((($d.Size - $d.FreeSpace) / $d.Size) * 100, 2)
                    }
                }
            }

            # Disk I/O Performance
            $diskPerf = Get-CimInstance Win32_PerfFormattedData_PerfDisk_PhysicalDisk | Where-Object Name -eq "_Total"
            $diskIO = @{
                readBytesPerSec = if ($diskPerf) { $diskPerf.DiskReadBytesPersec } else { 0 }
                writeBytesPerSec = if ($diskPerf) { $diskPerf.DiskWriteBytesPersec } else { 0 }
                readsPerSec = if ($diskPerf) { $diskPerf.DiskReadsPersec } else { 0 }
                writesPerSec = if ($diskPerf) { $diskPerf.DiskWritesPersec } else { 0 }
            }

            # Network I/O Performance
            $netPerf = Get-CimInstance Win32_PerfFormattedData_Tcpip_NetworkInterface -ErrorAction SilentlyContinue
            $netIO = @{
                bytesReceivedPerSec = 0
                bytesSentPerSec = 0
            }
            if ($netPerf) {
                foreach ($adapter in $netPerf) {
                    $netIO.bytesReceivedPerSec += $adapter.BytesReceivedPersec
                    $netIO.bytesSentPerSec += $adapter.BytesSentPersec
                }
            }

            # ========== SYSTEM AND PER-USER RESOURCE SNAPSHOTS (3-Second Smooth Average) ==========
            $sessionData = @{}
            $totalSystemCpu = 0.0
            
            try {
                # --- SNAPSHOT 1 (Per-User CPU Baseline) ---
                $snap1 = @{}
                $wmiProcs1 = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue
                $t1 = [DateTime]::UtcNow
                
                if ($wmiProcs1) {
                    foreach ($p in $wmiProcs1) {
                        if ($null -eq $p.SessionId -or $p.SessionId -eq 0) { continue }
                        $kt = if ($p.KernelModeTime) { [double]$p.KernelModeTime } else { 0 }
                        $ut = if ($p.UserModeTime) { [double]$p.UserModeTime } else { 0 }
                        $snap1[$p.ProcessId.ToString()] = @{
                            sid = $p.SessionId.ToString()
                            cpu = $kt + $ut
                        }
                    }
                }
                
                # --- SYSTEM CPU (Takes 5 seconds, acts as our sleep delay) ---
                try {
                    # Task Manager on Windows 8+ uses % Processor Utility to account for CPU frequency scaling
                    $cpuCounters = Get-Counter '\Processor Information(_Total)\% Processor Utility' -SampleInterval 1 -MaxSamples 5 -ErrorAction Stop
                    $avgCpu = ($cpuCounters.CounterSamples.CookedValue | Measure-Object -Average).Average
                    if ($avgCpu -gt 100) { $avgCpu = 100.0 }
                    $totalSystemCpu = [math]::Round($avgCpu, 1)
                } catch {
                    try {
                        # Fallback for older OS or localized systems
                        $cpuCounters = Get-Counter '\Processor(_Total)\% Processor Time' -SampleInterval 1 -MaxSamples 5 -ErrorAction Stop
                        $totalSystemCpu = [math]::Round(($cpuCounters.CounterSamples.CookedValue | Measure-Object -Average).Average, 1)
                    } catch {
                        Start-Sleep -Seconds 5 # Fallback delay if Get-Counter fails entirely
                        $totalSystemCpu = ($procs | Measure-Object -Property LoadPercentage -Average).Average
                        if ($null -eq $totalSystemCpu) { $totalSystemCpu = 0.0 }
                    }
                }
                
                # --- SNAPSHOT 2 (Per-User CPU Delta) ---
                $snap2 = @{}
                $pidToSession = @{}
                $wmiProcs2 = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue
                $t2 = [DateTime]::UtcNow
                $elapsedTicks = ($t2 - $t1).Ticks
                
                if ($wmiProcs2) {
                    foreach ($p in $wmiProcs2) {
                        if ($null -eq $p.SessionId -or $p.SessionId -eq 0) { continue }
                        $pidStr = $p.ProcessId.ToString()
                        $sidStr = $p.SessionId.ToString()
                        $kt = if ($p.KernelModeTime) { [double]$p.KernelModeTime } else { 0 }
                        $ut = if ($p.UserModeTime) { [double]$p.UserModeTime } else { 0 }
                        $snap2[$pidStr] = @{
                            sid = $sidStr
                            cpu = $kt + $ut
                        }
                        $pidToSession[$pidStr] = $sidStr
                    }
                }

                # --- Calculate PER-USER CPU% (Smoothed over ~3 seconds) ---
                $cpuPerSession = @{}
                if ($elapsedTicks -gt 0) {
                    foreach ($pidStr in $snap2.Keys) {
                        $s2 = $snap2[$pidStr]
                        $sidStr = $s2.sid
                        if (-not $cpuPerSession.ContainsKey($sidStr)) {
                            $cpuPerSession[$sidStr] = 0.0
                        }
                        if ($snap1.ContainsKey($pidStr)) {
                            $delta = $s2.cpu - $snap1[$pidStr].cpu
                            if ($delta -gt 0) {
                                $cpuPerSession[$sidStr] += ($delta / $elapsedTicks / $logicalProcs) * 100.0
                            }
                        }
                    }
                }
                
                # --- Get PRIVATE Working Set memory per session (Matches Task Manager exactly) ---
                $memPerSession = @{}
                $allPerf = Get-CimInstance Win32_PerfFormattedData_PerfProc_Process -ErrorAction SilentlyContinue
                if ($allPerf) {
                    foreach ($pp in $allPerf) {
                        if ($pp.Name -eq '_Total' -or $pp.Name -eq 'Idle') { continue }
                        $pidStr = $pp.IDProcess.ToString()
                        if ($pidToSession.ContainsKey($pidStr)) {
                            $sidStr = $pidToSession[$pidStr]
                            if (-not $memPerSession.ContainsKey($sidStr)) {
                                $memPerSession[$sidStr] = 0.0
                            }
                            $memPerSession[$sidStr] += [double]$pp.WorkingSetPrivate
                        }
                    }
                }
                
                # Build final per-session data
                $allSids = @($cpuPerSession.Keys) + @($memPerSession.Keys) | Sort-Object -Unique
                foreach ($sidStr in $allSids) {
                    $cpu = 0.0
                    $mem = 0.0
                    if ($cpuPerSession.ContainsKey($sidStr)) {
                        $cpu = $cpuPerSession[$sidStr]
                    }
                    if ($memPerSession.ContainsKey($sidStr)) {
                        $mem = $memPerSession[$sidStr] / 1MB
                    }
                    $sessionData[$sidStr] = @{
                        cpuPercent = [math]::Round($cpu, 1)
                        memoryMB = [math]::Round($mem, 1)
                    }
                }
            } catch {}

            # ========== SYSTEM RAM (Matches Task Manager EXACTLY) ==========
            $totalRamMB = [double]$os.TotalVisibleMemorySize / 1024
            $availRamMB = [double]$os.FreePhysicalMemory / 1024
            $usedRamMB = $totalRamMB - $availRamMB
            $ramUsedPercent = [math]::Round(($usedRamMB / $totalRamMB) * 100.0, 1)

            # ========== ACTIVE RDP SESSIONS ==========
            $activeSessions = @()
            $quserOut = quser.exe 2>$null
            if ($quserOut) {
                for ($i = 1; $i -lt $quserOut.Count; $i++) {
                    $line = $quserOut[$i]
                    if (-not $line.Trim()) { continue }
                    
                    $parts = $line.Trim() -split '\s{2,}'
                    
                    # Detect state column
                    $stateIdx = -1
                    for ($j = 0; $j -lt $parts.Count; $j++) {
                        if ($parts[$j] -match '^(Active|Disc)$') {
                            $stateIdx = $j
                            break
                        }
                    }
                    if ($stateIdx -lt 1) { continue }
                    
                    $username = ($parts[0] -replace '^>', '').Trim()
                    $state = $parts[$stateIdx]
                    $logonTime = $parts[-1]
                    $idleTime = if ($parts.Count -gt ($stateIdx + 2)) { $parts[$stateIdx + 1] } else { "." }
                    
                    # Extract Session ID
                    $sessionId = 0
                    [int]::TryParse($parts[$stateIdx - 1], [ref]$sessionId) | Out-Null
                    if ($sessionId -eq 0 -and $stateIdx -ge 2) {
                        [int]::TryParse($parts[$stateIdx - 2], [ref]$sessionId) | Out-Null
                    }
                    
                    # Look up pre-computed resource usage (STRING key)
                    $uCpu = 0.0
                    $uMem = 0.0
                    $sidLookup = $sessionId.ToString()
                    if ($sessionData.ContainsKey($sidLookup)) {
                        $uCpu = $sessionData[$sidLookup].cpuPercent
                        $uMem = $sessionData[$sidLookup].memoryMB
                    }
                    
                    $activeSessions += @{
                        username = $username
                        sessionId = $sessionId
                        state = $state
                        logonTime = $logonTime.Trim()
                        idleTime = $idleTime.Trim()
                        cpuPercent = $uCpu
                        memoryMB = $uMem
                    }
                }
            }
            
            $stats = @{
                os = @{
                    caption = $os.Caption
                    version = $os.Version
                    build = $os.BuildNumber
                    lastBoot = $os.LastBootUpTime.ToString("yyyy-MM-dd HH:mm:ss")
                    uptimeSeconds = [math]::Round($uptime.TotalSeconds)
                }
                cpu = @{
                    loadPercent = $totalSystemCpu
                    model = $model
                    cores = $totalCores
                    threads = $logicalProcs
                }
                memory = @{
                    totalGB = [math]::Round($totalRamMB / 1024, 2)
                    freeGB = [math]::Round($availRamMB / 1024, 2)
                    usedGB = [math]::Round($usedRamMB / 1024, 2)
                    usedPercent = $ramUsedPercent
                }
                disks = $diskList
                disk_io = $diskIO
                network_io = $netIO
                active_users = $activeSessions
            }
            
            return @{ success = $true; data = $stats }
        } catch {
            return @{ success = $false; message = $_.Exception.Message }
        }
    }

    $remoteResult = $null
    try {
        $remoteResult = Invoke-Command -ComputerName $vm_ip -Credential $credential -ScriptBlock $scriptBlock -ErrorAction Stop
    } catch {
        $remoteResult = Invoke-Command -ComputerName $vm_ip -Credential $credential -Authentication Basic -ScriptBlock $scriptBlock -ErrorAction Stop
    }
    
    if ($remoteResult.success) {
        Output-Result -success $true -message "Telemetry success" -data $remoteResult.data
    } else {
        Output-Result -success $false -message $remoteResult.message
    }
} catch {
    Output-Result -success $false -message "WinRM Execution Error: $_"
}
