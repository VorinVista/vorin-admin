Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$port = 8002
$listeners = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
    Where-Object { $_.LocalPort -eq $port }

if (-not $listeners) {
    Write-Host "No process is listening on port $port." -ForegroundColor Yellow
    exit 0
}

$pids = $listeners | Select-Object -ExpandProperty OwningProcess -Unique
foreach ($pidValue in $pids) {
    try {
        Stop-Process -Id $pidValue -Force
        Write-Host "Stopped PID $pidValue on port $port." -ForegroundColor Green
    }
    catch {
        Write-Warning "Failed to stop PID $pidValue: $($_.Exception.Message)"
    }
}
