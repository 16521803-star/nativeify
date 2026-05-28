# scripts/start.ps1 — Start Nativeify on Windows
$ErrorActionPreference = "Stop"

Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host "                Starting Nativeify Studio                " -ForegroundColor Cyan
Write-Host "=========================================================" -ForegroundColor Cyan

# ── 1. Ensure Ollama is running ───────────────────────────────
Write-Host "[*] Checking if Ollama is running on port 11434..." -ForegroundColor Yellow
try {
    $ollamaResponse = Invoke-WebRequest -Uri "http://localhost:11434/" -UseBasicParsing -ErrorAction Stop
    Write-Host "[+] Ollama is running." -ForegroundColor Green
} catch {
    Write-Host "[!] Ollama service not detected. Attempting to start Ollama..." -ForegroundColor Yellow
    if (Get-Command ollama -ErrorAction SilentlyContinue) {
        Start-Process "ollama" -ArgumentList "serve" -NoNewWindow
        Start-Sleep -Seconds 3
        Write-Host "[+] Started Ollama background service." -ForegroundColor Green
    } else {
        Write-Warning "[-] Ollama executable not found. Correction features might not work."
    }
}

# ── 2. Launch FastAPI Backend ─────────────────────────────────
Write-Host "[*] Launching FastAPI Backend in a new window..." -ForegroundColor Yellow
$BackendDir = Join-Path $PSScriptRoot "..\backend"
$StartBackendCmd = "-NoExit -Command `"& '$BackendDir\.venv\Scripts\Activate.ps1'; cd '$BackendDir'; python -m uvicorn app.main:app --host 0.0.0.0 --port 8000`""

Start-Process powershell.exe -ArgumentList $StartBackendCmd -WorkingDirectory $BackendDir

# ── 3. Launch React Frontend ──────────────────────────────────
Write-Host "[*] Launching Vite Frontend in a new window..." -ForegroundColor Yellow
$FrontendDir = Join-Path $PSScriptRoot "..\frontend"
$StartFrontendCmd = "-NoExit -Command `"cd '$FrontendDir'; npm run dev`""

Start-Process powershell.exe -ArgumentList $StartFrontendCmd -WorkingDirectory $FrontendDir

Write-Host "`n=========================================================" -ForegroundColor Green
Write-Host " Nativeify is starting up!                               " -ForegroundColor Green
Write-Host " - Frontend: http://localhost:5173                       " -ForegroundColor Green
Write-Host " - Backend:  http://localhost:8000                       " -ForegroundColor Green
Write-Host " Close the opened console windows to stop the servers.   " -ForegroundColor Green
Write-Host "=========================================================" -ForegroundColor Green
