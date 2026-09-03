param (
    [Parameter(Mandatory=$true)]
    [ValidatePattern('^(\d{1,3}\.){3}\d{1,3}$')]
    [string]$vm_ip,

    [Parameter(Mandatory=$true)]
    [string]$admin_user
)

# ============================================
# LOGGING & OUTPUT
# ============================================
$log_dir = "logs"
if (!(Test-Path $log_dir)) { New-Item -ItemType Directory -Path $log_dir -Force | Out-Null }
$ps_log_file = Join-Path $log_dir "manage_certificates.log"

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
    Write-Log -Level "INFO" -Message "=== Starting manage_certificates (IIS): vm=$vm_ip ==="

    $admin_pass_plain = [Console]::In.ReadLine()
    if (-not $admin_pass_plain) {
        Write-JsonResult -Success $false -Message "Admin password was not provided via stdin."
        exit 1
    }

    $secure_admin_pass = ConvertTo-SecureString $admin_pass_plain -AsPlainText -Force
    $cred = New-Object System.Management.Automation.PSCredential($admin_user, $secure_admin_pass)

    Write-Log -Level "DEBUG" -Message "Testing WinRM connectivity..."
    $wsmanTest = Test-WSMan -ComputerName $vm_ip -ErrorAction SilentlyContinue
    if (-not $wsmanTest) {
        Write-JsonResult -Success $false -Message "WinRM not reachable on $vm_ip."
        exit 1
    }

    $scriptBlock = {
        # Import WebAdministration module for IIS management
        try {
            Import-Module WebAdministration -ErrorAction Stop
        } catch {
            return @{
                error = $true
                message = "IIS WebAdministration module is not available on this server. Ensure IIS is installed."
            }
        }

        $allCerts = @()

        # Get all IIS sites
        $sites = Get-Website

        foreach ($site in $sites) {
            # Get HTTPS bindings for this site
            $httpsBindings = $site.Bindings.Collection | Where-Object { $_.protocol -eq "https" }

            foreach ($binding in $httpsBindings) {
                $bindingInfo = $binding.bindingInformation  # e.g. "*:443:" or "*:443:hostname"
                $parts = $bindingInfo -split ":"
                $port = if ($parts.Length -ge 2) { $parts[1] } else { "443" }
                $hostHeader = if ($parts.Length -ge 3 -and $parts[2]) { $parts[2] } else { "(All Unassigned)" }

                $certHash = $binding.certificateHash
                $certStoreName = $binding.certificateStoreName
                if (-not $certStoreName) { $certStoreName = "My" }

                if ($certHash) {
                    # Resolve the certificate from the store
                    $certPath = "Cert:\LocalMachine\$certStoreName\$certHash"
                    $cert = $null
                    try {
                        $cert = Get-Item -Path $certPath -ErrorAction SilentlyContinue
                    } catch {}

                    if ($cert) {
                        $daysRemaining = 0
                        if ($cert.NotAfter -gt (Get-Date)) {
                            $daysRemaining = [math]::Round(($cert.NotAfter - (Get-Date)).TotalDays)
                        } else {
                            $daysRemaining = -1 * [math]::Round(((Get-Date) - $cert.NotAfter).TotalDays)
                        }

                        $allCerts += @{
                            thumbprint      = $cert.Thumbprint
                            subject         = $cert.Subject
                            issuer          = $cert.Issuer
                            not_before      = $cert.NotBefore.ToString("yyyy-MM-dd")
                            not_after       = $cert.NotAfter.ToString("yyyy-MM-dd")
                            days_remaining  = $daysRemaining
                            has_private_key = $cert.HasPrivateKey
                            site_name       = $site.Name
                            site_id         = [int]$site.ID
                            site_state      = $site.State
                            binding_port    = $port
                            host_header     = $hostHeader
                            store           = $certStoreName
                        }
                    } else {
                        # Certificate hash exists in binding but cert not found in store
                        $allCerts += @{
                            thumbprint      = $certHash
                            subject         = "(Certificate not found in $certStoreName store)"
                            issuer          = "Unknown"
                            not_before      = "N/A"
                            not_after       = "N/A"
                            days_remaining  = -9999
                            has_private_key = $false
                            site_name       = $site.Name
                            site_id         = [int]$site.ID
                            site_state      = $site.State
                            binding_port    = $port
                            host_header     = $hostHeader
                            store           = $certStoreName
                        }
                    }
                }
            }
        }

        return @{ certificates = @($allCerts) }
    }

    $certData = $null
    try {
        $certData = Invoke-Command -ComputerName $vm_ip -Credential $cred -ScriptBlock $scriptBlock -ErrorAction Stop
    } catch {
        $certData = Invoke-Command -ComputerName $vm_ip -Credential $cred -Authentication Basic -ScriptBlock $scriptBlock -ErrorAction Stop
    }

    # Check if the remote script returned an error (e.g. IIS not installed)
    if ($certData.error -eq $true) {
        Write-JsonResult -Success $false -Message $certData.message
        exit 1
    }

    Write-JsonResult -Success $true -Message "Found $($certData.certificates.Count) IIS-bound certificates" -Data @{ certificates = @($certData.certificates) }
    exit 0

} catch {
    $errorMsg = $_.Exception.Message
    Write-Log -Level "ERROR" -Message "Unhandled error: $errorMsg"
    if ($errorMsg -match "Access is denied") { $errorMsg = "Access denied. Check admin credentials." }
    elseif ($errorMsg -match "WinRM") { $errorMsg = "WinRM connection failed." }
    Write-JsonResult -Success $false -Message $errorMsg
    exit 1
}
