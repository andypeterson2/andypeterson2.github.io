/**
 * Data integrity tests for the tech tree knowledge graph.
 * Run: node --test tests/test_data.mjs
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.resolve(__dirname, '..', 'data', 'qsvm.json');

let data;

describe('Tech tree data', () => {
  test('data/qsvm.json is valid JSON', () => {
    const raw = fs.readFileSync(DATA_PATH, 'utf-8');
    data = JSON.parse(raw);
    assert.ok(data, 'should parse successfully');
  });

  test('all nodes have required fields', () => {
    if (!data) data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
    // data could be { nodes: [...] } or an array directly
    const nodes = Array.isArray(data) ? data : (data.nodes || data.concepts || Object.values(data));
    assert.ok(nodes.length > 0, 'should have at least one node');
    for (const node of nodes) {
      assert.ok(node.id !== undefined || node.name !== undefined,
        `node should have id or name: ${JSON.stringify(node).slice(0, 100)}`);
    }
  });

  test('no duplicate node IDs', () => {
    if (!data) data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
    const nodes = Array.isArray(data) ? data : (data.nodes || data.concepts || Object.values(data));
    const ids = nodes.map(n => n.id || n.name).filter(Boolean);
    const unique = new Set(ids);
    assert.equal(ids.length, unique.size, `found ${ids.length - unique.size} duplicate IDs`);
  });

  test('all prerequisite references point to existing nodes', () => {
    if (!data) data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
    const nodes = Array.isArray(data) ? data : (data.nodes || data.concepts || Object.values(data));
    const ids = new Set(nodes.map(n => n.id || n.name).filter(Boolean));
    for (const node of nodes) {
      const prereqs = node.prereqs || node.prerequisites || node.depends || [];
      for (const p of prereqs) {
        const pid = typeof p === 'string' ? p : p.id || p.name;
        assert.ok(ids.has(pid), `node "${node.id || node.name}" references unknown prereq "${pid}"`);
      }
    }
  });

  test('file is under 2MB', () => {
    const stats = fs.statSync(DATA_PATH);
    assert.ok(stats.size < 2 * 1024 * 1024, `data file is ${(stats.size / 1024).toFixed(0)}KB, should be under 2MB`);
  });
});
