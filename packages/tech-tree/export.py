#!/usr/bin/env python3
"""
Export Obsidian vault concept notes with prereqs into a JSON tech tree.
Usage: python export.py [--vault PATH] [--output FILE] [--filter TAG]
"""

import argparse
import json
import os
import re
from pathlib import Path

DEFAULT_VAULT = Path(__file__).parent.parent
DEFAULT_OUTPUT = Path(__file__).parent / "data" / "qsvm.json"


def parse_frontmatter(content):
    """Extract frontmatter dict-like data from markdown content."""
    if not content.startswith("---"):
        return {}, content
    end = content.find("\n---", 3)
    if end == -1:
        return {}, content
    fm_text = content[4:end]
    body = content[end + 5:]  # skip \n---\n
    return fm_text, body


def extract_yaml_list(fm_text, field):
    """Extract a list field from YAML frontmatter text."""
    items = []
    in_field = False
    for line in fm_text.split("\n"):
        stripped = line.strip()
        if stripped.startswith(f"{field}:"):
            in_field = True
            rest = stripped[len(field) + 1:].strip()
            if rest.startswith("["):
                inner = rest.strip("[]")
                if inner:
                    items.extend(t.strip().strip('"').strip("'") for t in inner.split(",") if t.strip())
                in_field = False
            continue
        if in_field:
            if stripped.startswith("- "):
                val = stripped[2:].strip().strip('"').strip("'")
                if val:
                    items.append(val)
            elif stripped:
                in_field = False
    return items


def extract_wikilink_names(items):
    """Extract note names from wikilink strings like [[Note Name]] or [[path/Note|Display]]."""
    names = []
    for item in items:
        m = re.match(r'\[\[([^\]|]+)(?:\|[^\]]*)?\]\]', item)
        if m:
            name = m.group(1)
            # Strip path prefix if present
            if "/" in name:
                name = name.split("/")[-1]
            names.append(name)
        else:
            names.append(item)
    return names


def get_content_preview(body, max_chars=200):
    """Extract first meaningful sentence from body text."""
    # Strip footnotes, headings, blank lines
    lines = []
    for line in body.split("\n"):
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith("#"):
            continue
        if stripped.startswith("[^"):
            continue
        if stripped.startswith("$$"):
            continue
        if stripped.startswith("|"):
            continue
        lines.append(stripped)
        if len(" ".join(lines)) > max_chars:
            break
    text = " ".join(lines)
    if len(text) > max_chars:
        text = text[:max_chars].rsplit(" ", 1)[0] + "..."
    return text


def calculate_depths(nodes):
    """Calculate depth (longest path to root) for each node."""
    depths = {}
    prereqs_map = {n["id"]: n["prereqs"] for n in nodes}

    def depth(node_id, visited=None):
        if visited is None:
            visited = set()
        if node_id in depths:
            return depths[node_id]
        if node_id in visited:
            return 0  # cycle detected, break it
        visited.add(node_id)
        prereqs = prereqs_map.get(node_id, [])
        if not prereqs:
            depths[node_id] = 0
            return 0
        d = 1 + max(depth(p, visited) for p in prereqs if p in prereqs_map)
        depths[node_id] = d
        return d

    for n in nodes:
        depth(n["id"])

    return depths


def export_vault(vault_path, output_path, tag_filter=None):
    """Export concept notes with prereqs to JSON."""
    vault = Path(vault_path)
    nodes = []
    all_names = set()

    # Scan only root-level .md files (no subdirectories)
    for f in sorted(vault.iterdir()):
        if not f.is_file() or f.suffix != ".md":
            continue

        try:
            content = f.read_text(encoding="utf-8")
        except Exception:
            continue

        fm_text, body = parse_frontmatter(content)
        if not fm_text:
            continue

        tags = extract_yaml_list(fm_text, "tags")

        # Only include type/concept notes
        if "type/concept" not in tags:
            continue

        # Optional tag filter
        if tag_filter and tag_filter not in tags and not any(tag_filter in t for t in tags):
            continue

        name = f.stem
        prereqs_raw = extract_yaml_list(fm_text, "prereqs")
        prereqs = extract_wikilink_names(prereqs_raw)
        aliases_raw = extract_yaml_list(fm_text, "aliases")
        sources_raw = extract_yaml_list(fm_text, "sources")
        sources = extract_wikilink_names(sources_raw)

        preview = get_content_preview(body)

        nodes.append({
            "id": name,
            "aliases": aliases_raw,
            "prereqs": prereqs,
            "tags": tags,
            "sources": sources,
            "content_preview": preview,
        })
        all_names.add(name)

    # Calculate depths
    depths = calculate_depths(nodes)
    for n in nodes:
        n["depth"] = depths.get(n["id"], 0)

    # Build edges
    edges = []
    for n in nodes:
        for p in n["prereqs"]:
            if p in all_names:
                edges.append({"from": p, "to": n["id"]})

    # Sort by depth then name
    nodes.sort(key=lambda n: (n["depth"], n["id"]))

    # Compute unlocks (reverse edges)
    unlocks_map = {}
    for e in edges:
        unlocks_map.setdefault(e["from"], []).append(e["to"])
    for n in nodes:
        n["unlocks"] = sorted(unlocks_map.get(n["id"], []))

    root_nodes = [n["id"] for n in nodes if n["depth"] == 0]
    max_depth = max((n["depth"] for n in nodes), default=0)

    output = {
        "nodes": nodes,
        "edges": edges,
        "metadata": {
            "total_nodes": len(nodes),
            "total_edges": len(edges),
            "max_depth": max_depth,
            "root_nodes": root_nodes,
            "depth_distribution": {},
        }
    }

    # Depth distribution
    for d in range(max_depth + 1):
        count = sum(1 for n in nodes if n["depth"] == d)
        output["metadata"]["depth_distribution"][str(d)] = count

    # Write
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(output, indent=2), encoding="utf-8")
    print(f"Exported {len(nodes)} nodes, {len(edges)} edges to {output_path}")
    print(f"Max depth: {max_depth}")
    print(f"Root nodes: {len(root_nodes)}")
    print(f"Depth distribution: {output['metadata']['depth_distribution']}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Export Obsidian vault to tech tree JSON")
    parser.add_argument("--vault", default=str(DEFAULT_VAULT), help="Path to vault")
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT), help="Output JSON path")
    parser.add_argument("--filter", default=None, help="Only include notes with this tag")
    args = parser.parse_args()
    export_vault(args.vault, args.output, args.filter)
