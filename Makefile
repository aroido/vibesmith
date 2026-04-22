# VibeSmith Makefile
# Monorepo development automation

# Colors for output
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[0;33m
RED := \033[0;31m
NC := \033[0m # No Color

# Project paths
CORE_DIR := packages/core
API_DIR := packages/api
WEB_DIR := packages/web
DESKTOP_DIR := packages/desktop
LANDING_DIR := packages/landing

# Python settings
PYTHON := python3
VENV_DIR := .venv
VENV_PYTHON := $(VENV_DIR)/bin/python
VENV_PIP := $(VENV_DIR)/bin/pip
VENV_PYTEST := $(VENV_DIR)/bin/pytest

# Use venv if it exists, otherwise use system Python
ifneq ($(wildcard $(VENV_DIR)/bin/python),)
	PIP := $(VENV_PIP)
	PYTEST := $(VENV_PYTEST)
	PYTHON_ENV := source $(VENV_DIR)/bin/activate &&
else
	PIP := pip3
	PYTEST := pytest
	PYTHON_ENV :=
endif

# Node settings
NPM := npm

.PHONY: help check venv setup install install-core install-api install-web install-desktop \
        dev dev-api dev-web dev-desktop dev-desktop-internal dev-parallel kill-ports \
        test test-core test-api test-web test-all test-cov \
        lint lint-python lint-web format format-python format-web \
        ai-verify-fast ai-verify-full ai-finish \
        clean clean-python clean-web clean-desktop clean-all clean-venv \
        build build-web build-desktop build-api-executable test-api-executable \
        dist-desktop dist-desktop-mac dist-desktop-mac-internal dist-desktop-win dist-desktop-linux \
        release release-alpha release-beta release-patch release-minor release-major \
        docs docs-check docs-tree docs-stats \
        info

# Default target
.DEFAULT_GOAL := help

help: ## Show this help message
	@echo "$(BLUE)VibeSmith Development Commands$(NC)"
	@echo "$(BLUE)===============================$(NC)"
	@echo ""
	@echo "$(GREEN)Setup & Installation:$(NC)"
	@grep -E '^(setup|check|install.*):.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-20s$(NC) %s\n", $$1, $$2}'
	@echo ""
	@echo "$(GREEN)Development:$(NC)"
	@grep -E '^(dev.*|kill-ports):.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-20s$(NC) %s\n", $$1, $$2}'
	@echo ""
	@echo "$(GREEN)Testing:$(NC)"
	@grep -E '^(test.*):.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-20s$(NC) %s\n", $$1, $$2}'
	@echo ""
	@echo "$(GREEN)Code Quality:$(NC)"
	@grep -E '^(lint.*|format.*):.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-20s$(NC) %s\n", $$1, $$2}'
	@echo ""
	@echo "$(GREEN)AI Workflow:$(NC)"
	@grep -E '^(ai-verify-fast|ai-verify-full|ai-finish):.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-20s$(NC) %s\n", $$1, $$2}'
	@echo ""
	@echo "$(GREEN)Cleanup & Build:$(NC)"
	@grep -E '^(clean.*|build.*):.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-20s$(NC) %s\n", $$1, $$2}'
	@echo ""
	@echo "$(GREEN)Info:$(NC)"
	@grep -E '^(info):.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-20s$(NC) %s\n", $$1, $$2}'

# ============================================================================
# Setup & Installation
# ============================================================================

check: ## Check system requirements (Python, Node.js)
	@echo "$(BLUE)Checking system requirements...$(NC)"
	@command -v $(PYTHON) >/dev/null 2>&1 || { echo "$(RED)Python 3 is required but not installed.$(NC)"; exit 1; }
	@$(PYTHON) --version | grep -q "Python 3\.1[1-9]" || { echo "$(RED)Python 3.11+ is required$(NC)"; exit 1; }
	@echo "$(GREEN)✓ Python: $$($(PYTHON) --version)$(NC)"
	@command -v node >/dev/null 2>&1 || { echo "$(RED)Node.js is required but not installed.$(NC)"; exit 1; }
	@echo "$(GREEN)✓ Node.js: $$(node --version)$(NC)"
	@command -v $(NPM) >/dev/null 2>&1 || { echo "$(RED)npm is required but not installed.$(NC)"; exit 1; }
	@echo "$(GREEN)✓ npm: $$($(NPM) --version)$(NC)"
	@echo "$(GREEN)All requirements satisfied!$(NC)"

venv: ## Create Python virtual environment
	@if [ -d "$(VENV_DIR)" ]; then \
		echo "$(YELLOW)Virtual environment already exists at $(VENV_DIR)$(NC)"; \
	else \
		echo "$(BLUE)Creating virtual environment...$(NC)"; \
		$(PYTHON) -m venv $(VENV_DIR); \
		echo "$(GREEN)✓ Virtual environment created at $(VENV_DIR)$(NC)"; \
		echo "$(YELLOW)To activate manually: source $(VENV_DIR)/bin/activate$(NC)"; \
	fi

setup: check venv install ## Initial setup (check + venv + install)
	@echo ""
	@echo "$(GREEN)✓ Setup complete!$(NC)"
	@echo "$(YELLOW)Next steps:$(NC)"
	@echo "  1. source $(VENV_DIR)/bin/activate  # Activate venv"
	@echo "  2. make dev                          # Start development"

install: install-core install-api install-web install-desktop install-landing ## Install all packages

install-core: ## Install core package (editable)
	@if [ ! -d "$(VENV_DIR)" ]; then \
		echo "$(RED)Virtual environment not found. Run 'make venv' first.$(NC)"; \
		exit 1; \
	fi
	@echo "$(BLUE)Installing core package...$(NC)"
	@$(VENV_PIP) install -e $(CORE_DIR)[dev]
	@echo "$(GREEN)✓ Core package installed$(NC)"

install-api: install-core ## Install API package (editable, requires core)
	@echo "$(BLUE)Installing API package...$(NC)"
	@$(VENV_PIP) install -e $(API_DIR)[dev]
	@echo "$(GREEN)✓ API package installed$(NC)"

install-web: ## Install web dependencies
	@echo "$(BLUE)Installing web dependencies...$(NC)"
	@cd $(WEB_DIR) && $(NPM) install
	@echo "$(GREEN)✓ Web dependencies installed$(NC)"

install-desktop: install-web ## Install desktop dependencies (requires web)
	@echo "$(BLUE)Installing desktop dependencies...$(NC)"
	@cd $(DESKTOP_DIR) && $(NPM) install
	@echo "$(GREEN)✓ Desktop dependencies installed$(NC)"

install-landing: ## Install landing page dependencies
	@echo "$(BLUE)Installing landing dependencies...$(NC)"
	@cd $(LANDING_DIR) && $(NPM) install
	@echo "$(GREEN)✓ Landing dependencies installed$(NC)"

# ============================================================================
# Development Servers
# ============================================================================

kill-ports: ## Kill processes on development ports (8000, 5173)
	@echo "$(BLUE)Checking for processes on ports 8000 and 5173...$(NC)"
	@API_PID=$$(lsof -ti:8000 2>/dev/null); \
	if [ -n "$$API_PID" ]; then \
		echo "$(YELLOW)Killing process on port 8000 (PID: $$API_PID)...$(NC)"; \
		kill -9 $$API_PID 2>/dev/null || true; \
		echo "$(GREEN)✓ Port 8000 freed$(NC)"; \
	else \
		echo "$(GREEN)✓ Port 8000 is available$(NC)"; \
	fi
	@WEB_PID=$$(lsof -ti:5173 2>/dev/null); \
	if [ -n "$$WEB_PID" ]; then \
		echo "$(YELLOW)Killing process on port 5173 (PID: $$WEB_PID)...$(NC)"; \
		kill -9 $$WEB_PID 2>/dev/null || true; \
		echo "$(GREEN)✓ Port 5173 freed$(NC)"; \
	else \
		echo "$(GREEN)✓ Port 5173 is available$(NC)"; \
	fi

check-deps: ## Check and update dependencies if needed
	@echo "$(BLUE)Checking dependencies...$(NC)"
	@# Python 의존성 체크 (pyproject.toml 변경 감지)
	@if [ -f "$(CORE_DIR)/pyproject.toml" ]; then \
		if [ ! -f ".deps-core.md5" ] || ! md5sum -c .deps-core.md5 >/dev/null 2>&1; then \
			echo "$(YELLOW)📦 Core 의존성 변경 감지 - 재설치 중...$(NC)"; \
			$(MAKE) install-core; \
			md5sum $(CORE_DIR)/pyproject.toml > .deps-core.md5; \
		fi; \
	fi
	@if [ -f "$(API_DIR)/pyproject.toml" ]; then \
		if [ ! -f ".deps-api.md5" ] || ! md5sum -c .deps-api.md5 >/dev/null 2>&1; then \
			echo "$(YELLOW)📦 API 의존성 변경 감지 - 재설치 중...$(NC)"; \
			$(MAKE) install-api; \
			md5sum $(API_DIR)/pyproject.toml > .deps-api.md5; \
		fi; \
	fi
	@# Node 의존성 체크 (package.json 변경 감지)
	@if [ -f "$(WEB_DIR)/package.json" ]; then \
		if [ ! -f ".deps-web.md5" ] || ! md5sum -c .deps-web.md5 >/dev/null 2>&1; then \
			echo "$(YELLOW)📦 Web 의존성 변경 감지 - 재설치 중...$(NC)"; \
			$(MAKE) install-web; \
			md5sum $(WEB_DIR)/package.json > .deps-web.md5; \
		fi; \
	fi
	@echo "$(GREEN)✓ 의존성 체크 완료$(NC)"

dev: kill-ports check-deps ## Run both API and web dev servers (parallel)
	@echo "$(BLUE)Starting VibeSmith development servers...$(NC)"
	@echo "$(YELLOW)API:  http://localhost:8000$(NC)"
	@echo "$(YELLOW)Web:  http://localhost:5173$(NC)"
	@echo "$(YELLOW)Docs: http://localhost:8000/docs$(NC)"
	@echo ""
	@trap 'kill 0' EXIT; \
	$(MAKE) dev-api & \
	$(MAKE) dev-web & \
	wait

dev-api: check-deps ## Run API dev server only (with dependency check)
	@if [ ! -d "$(VENV_DIR)" ]; then \
		echo "$(RED)Virtual environment not found. Run 'make setup' first.$(NC)"; \
		exit 1; \
	fi
	@echo "$(BLUE)Starting API server...$(NC)"
	@cd $(API_DIR) && ../../$(VENV_DIR)/bin/uvicorn vibesmith_api.main:app --reload --port 8000

dev-web: check-deps ## Run web dev server only (with dependency check)
	@echo "$(BLUE)Starting web dev server...$(NC)"
	@cd $(WEB_DIR) && $(NPM) run dev

dev-landing: ## Run landing page dev server (port 3000)
	@echo "$(BLUE)Starting landing dev server...$(NC)"
	@cd $(LANDING_DIR) && $(NPM) run dev

dev-desktop: build-web ## Run desktop app (requires web build)
	@echo "$(BLUE)Starting desktop app...$(NC)"
	@cd $(DESKTOP_DIR) && $(NPM) run dev

dev-desktop-internal: build-web ## Run desktop app in internal debug flavor
	@echo "$(BLUE)Starting desktop app (internal debug flavor)...$(NC)"
	@cd $(DESKTOP_DIR) && VIBESMITH_BUILD_FLAVOR=internal $(NPM) run dev

# ============================================================================
# Testing
# ============================================================================

test: test-core test-api ## Run Python tests (core + api)

test-core: ## Run core package tests
	@echo "$(BLUE)Running core tests...$(NC)"
	@cd $(CORE_DIR) && ../../$(VENV_PYTEST) -v

test-api: ## Run API tests
	@echo "$(BLUE)Running API tests...$(NC)"
	@cd $(API_DIR) && ../../$(VENV_PYTEST) -v

test-web: ## Run web tests (vitest)
	@echo "$(BLUE)Running web tests...$(NC)"
	@cd $(WEB_DIR) && $(NPM) run test

test-all: test test-web ## Run all tests (Python + web)

test-cov: ## Run tests with coverage report
	@echo "$(BLUE)Running tests with coverage...$(NC)"
	@cd $(CORE_DIR) && ../../$(VENV_PYTEST) --cov=vibesmith_core --cov-report=html --cov-report=term
	@cd $(API_DIR) && ../../$(VENV_PYTEST) --cov=vibesmith_api --cov-report=html --cov-report=term
	@echo "$(GREEN)Coverage reports generated in htmlcov/$(NC)"

# ============================================================================
# Code Quality
# ============================================================================

lint: lint-python lint-web ## Run all linters

lint-python: ## Lint Python code (ruff)
	@echo "$(BLUE)Linting Python code...$(NC)"
	@cd $(CORE_DIR) && ../../$(VENV_DIR)/bin/ruff check .
	@cd $(API_DIR) && ../../$(VENV_DIR)/bin/ruff check .
	@echo "$(GREEN)✓ Python linting complete$(NC)"

lint-web: ## Lint web code (eslint)
	@echo "$(BLUE)Linting web code...$(NC)"
	@cd $(WEB_DIR) && $(NPM) run lint
	@echo "$(GREEN)✓ Web linting complete$(NC)"

format: format-python format-web ## Format all code

format-python: ## Format Python code (ruff)
	@echo "$(BLUE)Formatting Python code...$(NC)"
	@cd $(CORE_DIR) && ../../$(VENV_DIR)/bin/ruff format .
	@cd $(API_DIR) && ../../$(VENV_DIR)/bin/ruff format .
	@echo "$(GREEN)✓ Python formatting complete$(NC)"

format-web: ## Format web code (prettier via eslint)
	@echo "$(BLUE)Formatting web code...$(NC)"
	@cd $(WEB_DIR) && $(NPM) run lint -- --fix
	@echo "$(GREEN)✓ Web formatting complete$(NC)"

# ============================================================================
# AI Workflow
# ============================================================================

ai-verify-fast: ## Run fast AI verification profile
	@./scripts/run-ai-verify --mode fast

ai-verify-full: ## Run full AI verification profile
	@./scripts/run-ai-verify --mode full

ai-finish: ## Finish AI task (usage: make ai-finish ISSUE=123 MSG=\"feat: ...\" [AUTO_MERGE=1] [TARGET=main])
	@if [ -z "$(ISSUE)" ] || [ -z "$(MSG)" ]; then \
		echo "$(RED)ISSUE and MSG are required$(NC)"; \
		echo "Example: make ai-finish ISSUE=123 MSG=\"feat: implement x\" AUTO_MERGE=1"; \
		exit 1; \
	fi
	@AUTO_FLAG=""; \
	if [ "$(AUTO_MERGE)" = "1" ]; then AUTO_FLAG="--auto-merge"; fi; \
	TARGET_BRANCH="$(if $(TARGET),$(TARGET),main)"; \
	./scripts/ai-finish-task --issue "$(ISSUE)" --commit-msg "$(MSG)" --target "$$TARGET_BRANCH" $$AUTO_FLAG

# ============================================================================
# Cleanup
# ============================================================================

clean: clean-python clean-web ## Clean all build artifacts

clean-python: ## Clean Python build artifacts
	@echo "$(BLUE)Cleaning Python artifacts...$(NC)"
	@find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	@find . -type d -name "*.egg-info" -exec rm -rf {} + 2>/dev/null || true
	@find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	@find . -type d -name ".ruff_cache" -exec rm -rf {} + 2>/dev/null || true
	@find . -type d -name "htmlcov" -exec rm -rf {} + 2>/dev/null || true
	@find . -type f -name ".coverage" -delete 2>/dev/null || true
	@echo "$(GREEN)✓ Python artifacts cleaned$(NC)"

clean-web: ## Clean web build artifacts
	@echo "$(BLUE)Cleaning web artifacts...$(NC)"
	@rm -rf $(WEB_DIR)/dist
	@rm -rf $(WEB_DIR)/node_modules/.vite
	@echo "$(GREEN)✓ Web artifacts cleaned$(NC)"

clean-desktop: ## Clean desktop build artifacts
	@echo "$(BLUE)Cleaning desktop artifacts...$(NC)"
	@rm -rf $(DESKTOP_DIR)/dist
	@rm -rf $(DESKTOP_DIR)/dist-electron
	@rm -rf $(DESKTOP_DIR)/build
	@echo "$(GREEN)✓ Desktop artifacts cleaned$(NC)"

clean-venv: ## Remove virtual environment
	@echo "$(YELLOW)Removing virtual environment...$(NC)"
	@rm -rf $(VENV_DIR)
	@echo "$(GREEN)✓ Virtual environment removed$(NC)"

clean-all: clean clean-venv ## Clean everything including venv and node_modules
	@echo "$(YELLOW)Removing node_modules...$(NC)"
	@rm -rf $(WEB_DIR)/node_modules
	@echo "$(GREEN)✓ All artifacts cleaned$(NC)"

# ============================================================================
# Build
# ============================================================================

build-web: ## Build web for production
	@echo "$(BLUE)Building web for production...$(NC)"
	@cd $(WEB_DIR) && $(NPM) run build
	@echo "$(GREEN)✓ Web build complete: $(WEB_DIR)/dist$(NC)"

build-landing: ## Build landing page for production
	@echo "$(BLUE)Building landing page...$(NC)"
	@cd $(LANDING_DIR) && $(NPM) run build
	@echo "$(GREEN)✓ Landing build complete: $(LANDING_DIR)/.next$(NC)"

build-desktop: build-web ## Build desktop app (requires web build)
	@echo "$(BLUE)Building desktop app...$(NC)"
	@cd $(DESKTOP_DIR) && $(NPM) run build
	@echo "$(GREEN)✓ Desktop build complete$(NC)"

build-api-executable: ## Build FastAPI executable with PyInstaller
	@echo "$(BLUE)Building FastAPI executable...$(NC)"
	@cd $(API_DIR) && python3 build_api_executable.py
	@echo "$(GREEN)✓ API executable built: $(API_DIR)/dist/vibesmith-api$(NC)"

test-api-executable: ## Test API executable
	@echo "$(BLUE)Testing API executable...$(NC)"
	@cd $(API_DIR)/dist && ./vibesmith-api &
	@sleep 3
	@curl -s http://localhost:8000/api/projects | head -20 || echo "$(RED)API test failed$(NC)"
	@pkill -f vibesmith-api || true
	@echo "$(GREEN)✓ API executable test complete$(NC)"

dist-desktop: build-web build-api-executable ## Package desktop app for all platforms (with API)
	@echo "$(BLUE)Packaging desktop app for all platforms...$(NC)"
	@cd $(DESKTOP_DIR) && $(NPM) run dist
	@echo "$(GREEN)✓ Desktop packages created: $(DESKTOP_DIR)/release$(NC)"

dist-desktop-mac: build-web build-api-executable ## Package desktop app for macOS (with API)
	@echo "$(BLUE)Packaging desktop app for macOS...$(NC)"
	@cd $(DESKTOP_DIR) && $(NPM) run dist:mac
	@echo "$(GREEN)✓ macOS package created: $(DESKTOP_DIR)/release$(NC)"

dist-desktop-mac-internal: ## Package unsigned macOS app for internal testing
	@echo "$(BLUE)Packaging desktop app for macOS (internal debug flavor, unsigned)...$(NC)"
	@cd $(DESKTOP_DIR) && $(NPM) run dist:mac:internal
	@echo "$(GREEN)✓ internal macOS package created: $(DESKTOP_DIR)/release$(NC)"

dist-desktop-win: build-web build-api-executable ## Package desktop app for Windows (with API)
	@echo "$(BLUE)Packaging desktop app for Windows...$(NC)"
	@cd $(DESKTOP_DIR) && $(NPM) run dist:win
	@echo "$(GREEN)✓ Windows package created: $(DESKTOP_DIR)/release$(NC)"

dist-desktop-linux: build-web build-api-executable ## Package desktop app for Linux (with API)
	@echo "$(BLUE)Packaging desktop app for Linux...$(NC)"
	@cd $(DESKTOP_DIR) && $(NPM) run dist:linux
	@echo "$(GREEN)✓ Linux package created: $(DESKTOP_DIR)/release$(NC)"

# ============================================================================
# Release Automation
# ============================================================================

release: ## Interactive release (guided)
	@echo "$(BLUE)Preparing GitHub release workflow...$(NC)"
	@if [ -z "$(TAG)" ]; then \
		echo "$(YELLOW)Usage: make release TAG=v0.5.3$(NC)"; \
		echo "$(YELLOW)Then push the tag to trigger the GitHub 'Release Desktop' workflow.$(NC)"; \
		exit 1; \
	fi
	@echo "$(GREEN)Release tag ready: $(TAG)$(NC)"
	@echo "$(YELLOW)Next step: git push origin $(TAG) and monitor the GitHub release workflow for assets/Homebrew alias publishing.$(NC)"

release-alpha: ## Release alpha version
	@echo "$(YELLOW)Deprecated target. Use: make release TAG=vX.Y.Z-alpha.N$(NC)"
	@exit 1

release-beta: ## Release beta version
	@echo "$(YELLOW)Deprecated target. Use: make release TAG=vX.Y.Z-beta.N$(NC)"
	@exit 1

release-patch: ## Release patch version (0.1.0 → 0.1.1)
	@echo "$(YELLOW)Deprecated target. Tag explicitly: make release TAG=vX.Y.Z$(NC)"
	@exit 1

release-minor: ## Release minor version (0.1.0 → 0.2.0)
	@echo "$(YELLOW)Deprecated target. Tag explicitly: make release TAG=vX.Y.Z$(NC)"
	@exit 1

release-major: ## Release major version (0.1.0 → 1.0.0)
	@echo "$(YELLOW)Deprecated target. Tag explicitly: make release TAG=vX.Y.Z$(NC)"
	@exit 1

# ============================================================================
# Documentation
# ============================================================================

generate-openapi: ## Generate OpenAPI JSON from FastAPI app (docs/api/openapi.json)
	@echo "$(BLUE)Generating OpenAPI schema...$(NC)"
	@$(PYTHON_ENV) $(PYTHON) scripts/generate-openapi.py
	@echo "$(GREEN)✓ OpenAPI schema written to docs/api/openapi.json$(NC)"

docs: ## Open documentation in browser
	@echo "$(BLUE)Opening documentation...$(NC)"
	@open docs/README.md || xdg-open docs/README.md || echo "$(YELLOW)Please open docs/README.md manually$(NC)"

docs-check: ## Check documentation structure and links
	@echo "$(BLUE)Checking documentation...$(NC)"
	@echo ""
	@echo "$(GREEN)Checking file naming (kebab-case):$(NC)"
	@find docs -name "*.md" | while read file; do \
		basename="$$(basename $$file)"; \
		if ! echo "$$basename" | grep -qE '^[a-z0-9-]+\.md$$|^README\.md$$|^REORGANIZATION\.md$$'; then \
			echo "  $(RED)✗$(NC) $$file (should be kebab-case)"; \
		fi; \
	done
	@echo ""
	@echo "$(GREEN)Checking for files in root (should be in categories):$(NC)"
	@find docs -maxdepth 1 -name "*.md" ! -name "README.md" ! -name "INSTALLATION.md" | while read file; do \
		echo "  $(RED)✗$(NC) $$file (should be in a category folder)"; \
	done || echo "  $(GREEN)✓$(NC) All files properly categorized"
	@echo ""
	@echo "$(GREEN)Checking category READMEs:$(NC)"
	@echo "  $(GREEN)✓$(NC) docs/README.md"
	@echo ""
	@echo "$(GREEN)✓ Documentation check complete$(NC)"

docs-tree: ## Show documentation tree structure
	@echo "$(BLUE)Documentation Structure:$(NC)"
	@tree docs -L 2 -I '.cursor|node_modules|.git' --dirsfirst

docs-stats: ## Show documentation statistics
	@echo "$(BLUE)Documentation Statistics:$(NC)"
	@echo "$(BLUE)========================$(NC)"
	@echo ""
	@echo "$(GREEN)Total files:$(NC)       $$(find docs -type f -name '*.md' | wc -l)"
	@echo "$(GREEN)Total folders:$(NC)     $$(find docs -type d | wc -l)"
	@echo ""
	@echo "$(GREEN)By category:$(NC)"
	@for dir in .; do \
		count=$$(find docs/$$dir -type f -name '*.md' 2>/dev/null | wc -l); \
		printf "  %-15s %2d files\n" "$$dir:" "$$count"; \
	done
	@echo ""
	@echo "$(GREEN)README files:$(NC)      $$(find docs -name 'README.md' | wc -l)"

# ============================================================================
# Info
# ============================================================================

info: ## Show project information
	@echo "$(BLUE)VibeSmith Project Information$(NC)"
	@echo "$(BLUE)=============================$(NC)"
	@echo ""
	@echo "$(GREEN)Project Structure:$(NC)"
	@echo "  Core:    $(CORE_DIR)"
	@echo "  API:     $(API_DIR)"
	@echo "  Web:     $(WEB_DIR)"
	@echo "  Desktop: $(DESKTOP_DIR)"
	@echo ""
	@echo "$(GREEN)Python Environment:$(NC)"
	@if [ -d "$(VENV_DIR)" ]; then \
		echo "  Venv:   $(GREEN)✓ Active$(NC) ($(VENV_DIR))"; \
		$(VENV_PYTHON) --version 2>/dev/null | sed 's/^/  Python: /' || echo "  Python: $(RED)Error$(NC)"; \
	else \
		echo "  Venv:   $(YELLOW)Not created$(NC) (run 'make venv')"; \
		$(PYTHON) --version 2>/dev/null | sed 's/^/  System: /' || echo "  System: $(RED)Not installed$(NC)"; \
	fi
	@echo ""
	@echo "$(GREEN)Node Environment:$(NC)"
	@node --version 2>/dev/null | sed 's/^/  Node.js: /' || echo "  Node.js: $(RED)Not installed$(NC)"
	@$(NPM) --version 2>/dev/null | sed 's/^/  npm:     /' || echo "  npm: $(RED)Not installed$(NC)"
	@echo ""
	@echo "$(GREEN)Quick Start:$(NC)"
	@echo "  1. make setup    # First time setup"
	@echo "  2. make dev      # Start development servers"
	@echo "  3. make test-all # Run all tests"
