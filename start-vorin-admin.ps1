Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$python = Join-Path $repoRoot ".venv\Scripts\python.exe"
$manage = Join-Path $repoRoot "example_project\manage.py"
$hostAddress = "127.0.0.1"
$port = 8002

if (-not (Test-Path $python)) {
    throw "Python virtualenv not found at $python"
}

if (-not (Test-Path $manage)) {
    throw "manage.py not found at $manage"
}

$listener = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
    Where-Object { $_.LocalPort -eq $port } |
    Select-Object -First 1

if ($listener) {
    throw "Port $port is already in use by PID $($listener.OwningProcess)"
}

Set-Location (Join-Path $repoRoot "example_project")
Write-Host "Starting Vorin Admin dev server on http://$hostAddress`:$port/admin/login/" -ForegroundColor Cyan
& $python $manage runserver "$hostAddress`:$port"
