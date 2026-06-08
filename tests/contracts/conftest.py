"""Live-HTTP API contract tests.

Each test module points its ``<SERVICE>_URL`` env var (``CV_EDITOR_URL`` /
``NONOGRAM_URL`` / ``CLASSIFIERS_URL`` / ``QVC_SIGNALING_URL``) at a running
backend and validates real HTTP responses against the JSON Schemas in
``docs/api-contract/schemas/``. Tests auto-skip when the service is unreachable,
so the suite is safe to run with only some backends up.

Requires ``jsonschema`` (the suite skips entirely if it is not installed).

Run, e.g.::

    NONOGRAM_URL=http://127.0.0.1:5055 python -m pytest tests/contracts/ -v
"""
