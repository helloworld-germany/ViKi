Write-Host "Compiling Backend (backend/functions)..." -ForegroundColor Cyan
Push-Location "backend/functions"
try {
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Backend build failed!"
        exit 1
    }
} finally {
    Pop-Location
}

Write-Host "Compiling Frontend (frontend/portal)..." -ForegroundColor Cyan
Push-Location "frontend/portal"
try {
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Frontend build failed!"
        exit 1
    }
} finally {
    Pop-Location
}

Write-Host "Recompilation Complete." -ForegroundColor Green
