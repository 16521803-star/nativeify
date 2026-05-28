# scripts/setup.ps1 — Windows Setup Script for Nativeify
$ErrorActionPreference = "Stop"

Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host "              Nativeify Windows Setup Script             " -ForegroundColor Cyan
Write-Host "=========================================================" -ForegroundColor Cyan

# ── 1. Check Prerequisites ────────────────────────────────────
Write-Host "[*] Checking prerequisites..." -ForegroundColor Yellow

# Check Python
try {
    $pythonVersion = python --version 2>&1
    Write-Host "[+] Python found: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Error "[-] Python 3.10+ is required but not found in PATH."
}

# Check Node.js
try {
    $nodeVersion = node --version 2>&1
    Write-Host "[+] Node.js found: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Error "[-] Node.js is required but not found in PATH."
}

# Check FFmpeg
try {
    $ffmpegVersion = ffmpeg -version 2>&1
    $firstLine = ($ffmpegVersion -split '\r?\n')[0]
    Write-Host "[+] FFmpeg found: $firstLine" -ForegroundColor Green
} catch {
    Write-Warning "[-] FFmpeg was not found in PATH. Audio conversions may fail."
    Write-Warning "    Please install FFmpeg and add it to your System PATH."
}

# Check Ollama
try {
    $ollamaVersion = ollama --version 2>&1
    Write-Host "[+] Ollama found: $ollamaVersion" -ForegroundColor Green
} catch {
    Write-Warning "[-] Ollama was not found in PATH."
    Write-Warning "    Please download Ollama from https://ollama.com to enable grammar correction."
}

# ── 2. Create Python Virtual Environment ──────────────────────
Write-Host "`n[*] Setting up Python virtual environment..." -ForegroundColor Yellow
$VenvPath = Join-Path $PSScriptRoot "..\backend\.venv"

if (Test-Path $VenvPath) {
    Write-Host "[+] Virtual environment already exists at $VenvPath" -ForegroundColor Green
} else {
    python -m venv $VenvPath
    Write-Host "[+] Virtual environment created successfully." -ForegroundColor Green
}

# Activate virtual environment
$ActivateScript = Join-Path $VenvPath "Scripts\Activate.ps1"
& $ActivateScript

# Upgrade pip
Write-Host "[*] Upgrading pip..." -ForegroundColor Yellow
python -m pip install --upgrade pip

# Install dependencies
Write-Host "[*] Installing Python dependencies (this might take a few minutes)..." -ForegroundColor Yellow
$ReqPath = Join-Path $PSScriptRoot "..\backend\requirements.txt"
pip install -r $ReqPath

# ── 3. Pull Ollama Model ──────────────────────────────────────
if (Get-Command ollama -ErrorAction SilentlyContinue) {
    Write-Host "`n[*] Pulling Ollama grammar correction model (llama3.2:3b)..." -ForegroundColor Yellow
    try {
        ollama pull llama3.2:3b
        Write-Host "[+] Ollama model llama3.2:3b pulled successfully." -ForegroundColor Green
    } catch {
        Write-Warning "[-] Could not pull model from Ollama. Make sure the Ollama desktop app is running."
    }
}

# ── 4. Pre-download AI Models ─────────────────────────────────
Write-Host "`n[*] Pre-downloading Whisper and XTTS models..." -ForegroundColor Yellow
$DownloaderScript = Join-Path $PSScriptRoot "download_models.py"
python $DownloaderScript

# ── 5. Install Frontend Dependencies ─────────────────────────
Write-Host "`n[*] Installing frontend Node.js packages..." -ForegroundColor Yellow
$FrontendPath = Join-Path $PSScriptRoot "..\frontend"
Push-Location $FrontendPath
npm install
Pop-Location
Write-Host "[+] Frontend packages installed successfully." -ForegroundColor Green

Write-Host "`n=========================================================" -ForegroundColor Green
Write-Host " Setup Complete! You can now start Nativeify by running:  " -ForegroundColor Green
Write-Host " PowerShell: .\scripts\start.ps1                         " -ForegroundColor Green
Write-Host "=========================================================" -ForegroundColor Green
