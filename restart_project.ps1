Write-Host "Starting Virtual Clinic Services... [$(Get-Date)]"

# Check ports
$backendEnv = @{ "USE_MOCK_VOICE" = "false" }
$portsToCheck = @(7071, 10000, 3000)
$portsBusy = $false
foreach ($p in $portsToCheck) {
    if (Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue) {
        Write-Host "Port $p is in use."
        $portsBusy = $true
    }
}

if ($portsBusy) {
    Write-Host "One or more ports are busy. Running cleanup..."
    .\kill_services.ps1
    # Small pause to ensure ports are freed
    Start-Sleep -Seconds 2
} else {
    Write-Host "Ports are clear."
}

# Clear debug logs
Write-Host "Clearing debug logs..."
if (-not (Test-Path "log")) { New-Item -ItemType Directory -Path "log" -Force }
Clear-Content "log/debug.log" -ErrorAction SilentlyContinue
Clear-Content "log/app.log" -ErrorAction SilentlyContinue

# Start Backend (Azure Functions + Azurite)
Write-Host "Launching Backend (backend/functions)..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$Host.UI.RawUI.WindowTitle = 'ViKi Backend'; cd backend/functions; npm start | Tee-Object -FilePath ../../log/backend.log"

# Start Frontend (Next.js Portal)
Write-Host "Launching Frontend (frontend/portal)..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$Host.UI.RawUI.WindowTitle = 'ViKi Frontend'; cd frontend/portal; npm run dev | Tee-Object -FilePath ../../log/frontend.log"

Write-Host "Services launched in separate windows. [$(Get-Date)]"
