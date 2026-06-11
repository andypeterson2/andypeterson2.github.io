.PHONY: help setup install test test-e2e lint build vendor \
        docker-build docker-up docker-down clean

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

lint: ## Lint (eslint + prettier + stylelint)
	npm run lint

build: ## Build the Astro site
	npm run build

vendor: ## Refresh all vendored app frontends from their repos
	scripts/vendor-app.sh all

docker-build: ## Build the portal Docker image
	docker compose build

docker-up: ## Start the portal dev container (profile: dev)
	docker compose --profile dev up -d

docker-down: ## Stop containers
	docker compose down

clean: ## Remove build artifacts
	rm -rf dist .astro
	@echo "✓ Cleaned."
