"""Contract tests require backend dependencies (Flask, etc.).

These tests import directly from backend packages and validate API
response shapes. They require Python 3.10+ because the backend code
uses PEP 604 union types (e.g., `str | None`).

Run with: python -m pytest tests/contracts/ -v
Skip on CI if backend deps are not installed.
"""
