# Holand Platform — Makefile
# Usage: make <target>

.PHONY: help dev dev-api dev-web build test lint clean db-up db-down \
        db-migrate db-seed db-reset logs api-shell

# ── Config ─────────────────────────────────────────────────────────────────
API_DIR   := apps/api
WEB_DIR   := apps/web
VENV      := $(API_DIR)/.venv
PYTHON    := $(VENV)/bin/python
PIP       := $(VENV)/bin/pip
ALEMBIC   := $(VENV)/bin/alembic

# ── Help ───────────────────────────────────────────────────────────────────
help:
	@echo ""
	@echo "  Holand Platform — Available Commands"
	@echo "  ─────────────────────────────────────"
	@echo "  make dev          Start all services (Docker + hot-reload)"
	@echo "  make dev-api      Start FastAPI only (needs DB running)"
	@echo "  make dev-web      Start Next.js only"
	@echo "  make build        Build all Docker images"
	@echo "  make test         Run all tests (API + Web)"
	@echo "  make test-api     Run API pytest tests"
	@echo "  make test-web     Run Web vitest tests"
	@echo "  make test-e2e     Run Playwright e2e tests"
	@echo "  make lint         Lint all code (ruff + eslint)"
	@echo "  make db-up        Start Postgres + Redis containers only"
	@echo "  make db-down      Stop Postgres + Redis containers"
	@echo "  make db-migrate   Run Alembic migrations (upgrade head)"
	@echo "  make db-seed      Run database seed scripts"
	@echo "  make db-reset     Drop + recreate DB + migrate + seed"
	@echo "  make logs         Tail logs for all services"
	@echo "  make api-shell    Open Python shell inside API venv"
	@echo "  make clean        Remove build artifacts and caches"
	@echo ""

# ── Dev ────────────────────────────────────────────────────────────────────
dev:
	docker compose up --build

dev-detached:
	docker compose up --build -d

dev-api: $(VENV)
	cd $(API_DIR) && \
	  $(ALEMBIC) upgrade head && \
	  $(VENV)/bin/uvicorn app.main:app --reload --port 8000

dev-web:
	cd $(WEB_DIR) && pnpm dev

# ── Build ──────────────────────────────────────────────────────────────────
build:
	docker compose build

# ── Tests ──────────────────────────────────────────────────────────────────
test: test-api test-web

test-api: $(VENV)
	cd $(API_DIR) && $(VENV)/bin/pytest tests/ -v --tb=short

test-web:
	cd $(WEB_DIR) && pnpm test

test-e2e:
	cd $(WEB_DIR) && pnpm test:e2e

# ── Lint ───────────────────────────────────────────────────────────────────
lint: lint-api lint-web

lint-api: $(VENV)
	cd $(API_DIR) && $(VENV)/bin/ruff check . && $(VENV)/bin/ruff format --check .

lint-web:
	cd $(WEB_DIR) && pnpm lint

# ── Database ───────────────────────────────────────────────────────────────
db-up:
	docker compose up -d postgres redis

db-down:
	docker compose stop postgres redis

db-migrate: $(VENV)
	cd $(API_DIR) && $(ALEMBIC) upgrade head

db-seed: $(VENV)
	cd $(API_DIR) && $(PYTHON) -m app.scripts.seed

db-reset: db-down
	docker compose rm -f postgres
	docker compose up -d postgres
	@echo "Waiting for postgres to be ready..."
	sleep 3
	$(MAKE) db-migrate
	$(MAKE) db-seed

# ── Utilities ──────────────────────────────────────────────────────────────
logs:
	docker compose logs -f

api-shell: $(VENV)
	cd $(API_DIR) && $(PYTHON)

clean:
	cd $(WEB_DIR) && pnpm clean
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .pytest_cache -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .ruff_cache -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete 2>/dev/null || true

# ── Venv bootstrap ─────────────────────────────────────────────────────────
$(VENV):
	python -m venv $(VENV)
	$(PIP) install --upgrade pip
	$(PIP) install -r $(API_DIR)/requirements.txt
