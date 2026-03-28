"""Shared CORS configuration for Flask apps."""

import os


def configure_cors(app, env_var: str = "CORS_ORIGINS", default: str = "http://localhost:*,https://andypeterson.dev"):
    """Apply CORS to a Flask app using an environment variable for origins."""
    from flask_cors import CORS
    origins = os.environ.get(env_var, default).split(",")
    CORS(app, origins=[o.strip() for o in origins])
