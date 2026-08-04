#!/usr/bin/env python3
"""Generate the nonogram quantum GALLERY — real solver output, served with no backend.

Runs the nonogram project's OWN benchmark endpoint in-process (classical brute force +
the Qiskit statevector Grover simulator) over a few curated puzzles, and writes each
result to ``public/nonogram/gallery/<slug>.json`` in exactly the payload shape the app's
``App.renderBenchmark()`` already consumes. The app can then show real quantum output —
probability histogram, solutions, metrics — with nothing running and nothing to pay for.

This is the "spend once, show forever" cache. The same file format receives real IBM
HARDWARE results later: run the hardware job once (token as a Fly secret), then drop its
payload in here with ``"source": "ibm-hardware"`` and the gallery renders it unchanged.

Needs the nonogram repo and its virtualenv (qiskit):

    ~/Projects/nonogram/.venv/bin/python scripts/export-nonogram-gallery.py

Override the repo location with NONOGRAM_REPO.
"""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

REPO = Path(os.environ.get("NONOGRAM_REPO", Path.home() / "Projects" / "nonogram")).expanduser()
sys.path.insert(0, str(REPO))

OUT = Path(__file__).resolve().parent.parent / "public" / "nonogram" / "gallery"

# Curated puzzles: small enough that the statevector Grover simulation is quick, but
# structured enough to show real interference. Clues are the run-length encoding of a
# real grid, so each is guaranteed solvable.
PUZZLES = [
    {
        "slug": "diagonal-2x2",
        "label": "2×2 diagonal",
        "note": "The same shape validated on real IBM hardware — 32.3% on the correct state vs 6.25% by chance.",
        "row_clues": [[1], [1]],
        "col_clues": [[1], [1]],
    },
    {
        "slug": "corner-2x3",
        "label": "2×3 corner",
        "note": "Six qubits, a single satisfying grid — Grover concentrates almost all amplitude on it.",
        "row_clues": [[1], [3]],
        "col_clues": [[2], [1], [1]],
    },
    {
        "slug": "plus-3x3",
        "label": "3×3 plus",
        "note": "Nine qubits (512 basis states) — the largest the in-page simulator handles comfortably.",
        "row_clues": [[1], [3], [1]],
        "col_clues": [[1], [3], [1]],
    },
]


def build_app():
    """Build the nonogram Flask app in-process (mirrors the repo's own test fixture)."""
    from flask import Flask
    from flask_socketio import SocketIO

    from tools import state as app_state
    from tools.config import MAX_CONTENT_LENGTH
    from tools.routes import ALL_BLUEPRINTS

    app = Flask(__name__)
    app.config["TESTING"] = True
    app.config["SECRET_KEY"] = "gallery"
    app.config["MAX_CONTENT_LENGTH"] = MAX_CONTENT_LENGTH

    sio = SocketIO(app, async_mode="threading")
    app_state.init(sio)
    for bp in ALL_BLUEPRINTS:
        app.register_blueprint(bp)
    app_state.state.update({"busy": False, "hw_config": None})
    return app


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    client = build_app().test_client()

    index = []
    for p in PUZZLES:
        t0 = time.perf_counter()
        resp = client.post(
            "/api/benchmark/sync",
            json={"row_clues": p["row_clues"], "col_clues": p["col_clues"], "trials": 1},
        )
        if resp.status_code != 200:
            print(f"  !! {p['slug']}: HTTP {resp.status_code} {resp.get_data(as_text=True)[:200]}")
            continue

        payload = resp.get_json()
        # Provenance so the UI can state exactly where the numbers came from.
        payload["source"] = "local-simulator"  # → "ibm-hardware" for a real hardware run
        payload["label"] = p["label"]
        payload["note"] = p["note"]
        payload.pop("chart_img", None)  # server-rendered PNG; the web UI draws its own SVG

        path = OUT / f"{p['slug']}.json"
        path.write_text(json.dumps(payload))
        sols = len(payload.get("solutions") or [])
        outcomes = len(payload.get("qu_counts") or {})
        print(
            f"  {p['slug']:<14} {sols} solution(s), {outcomes} quantum outcomes, "
            f"{path.stat().st_size // 1024} KB, {time.perf_counter() - t0:.1f}s"
        )
        index.append(
            {
                "slug": p["slug"],
                "label": p["label"],
                "note": p["note"],
                "rows": payload["rows"],
                "cols": payload["cols"],
                "source": payload["source"],
            }
        )

    (OUT / "index.json").write_text(json.dumps(index))
    print(f"wrote {len(index)} entries + index.json → {OUT}")


if __name__ == "__main__":
    main()
