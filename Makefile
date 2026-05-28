# =============================================================
#  Nativeify — Makefile
#  Unified commands for setup, development, testing, Docker.
#  Usage: make <target>
# =============================================================

.PHONY: help install install-backend install-frontend \
        backend frontend start \
        download-models \
        docker-up docker-down docker-build docker-logs \
        lint lint-backend lint-frontend \
        test test-backend \
        clean clean-output clean-all \
        env-setup

# Default target
.DEFAULT_GOAL := help

# ── Colors ───────────────────────────────────────────────
CYAN  := \033[0;36m
GREEN := \033[0;32m
RESET := \033[0m

# Detect OS for cross-platform support
ifeq ($(OS),Windows_NT)
    PYTHON     := python
    PIP        := backend\.venv\Scripts\pip
    UVICORN    := backend\.venv\Scripts\uvicorn
    RUFF       := backend\.venv\Scripts\ruff
    PYTEST     := backend\.venv\Scripts\pytest
    VENV_ACTIVATE := backend\.venv\Scripts\activate
    SEP        := \\
else
    PYTHON     := python3
    PIP        := backend/.venv/bin/pip
    UVICORN    := backend/.venv/bin/uvicorn
    RUFF       := backend/.venv/bin/ruff
    PYTEST     := backend/.venv/bin/pytest
    VENV_ACTIVATE := backend/.venv/bin/activate
    SEP        := /
endif

# ── Help ─────────────────────────────────────────────────
help: ## Show this help message
	@echo ""
	@echo "  Nativeify — Available Commands"
	@echo "  ================================"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  $(CYAN)%-20s$(RESET) %s\n", $$1, $$2}'
	@echo ""

# ── Setup ────────────────────────────────────────────────
install: install-backend install-frontend env-setup ## Install all dependencies (backend + frontend)
	@echo "$(GREEN)✅ Installation complete! Run 'make start' to launch.$(RESET)"

install-backend: ## Install Python backend dependencies
	@echo "$(CYAN)Setting up Python virtual environment...$(RESET)"
	$(PYTHON) -m venv backend/.venv
	$(PIP) install --upgrade pip
	$(PIP) install -r backend/requirements.txt
	@echo "$(GREEN)✅ Backend dependencies installed.$(RESET)"

install-frontend: ## Install Node frontend dependencies
	@echo "$(CYAN)Installing frontend dependencies...$(RESET)"
	cd frontend && npm install
	@echo "$(GREEN)✅ Frontend dependencies installed.$(RESET)"

env-setup: ## Copy .env.example to .env if .env doesn't exist
	@if not exist .env (copy .env.example .env && echo "$(GREEN)✅ Created .env from .env.example$(RESET)") else (echo "  .env already exists, skipping.")
	@if not exist backend\.env (copy backend\.env.example backend\.env && echo "$(GREEN)✅ Created backend/.env$(RESET)") else (echo "  backend/.env already exists, skipping.")

download-models: ## Download all AI models (Whisper, XTTS-v2, Ollama llama3.2:3b)
	@echo "$(CYAN)Downloading AI models — this may take a while...$(RESET)"
	$(PYTHON) scripts/download_models.py
	@echo "$(GREEN)✅ All models downloaded.$(RESET)"

# ── Development ──────────────────────────────────────────
backend: ## Start the FastAPI backend (port 8000, hot-reload)
	@echo "$(CYAN)Starting backend on http://localhost:8000 ...$(RESET)"
	cd backend && $(UVICORN) app.main:app --host 0.0.0.0 --port 8000 --reload

frontend: ## Start the React frontend dev server (port 3000)
	@echo "$(CYAN)Starting frontend on http://localhost:3000 ...$(RESET)"
	cd frontend && npm run dev

start: ## Start everything (backend + frontend) — Windows
ifeq ($(OS),Windows_NT)
	powershell -ExecutionPolicy Bypass -File scripts/start.ps1
else
	bash scripts/start.sh
endif

# ── Docker ───────────────────────────────────────────────
docker-build: ## Build Docker images
	docker compose -f docker/docker-compose.yml build

docker-up: ## Start all services via Docker Compose
	@echo "$(CYAN)Starting Docker services...$(RESET)"
	docker compose -f docker/docker-compose.yml up -d
	@echo "$(GREEN)✅ Services running. Backend: http://localhost:8000$(RESET)"

docker-down: ## Stop all Docker services
	docker compose -f docker/docker-compose.yml down

docker-logs: ## Tail Docker logs
	docker compose -f docker/docker-compose.yml logs -f

# ── Code Quality ─────────────────────────────────────────
lint: lint-backend lint-frontend ## Run all linters

lint-backend: ## Lint Python code with ruff
	@echo "$(CYAN)Linting backend...$(RESET)"
	$(RUFF) check backend/app/ --fix

lint-frontend: ## Lint TypeScript code with ESLint
	@echo "$(CYAN)Linting frontend...$(RESET)"
	cd frontend && npm run lint

# ── Tests ────────────────────────────────────────────────
test: test-backend ## Run all tests

test-backend: ## Run Python tests with pytest
	@echo "$(CYAN)Running backend tests...$(RESET)"
	$(PYTEST) backend/tests/ -v --tb=short

# ── Cleanup ──────────────────────────────────────────────
clean: ## Remove build artifacts and caches
	cd frontend && (if exist dist rd /s /q dist) & (if exist node_modules\.cache rd /s /q node_modules\.cache)
	cd backend && for /d /r . %%d in (__pycache__) do @if exist "%%d" rd /s /q "%%d"
	@echo "$(GREEN)✅ Cleaned build artifacts.$(RESET)"

clean-output: ## Remove all generated audio files from output/
	@if exist output (rd /s /q output && mkdir output)
	@echo "$(GREEN)✅ Cleared output directory.$(RESET)"

clean-all: clean clean-output ## Full clean (includes node_modules and .venv)
	cd frontend && (if exist node_modules rd /s /q node_modules)
	if exist backend\.venv rd /s /q backend\.venv
	@echo "$(GREEN)✅ Full clean complete.$(RESET)"
