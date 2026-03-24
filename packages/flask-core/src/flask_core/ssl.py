"""Shared SSL/TLS context discovery for development certificates."""

import os
from pathlib import Path


def get_ssl_context(
    search_dirs: list[Path] | None = None,
) -> tuple[str, str] | None:
    """Find and return an SSL context tuple (cert, key) or None.

    Searches DEV_CERT_DIR env var first, then the provided directories.
    """
    dirs = []
    env_dir = os.environ.get("DEV_CERT_DIR", "")
    if env_dir:
        dirs.append(Path(env_dir))
    if search_dirs:
        dirs.extend(search_dirs)

    for d in dirs:
        cert, key = d / "cert.pem", d / "key.pem"
        if cert.is_file() and key.is_file():
            return (str(cert), str(key))
    return None
