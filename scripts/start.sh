#!/bin/bash
# scripts/start.sh — Start Nativeify on Unix/Linux/macOS

# Colors for output
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo -e "${CYAN}=========================================================${NC}"
echo -e "${CYAN}                Starting Nativeify Studio                ${NC}"
echo -e "${CYAN}=========================================================${NC}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="${SCRIPT_DIR}/../backend"
FRONTEND_DIR="${SCRIPT_DIR}/../frontend"

# ── 1. Ensure Ollama is running ───────────────────────────────
echo -e "${YELLOW}[*] Checking if Ollama is running...${NC}"
if curl -s -f http://localhost:11434/ > /dev/null; then
    echo -e "${GREEN}[+] Ollama is running.${NC}"
else
    echo -e "${YELLOW}[!] Ollama service not detected. Attempting to start Ollama...${NC}"
    if command -v ollama &>/dev/null; then
        ollama serve > /dev/null 2>&1 &
        sleep 3
        echo -e "${GREEN}[+] Started Ollama background service.${NC}"
    else
        echo -e "${YELLOW}[-] Ollama executable not found. Correction features might not work.${NC}"
    fi
fi

# Track background processes to kill on exit
pids=()

cleanup() {
    echo -e "\n${YELLOW}[*] Shutting down servers...${NC}"
    for pid in "${pids[@]}"; do
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid"
        fi
    done
    echo -e "${GREEN}[+] Shutdown complete.${NC}"
    exit 0
}

# Trap SIGINT (Control-C) and SIGTERM to run cleanup
trap cleanup SIGINT SIGTERM

# ── 2. Launch FastAPI Backend ─────────────────────────────────
echo -e "${YELLOW}[*] Starting FastAPI Backend...${NC}"
source "${BACKEND_DIR}/.venv/bin/activate"
cd "${BACKEND_DIR}"
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 &
pids+=($!)
cd - > /dev/null

# ── 3. Launch React Frontend ──────────────────────────────────
echo -e "${YELLOW}[*] Starting Vite Frontend...${NC}"
cd "${FRONTEND_DIR}"
npm run dev &
pids+=($!)
cd - > /dev/null

echo -e "\n${GREEN}=========================================================${NC}"
echo -e "${GREEN} Nativeify is starting up!                               ${NC}"
echo -e "${GREEN} - Frontend: http://localhost:5173                       ${NC}"
echo -e "${GREEN} - Backend:  http://localhost:8000                       ${NC}"
echo -e "${GREEN} Press Ctrl+C in this terminal to stop both servers.     ${NC}"
echo -e "${GREEN}=========================================================${NC}"

# Keep script running to maintain logs and wait for processes
wait
