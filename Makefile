.PHONY: help setup install test test-e2e lint build clean

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
	  awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

setup: install ## Initial setup (install dependencies; requires Node >=22)

install: ## Install dependencies
	npm ci

test: ## Run unit tests (vitest)
	npm test

test-e2e: ## Run end-to-end tests (playwright)
	npm run test:e2e

lint: ## Lint (eslint + prettier + stylelint + ruff for scripts/*.py)
	npm run lint
	ruff check .

build: ## Build the Astro site
	npm run build

clean: ## Remove build artifacts
	rm -rf dist .astro
	@echo "✓ Cleaned."
