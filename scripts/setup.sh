#!/bin/bash
# scripts/setup.sh — Unix/Linux Setup Script for Nativeify
set -e

# Colors for output
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${CYAN}=========================================================${NC}"
echo -e "${CYAN}               Nativeify Unix Setup Script               ${NC}"
echo -e "${CYAN}=========================================================${NC}"

# ── 1. Check Prerequisites ────────────────────────────────────
echo -e "${YELLOW}[*] Checking prerequisites...${NC}"

# Check Python
if command -v python3 &>/dev/null; then
    PYTHON_VERSION=$(python3 --version)
    echo -e "${GREEN}[+] Python found: ${PYTHON_VERSION}${NC}"
else
    echo -e "${RED}[-] Python 3 is required but not installed.${NC}"
    exit 1
fi

# Check Node.js
if command -v node &>/dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}[+] Node.js found: ${NODE_VERSION}${NC}"
else
    echo -e "${RED}[-] Node.js is required but not installed.${NC}"
    exit 1
fi

# Check FFmpeg
if command -v ffmpeg &>/dev/null; then
    FFMPEG_VERSION=$(ffmpeg -version | head -n 1)
    echo -e "${GREEN}[+] FFmpeg found: ${FFMPEG_VERSION}${NC}"
else
    echo -e "${YELLOW}[-] FFmpeg was not found. Audio conversions might fail.${NC}"
    echo -e "    Please install ffmpeg via your package manager (e.g. apt install ffmpeg / brew install ffmpeg)"
fi

# Check Ollama
if command -v ollama &>/dev/null; then
    OLLAMA_VERSION=$(ollama --version)
    echo -e "${GREEN}[+] Ollama found: ${OLLAMA_VERSION}${NC}"
else
    echo -e "${YELLOW}[-] Ollama was not found.${NC}"
    echo -e "    Please download Ollama from https://ollama.com to enable grammar correction."
fi

# ── 2. Create Python Virtual Environment ──────────────────────
echo -e "\n${YELLOW}[*] Setting up Python virtual environment...${NC}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="${SCRIPT_DIR}/../backend/.venv"

if [ -d "$VENV_DIR" ]; then
    echo -e "${GREEN}[+] Virtual environment already exists at ${VENV_DIR}${NC}"
else
    python3 -m venv "$VENV_DIR"
    echo -e "${GREEN}[+] Virtual environment created successfully.${NC}"
fi

# Activate virtual environment
source "${VENV_DIR}/bin/activate"

# Upgrade pip
echo -e "${YELLOW}[*] Upgrading pip...${NC}"
python -m pip install --upgrade pip

# Install dependencies
echo -e "${YELLOW}[*] Installing Python dependencies (this might take a few minutes)...${NC}"
pip install -r "${SCRIPT_DIR}/../backend/requirements.txt"

# ── 3. Pull Ollama Model ──────────────────────────────────────
if command -v ollama &>/dev/null; then
    echo -e "\n${YELLOW}[*] Pulling Ollama grammar correction model (llama3.2:3b)...${NC}"
    ollama pull llama3.2:3b || echo -e "${YELLOW}[-] Could not pull model. Is the Ollama daemon running?${NC}"
fi

# ── 4. Pre-download AI Models ─────────────────────────────────
echo -e "\n${YELLOW}[*] Pre-downloading Whisper and XTTS models...${NC}"
python "${SCRIPT_DIR}/download_models.py"

# ── 5. Install Frontend Dependencies ─────────────────────────
echo -e "\n${YELLOW}[*] Installing frontend Node.js packages...${NC}"
cd "${SCRIPT_DIR}/../frontend"
npm install
cd - > /dev/null

echo -e "\n${GREEN}=========================================================${NC}"
echo -e "${GREEN} Setup Complete! You can now start Nativeify by running:  ${NC}"
echo -e "${GREEN} Bash: ./scripts/start.sh                                ${NC}"
echo -e "${GREEN}=========================================================${NC}"
