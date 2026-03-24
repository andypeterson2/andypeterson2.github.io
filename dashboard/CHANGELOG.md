# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [0.1.0] - 2026-03-19

### Added
- Flask web API for scanning projects and managing Docker services
- Textual TUI with tabbed interface, service cards, and live log streaming
- Project scanner: detects git status, languages, Docker/Compose configs
- `.dashboard.yaml` manifest format for per-project service definitions
- Docker Compose support for containerised deployment
- HTTPS support via optional dev certificates
- Auto-detection of free ports when preferred port is in use
- Health check endpoint (`/api/health`)
- Input validation and path traversal protection on all API endpoints
- CORS support for cross-origin frontends (e.g. GitHub Pages)

### Security
- Project/service names validated against strict allowlist pattern
- Resolved paths verified to stay within configured projects root
- Docker socket access documented with mitigations in SECURITY.md
