# Tech Tree

Interactive knowledge graph visualization for exploring technical concepts, their prerequisites, and learning paths. Built as a canvas-based skill tree where nodes represent concepts and edges represent prerequisite relationships.

## Overview

Tech Tree renders a directed acyclic graph of ~1,900 concepts spanning quantum computing, networking, systems engineering, cybersecurity, and more. Concepts are organized by depth (distance from root nodes) and laid out in columns, with edges showing prerequisite dependencies.

Key capabilities:

- **Learn and track** — double-click any node to mark it as learned; progress persists in `localStorage`
- **Target a concept** — select a target and the tree highlights the shortest prerequisite path, showing exactly what you need to learn first
- **Study guide** — generate a topologically-sorted study plan for any target concept and export it as Markdown
- **Search and filter** — filter by name, show only unlocked nodes, or isolate the path to your target
- **Dark / light theme** — toggle between themes with the sidebar button

## Running Locally

```bash
# Option 1: Node.js
node serve.mjs
# → http://localhost:8080

# Option 2: Docker
docker compose up
# → http://localhost:8080
```

No build step or dependencies required — the app is vanilla HTML, CSS, and JavaScript.

## Data Format

Concept data lives in `data/qsvm.json`. Each node follows this schema:

```json
{
  "id": "quantum circuit",
  "aliases": ["circuit"],
  "prereqs": ["quantum gate", "qubit"],
  "depth": 2,
  "tags": ["type/concept"],
  "unlocks": ["Qiskit", "quantum algorithm"],
  "sources": ["https://..."],
  "content_preview": "First ~200 chars of concept description"
}
```

| Field | Description |
|-------|-------------|
| `id` | Unique concept name (primary key) |
| `aliases` | Alternative names for search matching |
| `prereqs` | Array of concept IDs that must be learned first |
| `depth` | Longest path from any root node (computed by `export.py`) |
| `unlocks` | Concepts that this node enables (computed from reverse prereqs) |
| `tags` | Classification tags (e.g., `type/concept`) |
| `sources` | Reference URLs |
| `content_preview` | Truncated description from source material |

## Architecture

```
tech-tree/
├── website/
│   ├── index.html        # Main UI: sidebar + canvas
│   └── style.css         # Layout and theme styles (references ui-kit)
├── data/
│   └── qsvm.json         # Knowledge graph (~1,900 nodes, ~130 edges)
├── app.js                # Visualization engine (canvas rendering, layout, interaction)
├── export.py             # Data pipeline: Obsidian vault → qsvm.json
├── serve.mjs             # Static file server (Node.js)
├── docker-compose.yml    # Docker deployment config
├── tests/
│   └── test_data.mjs     # Data integrity tests (JSON schema, duplicate IDs, ref consistency)
└── .dashboard.yaml       # Dashboard service registration
```

### Rendering pipeline

1. `loadData()` fetches `data/qsvm.json` and builds an in-memory node map
2. `layoutNodes()` groups nodes by depth and arranges them in a column layout
3. `render()` draws the graph on an HTML5 Canvas via `requestAnimationFrame`
4. Nodes are color-coded by state: locked (gray), unlocked (green), learned (bright green), target path (gold/blue)

### Data pipeline

`export.py` reads Markdown notes from an Obsidian vault, extracts YAML frontmatter (`prereqs`, `tags`), computes depths via longest-path BFS, and writes the JSON graph to `data/qsvm.json`.

## Tests

```bash
node tests/test_data.mjs
```

Validates JSON parsing, required fields, duplicate detection, prerequisite reference integrity, and file size limits.

## Tech Stack

- **Frontend:** Vanilla JavaScript, HTML5 Canvas, CSS custom properties
- **Serving:** Node.js static file server
- **Data source:** Obsidian vault (Markdown + YAML frontmatter)
- **Styling:** UI Kit shared component library
