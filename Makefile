.PHONY: dev tui test lint format docker

dev:
	python -m dashboard.web

tui:
	python -m dashboard

test:
	pytest --tb=short -q

lint:
	ruff check src/ tests/
	ruff format --check src/ tests/

format:
	ruff format src/ tests/

docker:
	docker compose up --build
