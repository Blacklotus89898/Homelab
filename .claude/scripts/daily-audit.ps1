# Homelab daily audit — runs headless `claude -p` against the cluster and logs the report.
# Registered in Task Scheduler as "Homelab Daily Audit" (daily 08:23, StartWhenAvailable).
# Logs: %USERPROFILE%\homelab-audits\audit-<stamp>.md (+ latest.md copy, 30-day retention)

$ErrorActionPreference = 'Continue'
$RepoDir = 'C:\Users\songy\Homelab'
$Claude  = 'C:\Users\songy\.local\bin\claude.exe'
$LogDir  = Join-Path $env:USERPROFILE 'homelab-audits'
$Stamp   = Get-Date -Format 'yyyy-MM-dd_HHmm'
$Log     = Join-Path $LogDir "audit-$Stamp.md"

New-Item -ItemType Directory -Force $LogDir | Out-Null

$prompt = @'
You are the daily auditor for this homelab k3s cluster. You are strictly READ-ONLY: create, modify, and delete nothing.
Run these checks:
1) kubectl get nodes -o wide
2) kubectl -n argocd get applications
3) kubectl get pods -A (flag anything not Running/Completed and any restart count over 10)
4) kubectl get events -A --sort-by=.lastTimestamp | Select-Object -Last 25
5) kubectl top nodes; kubectl top pods -A --sort-by=memory | Select-Object -First 15
6) ssh debian.home "hostname; uptime; free -m; df -h /" and ssh k3s-worker-01 "hostname; uptime; free -m; df -h /"
7) For any error signature found, call search_knowledge with the exact error text; cite matching runbook paths.

Write the report to stdout ONLY (no file writes), in exactly this format:
# Homelab daily audit - <today's date>
## OK
- ...
## ANOMALIES
- ... (or "none")
## WATCHLIST
- ... (or "none")
The final line must be exactly "AUDIT-CLEAN" if there are no anomalies, otherwise "AUDIT-ATTENTION".
'@

Push-Location $RepoDir
$raw = "$Log.tmp"
try {
    # Prompt goes via stdin: PS 5.1 does not escape embedded quotes in native argv
    $prompt | & $Claude -p --max-budget-usd 1 2>&1 | Out-File -FilePath $raw -Encoding utf8
    $code = $LASTEXITCODE
} finally {
    Pop-Location
}
# Keep only the report body (claude emits warnings on stderr before the report)
$lines = @(Get-Content $raw)
$hit = $lines | Select-String -Pattern '^# Homelab daily audit' | Select-Object -First 1
if ($hit) { $lines[($hit.LineNumber - 1)..($lines.Count - 1)] | Out-File -FilePath $Log -Encoding utf8 }
else { Copy-Item $raw $Log -Force }
Remove-Item $raw -Force -ErrorAction SilentlyContinue
if ($code -ne 0) {
    Add-Content -Path $Log -Value "`nAUDIT FAILED (claude exited $code)"
}

if (-not (Test-Path $Log) -or (Get-Item $Log).Length -eq 0) {
    "AUDIT FAILED - claude produced no output at $Stamp" | Out-File $Log -Encoding utf8
}
Copy-Item $Log (Join-Path $LogDir 'latest.md') -Force

$needsAttention = Select-String -Path $Log -Pattern 'AUDIT-ATTENTION' -SimpleMatch -Quiet
if ($needsAttention) {
    Copy-Item $Log (Join-Path $LogDir 'PROBLEMS-latest.md') -Force
    # Best-effort toast notification (Task Scheduler runs this under Windows PowerShell 5.1)
    try {
        $null = [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime]
        $null = [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom, ContentType = WindowsRuntime]
        $xml = New-Object Windows.Data.Xml.Dom.XmlDocument
        $xml.LoadXml('<toast><visual><binding template="ToastText02"><text id="1">Homelab daily audit</text><text id="2">Anomalies found - see homelab-audits\PROBLEMS-latest.md</text></binding></visual></toast>')
        $toast = New-Object Windows.UI.Notifications.ToastNotification $xml
        [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('Microsoft.Windows.PowerShell').Show($toast)
    } catch { }
}

# 30-day retention
Get-ChildItem $LogDir -Filter 'audit-*.md' |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) } |
    Remove-Item -Force -Confirm:$false
