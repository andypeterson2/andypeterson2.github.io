# Contributing

## Development setup

```sh
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev,tui]"
pre-commit install
```

## Code style

This project uses [ruff](https://docs.astral.sh/ruff/) for linting and
formatting. Configuration is in `pyproject.toml`.

```sh
ruff check src/ tests/      # lint
ruff format src/ tests/      # format
mypy src/                    # type check
```

## Running tests

```sh
pytest                       # all tests (Docker tests skip if unavailable)
pytest --cov=dashboard       # with coverage report
```

## Pull request conventions

- Create a feature branch from `main`.
- Keep commits focused and use conventional commit messages
  (`feat:`, `fix:`, `refactor:`, `docs:`, `ci:`, `test:`).
- Ensure `ruff check`, `ruff format --check`, and `pytest` all pass before
  opening a PR.
