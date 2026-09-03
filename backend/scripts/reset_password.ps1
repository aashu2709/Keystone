param (
    [Parameter(Mandatory=$true)][ValidatePattern('^(\d{1,3}\.){3}\d{1,3}$')][string]$vm_ip,
    [Parameter(Mandatory=$true)][ValidatePattern('^[A-Za-z0-9._@\\-]{1,64}$')][string]$username,
    [Parameter(Mandatory=$true)][string]$old_password,
    [Parameter(Mandatory=$true)][string]$new_password,
    [Parameter(Mandatory=$true)][string]$admin_user
)
# Logging setup for PS script – matches screenshot structure
$log_dir = "logs"
if (!(Test-Path $log_dir)) { New-Item -ItemType Directory -Path $log_dir -Force }
$ps_log_file = Join-Path $log_dir "reset_password.log" # Exact name from screenshot
function Write-Log {
    param(
        [string]$Level,
        [string]$Message
    )
    $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    $log_entry = "$timestamp - [$Level] - $Message"
    # Write to console (stdout for app capture)
    Write-Output $log_entry
    # Append to PS-specific log file in logs/
    Add-Content -Path $ps_log_file -Value $log_entry
}
function Test-PasswordExpired {
    param($vm_ip, $username, $cred)
    try {
        $netUserOutput = Invoke-Command -ComputerName $vm_ip -Credential $cred -ScriptBlock {
            param($username)
            $output = net user $username
            return $output  # Return as array of lines
        } -ArgumentList $username -Authentication Basic -ErrorAction Stop
        Write-Log -Level "DEBUG" -Message "Net user output: $($netUserOutput -join ' | ')"
        # Check password last set for "Never" first
        $lastSetLine = $netUserOutput | Where-Object { $_ -match "Password last set" } | Select-Object -First 1
        $lastSetLine = $lastSetLine.Trim()
        Write-Log -Level "DEBUG" -Message "Last set line: $lastSetLine"
        if ($lastSetLine -match "Never") {
            Write-Log -Level "DEBUG" -Message "Password last set: Never"
            return "NEVER_SET"
        }
        # Parse password expires line directly
        $expiresLine = $netUserOutput | Where-Object { $_ -match "Password expires" } | Select-Object -First 1
        $expiresLine = $expiresLine.Trim()
        Write-Log -Level "DEBUG" -Message "Expires line: $expiresLine"
        if ($expiresLine -match "Never") {
            Write-Log -Level "DEBUG" -Message "Password expires: Never (treat as NOT_EXPIRED)"
            return "NOT_EXPIRED"
        } elseif ($expiresLine -match 'Password expires\s+(.+?)\s+(\d{1,2}:\d{2}:\d{2}\s*(?:AM|PM)?)$') {
			      $datePart = $matches[1].Trim() -replace '/', '-'
				  $timeAndAmPm = $matches[2].Trim()
				  $expiresStr = "$datePart $timeAndAmPm".Trim()
            #$ampm = if ($matches[3]) { " $($matches[3])" } else { "" }
            #$expiresStr = "$datePart $timePart$ampm".Trim()

            Write-Log -Level "DEBUG" -Message "Normalized expires str: $expiresStr"

            $formats = @(
                "M-d-yyyy h:mm:ss tt",
                "M-d-yyyy H:mm:ss",
                "d-M-yyyy h:mm:ss tt",
                "d-M-yyyy H:mm:ss",
                "MM-dd-yyyy h:mm:ss tt",
                "M/d/yyyy h:mm:ss tt"
            )

            $expiresDate = $null
            foreach ($format in $formats) {
                try {
                    $expiresDate = [DateTime]::ParseExact($expiresStr, $format, 
                                    [System.Globalization.CultureInfo]::InvariantCulture, 
                                    [System.Globalization.DateTimeStyles]::None)
                    Write-Log -Level "DEBUG" -Message "Parsed successfully → $expiresDate (format: $format)"
                    break
                }
                catch {
                    # agar ek format fail ho to next try karo
                    continue
                }
            }

            if (-not $expiresDate) {
                Write-Log -Level "WARNING" -Message "All formats failed for '$expiresStr' → assuming EXPIRED"
                return "EXPIRED"
            }

            if ((Get-Date) -ge $expiresDate) {
                Write-Log -Level "DEBUG" -Message "Password is EXPIRED"
                return "EXPIRED"
            } else {
                Write-Log -Level "DEBUG" -Message "Password is still valid"
                return "NOT_EXPIRED"
            }
           # $datePart = $matches[1]
           # $timePart = $matches[2]
           # $ampm = if ($matches[3]) { " $($matches[3])" } else { "" }
           # # Normalize separators to - for parsing
           # $datePart = $datePart -replace '/', '-'
           # $expiresStr = "$datePart $timePart $ampm".Trim()
           # Write-Log -Level "DEBUG" -Message "Normalized expires str: $expiresStr"
           # # Robust parsing with multiple formats (cover DD/MM, MM/DD, 12/24-hr, AM/PM)
           # $formats = @(
           #     "M-d-yyyy h:mm:ss tt",
			#	"M-d-yyyy H:mm:ss",
			#	"M/d/yyyy h:mm:ss tt",
			#	"M/d/yyyy H:mm:ss",
			#	"MM-dd-yyyy h:mm:ss tt",
			#	"MM/dd/yyyy h:mm:ss tt"
           # )
           # $expiresDate = $null
           # $parsed = $false
            #foreach ($format in $formats) {
            #    try {
            #        $expiresDate = [DateTime]::ParseExact($expiresStr, $format, [System.Globalization.CultureInfo]::InvariantCulture)
            #        $parsed = $true
            #        Write-Log -Level "DEBUG" -Message ("Expires date parsed successfully using format: {0}" -f $format)
            #        break
            #    }
            #    catch {
            #        Write-Log -Level "DEBUG" -Message ("Failed to parse expires with format {0}: {1}" -f $format, $_.Exception.Message)
            #    }
            #}
            #if (-not $parsed) {
            #    Write-Log -Level "ERROR" -Message ("Failed to parse password expires date '{0}'. Treating as NOT_EXPIRED." -f $expiresStr)
            #    return "NOT_EXPIRED"
            #}
		#foreach ($format in $formats) {
		#	if ([DateTime]::TryParseExact($expiresStr, $format, 
		#		 [System.Globalization.CultureInfo]::InvariantCulture, 
		#		 [System.Globalization.DateTimeStyles]::None, [ref]$expiresDate)) {
		#		$parsed = $true
		#		Write-Log -Level "DEBUG" -Message "Parsed successfully with format: $format → $expiresDate"
		#		break
    }    
#}        #
         #$now = Get-Date
         #$timeUntilExpiry = $expiresDate - $now
         #$daysUntilExpiry = $timeUntilExpiry.Days
         #$hoursUntilExpiry = $timeUntilExpiry.TotalHours
         #Write-Log -Level "DEBUG" -Message ("Expires parsed: {0}, Days until expiry: {1}, Total hours: {2:N1}" -f $expiresDate, $daysUntilExpiry, $hoursUntilExpiry)
         #if ($expiresDate -le $now) {
         #    Write-Log -Level "DEBUG" -Message "Status: EXPIRED (expires <= now)"
         #    return "EXPIRED"
         #} else {
         #    Write-Log -Level "DEBUG" -Message "Status: NOT_EXPIRED (expires > now)"
         #    return "NOT_EXPIRED"
         #}
        #}#se {
         #Write-Log -Level "DEBUG" -Message "Expires parse failed (no date found), treating as NOT_EXPIRED"
         #return "NOT_EXPIRED"
        #}#
    }
    catch {
        Write-Log -Level "ERROR" -Message "Expiry check error: $($_.Exception.Message)"
        return "ERROR"
    }
}
try {
    # 1️ Read admin password securely from stdin
    $admin_pass_plain = [Console]::In.ReadLine()
    if (-not $admin_pass_plain) {
        throw "Admin password was not provided via stdin."
    }
    $secure_admin_pass = ConvertTo-SecureString $admin_pass_plain -AsPlainText -Force
    # 2️ Create credential object
    $cred = New-Object System.Management.Automation.PSCredential($admin_user, $secure_admin_pass)
    # 3 Optional: Verify connectivity to remote VM
    #if (-not (Test-Connection -ComputerName $vm_ip -Count 1 -Quiet)) {
    #    throw "Cannot reach VM at $vm_ip. Check network or firewall."
    #}
    Write-Log -Level "INFO" -Message "Starting password reset for user '$username' on VM '$vm_ip'"
    Write-Log -Level "DEBUG" -Message "Checking network connectivity to $vm_ip..."
    Write-Log -Level "DEBUG" -Message "Checking WinRM configuration on $vm_ip..."
    $wsmanTest = Test-WSMan -ComputerName $vm_ip -ErrorAction SilentlyContinue
    if ($wsmanTest) {
        Write-Log -Level "DEBUG" -Message "WinRM service reachable: $($wsmanTest.ProductVendor) - OS: $($wsmanTest.ProductVersion) SP: $($wsmanTest.ProductVersion) Stack: $($wsmanTest.ProtocolVersion)"
    } else {
        throw "WinRM not reachable on $vm_ip."
    }
    # User existence check (always, before verification)
    Write-Log -Level "DEBUG" -Message "Checking if user ' $username' exists on VM..."
    $userExists = Invoke-Command -ComputerName $vm_ip -Credential $cred -ScriptBlock {
        param($username)
        try {
            $user = Get-LocalUser -Name $username -ErrorAction Stop
            return "EXISTS"
        }
        catch {
            return "NOT_EXISTS"
        }
    } -ArgumentList $username -Authentication Basic -ErrorAction SilentlyContinue
    if ($userExists -eq "NOT_EXISTS") {
        Write-Log -Level "ERROR" -Message "User '$username' does not exist on VM '$vm_ip'."
        [Console]::Error.WriteLine("User '$username' does not exist on this VM.")
        exit 1
    } else {
        Write-Log -Level "DEBUG" -Message "User '$username' exists on VM."
    }
    $secure_old_pass = ConvertTo-SecureString $old_password -AsPlainText -Force
    $oldCred = New-Object System.Management.Automation.PSCredential($username, $secure_old_pass)
    Write-Log -Level "DEBUG" -Message "Verifying old password for $username..."
    Write-Log -Level "DEBUG" -Message "Attempting Basic authentication for old password verification..."
    # Enhanced expiry check using "Password expires" from net user
    $expiryStatus = Test-PasswordExpired -vm_ip $vm_ip -username $username -cred $cred
    Write-Log -Level "DEBUG" -Message "Password expiry status: $expiryStatus"
    if ($expiryStatus -eq "EXPIRED" -or $expiryStatus -eq "NEVER_SET") {
        Write-Log -Level "WARNING" -Message "Password is expired or never set for user '$username'. Skipping old password verification and proceeding to reset."
    } elseif ($expiryStatus -eq "NOT_EXPIRED") {
        # Normal verification for non-expired passwords
        try {
            try {
                Invoke-Command -ComputerName $vm_ip -Credential $oldCred -ScriptBlock { whoami } -ErrorAction Stop | Out-Null
            } catch {
                Invoke-Command -ComputerName $vm_ip -Credential $oldCred -ScriptBlock { whoami } -Authentication Basic -ErrorAction Stop | Out-Null
            }
            Write-Log -Level "DEBUG" -Message "Old password verified successfully."
        }
        catch {
            Write-Log -Level "ERROR" -Message "Old password is incorrect."
            [Console]::Error.WriteLine("Old password is incorrect.")
            exit 1
        }
    } else {
        Write-Log -Level "ERROR" -Message "Could not determine password expiry status for user '$username'. Aborting."
        exit 1
    }
    Write-Log -Level "DEBUG" -Message "Verifying admin credentials for $admin_user..."
    Write-Log -Level "DEBUG" -Message "Admin password received: [Redacted for logging]"
    Write-Log -Level "DEBUG" -Message "Attempting WinRM authentication for admin verification..."
    try {
        # Admin verification with smart fallback (Negotiate -> Basic)
        try {
            Invoke-Command -ComputerName $vm_ip -Credential $cred -ScriptBlock { whoami } -ErrorAction Stop | Out-Null
        } catch {
            Invoke-Command -ComputerName $vm_ip -Credential $cred -ScriptBlock { whoami } -Authentication Basic -ErrorAction Stop | Out-Null
        }
        Write-Log -Level "DEBUG" -Message "Admin verified successfully."
    }
    catch {
        Write-Log -Level "ERROR" -Message "Basic authentication failed for admin verification: $($_.Exception.Message)"
        Write-Log -Level "ERROR" -Message "Password reset failed: Admin credentials verification failed with Basic authentication. Check admin username/password or WinRM config."
        exit 1
    }
    # 4️ Run password reset remotely
    Invoke-Command -ComputerName $vm_ip -Credential $cred -ScriptBlock {
        param($username, $new_password)
        try {
            # Reset user password
            net user $username $new_password
            if ($LASTEXITCODE -eq 0) {
                Write-Output "Password reset successfully!"
            }
            else {
                throw "Password reset command failed with exit code $LASTEXITCODE."
            }
        }
        catch {
            Write-Error "Error: $($_.Exception.Message)"
            exit 1
        }
    } -ArgumentList $username, $new_password -Authentication Basic -ErrorAction Stop
    Write-Log -Level "INFO" -Message "Password reset successful for user '$username' on VM '$vm_ip'"
}
catch {
    Write-Log -Level "ERROR" -Message "$($_.Exception.Message)"
    exit 1
}