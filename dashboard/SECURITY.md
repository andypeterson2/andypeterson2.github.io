# Security Policy

## Intended deployment context

Dashboard is designed for **local development use only**. It should run on a
developer's own machine or within a trusted local network. It is **not**
intended to be deployed on public-facing infrastructure.

## Docker socket access

The dashboard container mounts the host's Docker socket
(`/var/run/docker.sock`) to manage containers. This grants the container
**root-equivalent access** to the host's Docker daemon.

**Mitigations:**
- The compose file binds to `127.0.0.1` only — the service is not reachable
  from external networks by default.
- The projects directory is mounted read-only (`:ro`).
- Docker commands are constructed programmatically using list-based
  `subprocess` calls — never via shell interpolation.

## Network binding

The Flask server binds to `0.0.0.0` inside the container but the
`docker-compose.yml` maps the port to `127.0.0.1` on the host. This means
the dashboard is only accessible from localhost unless the compose file is
explicitly modified.

## TLS support

The server supports optional HTTPS via self-signed development certificates.
Set the `DEV_CERT_DIR` environment variable to a directory containing
`cert.pem` and `key.pem`.

To generate local dev certs:

```sh
mkdir -p .certs
openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout .certs/key.pem -out .certs/cert.pem \
  -days 365 -subj "/CN=localhost"
```

## Input validation

- All project and service names are validated against a strict allowlist
  pattern (`[a-zA-Z0-9._-]+`) before use in filesystem operations or
  subprocess commands.
- Path traversal is prevented by resolving candidate paths and verifying they
  remain within the configured projects root.
- The `tail` parameter for log requests is validated as an integer within
  bounds.

## Authentication

The dashboard does not currently implement authentication. Since it is
designed for local-only use, the trust boundary is the host machine. Adding
token-based authentication is a planned enhancement for environments where
the dashboard might be accessed over a local network.

## Reporting vulnerabilities

If you discover a security issue, please open a private issue or contact the
maintainer directly rather than filing a public issue.
