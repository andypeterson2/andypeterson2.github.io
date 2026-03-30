.PHONY: help setup install test test-py test-js lint lint-py lint-js build \
        docker-build docker-up docker-down clean

PYTHON_PROJECTS := packages/quantum-protein-kernel
JS_PROJECTS     := packages/ui-kit packages/cv/editor packages/nonogram/website packages/qvc

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
	  awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

setup: ## Initial setup: submodules + deps
	git submodule update --init --recursive
	@$(MAKE) --no-print-directory install

install: ## Install all dependencies
	npm ci
	@for dir in $(JS_PROJECTS); do \
	  if [ -f "$$dir/package.json" ]; then \
	    echo "→ npm ci in $$dir"; (cd "$$dir" && npm ci --silent 2>/dev/null || true); \
	  fi; \
	done
	pip install -e packages/flask-core
	@for dir in $(PYTHON_PROJECTS); do \
	  echo "→ pip install -e $$dir"; pip install -e "$$dir[dev]"; \
	done
	@echo "\n✓ Dependencies installed."

test: test-py test-js ## Run all tests

test-py: ## Python tests (pytest)
	@fail=0; for dir in $(PYTHON_PROJECTS); do \
	  echo "\n=== pytest $$dir ==="; \
	  (cd "$$dir" && python -m pytest tests/ -v --tb=short) || fail=1; \
	done; exit $$fail

test-js: ## JavaScript tests (jest/vitest)
	npm test
	@fail=0; for dir in $(JS_PROJECTS); do \
	  if [ -f "$$dir/package.json" ] && grep -q '"test"' "$$dir/package.json"; then \
	    echo "\n=== test $$dir ==="; (cd "$$dir" && npm test) || fail=1; \
	  fi; \
	done; exit $$fail

lint: lint-py lint-js ## Lint everything

lint-py: ## Ruff lint
	ruff check packages/quantum-protein-kernel/classifiers packages/flask-core/src

lint-js: ## ESLint (if configured)
	npm run lint

build: ## Build Astro site
	npm run build

test-%: ## Test a single project (e.g. make test-dashboard)
	@if [ -f "$*/pyproject.toml" ]; then (cd "$*" && python -m pytest tests/ -v); \
	elif [ -f "$*/package.json" ]; then (cd "$*" && npm test); \
	else echo "No test config found for $*"; fi

docker-build: ## Build all Docker images
	docker compose build

docker-up: ## Start all services
	docker compose up -d

docker-down: ## Stop all services
	docker compose down

clean: ## Remove build artifacts
	rm -rf dist .astro
	find . -maxdepth 3 -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -maxdepth 3 -type d -name .pytest_cache -exec rm -rf {} + 2>/dev/null || true
	@echo "✓ Cleaned."
