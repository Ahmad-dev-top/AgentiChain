param(
  [string]$ApiBase = "http://127.0.0.1:8000"
)

$root = Split-Path -Parent $PSScriptRoot
if (-not $PSScriptRoot) {
  $root = "d:\AgentiChain"
}

Write-Host "Starting FastAPI at $ApiBase"
Set-Location "$root\backend"
if (-not (Test-Path ".\.venv\Scripts\python.exe")) {
  throw "Create the backend venv first: py -3.11 -m venv .venv && .\.venv\Scripts\python.exe -m pip install -r requirements.txt"
}

Start-Process -FilePath ".\.venv\Scripts\python.exe" -ArgumentList "-m uvicorn app.main:app --host 127.0.0.1 --port 8000" -WorkingDirectory "$root\backend"
Start-Sleep -Seconds 2

Set-Location "$root\apps\agentichain"
if (Get-Command flutter -ErrorAction SilentlyContinue) {
  flutter create . --project-name agentichain --org com.agentichain --platforms=web,android,windows
  flutter pub get
  flutter run -d chrome --dart-define=API_BASE=$ApiBase
} else {
  Write-Host "Flutter SDK is not on PATH. Install Flutter, then run:"
  Write-Host "  cd $root\apps\agentichain"
  Write-Host "  flutter create . --project-name agentichain --org com.agentichain --platforms=web,android,windows"
  Write-Host "  flutter run -d chrome --dart-define=API_BASE=$ApiBase"
}
