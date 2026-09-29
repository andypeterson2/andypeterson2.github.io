import { describe, test, expect } from 'vitest';
import { buildCircuit } from '../src/apps/nonogram/circuit';
import {
  drawCircuit,
  drawExpanded,
  expandedColumns,
  MAX_EXPANDED_COLUMNS,
} from '../src/apps/nonogram/diagram';

const SMALL = buildCircuit([[1], [1]], [[1], [1]]);

describe('Circuit diagram', () => {
  test('draws one wire per qubit on a small board', () => {
    const { body } = drawCircuit(SMALL);
    expect(body.match(/class="circ-wire"/g)).toHaveLength(SMALL.qubits);
    for (let q = 0; q < SMALL.qubits; q++) expect(body).toContain(`q[${String(q)}]`);
  });

  test('folds the oracle and the diffuser into named boxes', () => {
    // Expanded, one iteration of a 3x3 is already tens of gates. The listing carries
    // the contents; the drawing carries the shape.
    const { body } = drawCircuit(SMALL);
    expect(body).toContain('>Oracle<');
    expect(body).toContain('>Diffuser<');
  });

  test('states the iteration count instead of repeating the boxes', () => {
    const many = buildCircuit([[1], [1]], [[1], [1]], { iterations: 205887 });
    const { body } = drawCircuit(many);
    expect(body).toContain('205,887');
    expect(body.match(/>Oracle</g)).toHaveLength(1);
  });

  test('the oracle box says what it is built from, so two boards differ', () => {
    const marked = drawCircuit(SMALL).body;
    expect(marked).toContain('2 marked');

    const clues = Array.from({ length: 6 }, () => [1]);
    const lines = drawCircuit(buildCircuit(clues, clues)).body;
    expect(lines).toContain('12 lines');
  });

  test('a register too tall to draw collapses the middle and keeps both ends', () => {
    const clues = Array.from({ length: 6 }, () => [1]);
    const circuit = buildCircuit(clues, clues);
    const { body } = drawCircuit(circuit);
    expect(body).toContain('⋮');
    expect(body).toContain('q[0]');
    // The last cell and the last ancilla both stay visible.
    expect(body).toContain(`q[${String(circuit.problemQubits - 1)}]`);
    expect(body).toContain(`q[${String(circuit.qubits - 1)}]`);
  });

  test('only the cells are measured', () => {
    const clues = Array.from({ length: 6 }, () => [1]);
    const circuit = buildCircuit(clues, clues);
    expect(circuit.ancillas).toBeGreaterThan(0);
    const { body } = drawCircuit(circuit);
    const meters = body.match(/class="circ-meter" x1=/g) ?? [];
    // One per drawn cell wire, never one per ancilla.
    expect(meters.length).toBeLessThan(circuit.qubits);
    expect(meters.length).toBeGreaterThan(0);
  });

  test('carries no colour or font of its own', () => {
    // The 1-bit palette lives in the stylesheet, so the drawing carries no styling.
    const { body } = drawCircuit(SMALL);
    expect(body).not.toMatch(/#[0-9a-f]{3,6}/i);
    expect(body).not.toContain('font-family');
    expect(body).not.toContain('fill="');
  });

  test('reports a viewport big enough for what it drew', () => {
    const { width, height } = drawCircuit(SMALL);
    expect(width).toBeGreaterThan(100);
    expect(height).toBeGreaterThan(SMALL.qubits * 20);
  });
});

describe('Folded boxes are controls', () => {
  test('each folded step is pressable and names itself', () => {
    const { body } = drawCircuit(SMALL);
    expect(body).toContain('data-block="oracle"');
    expect(body).toContain('data-block="diffuser"');
    expect(body.match(/role="button"/g)).toHaveLength(2);
    expect(body.match(/tabindex="0"/g)).toHaveLength(2);
    expect(body).toContain('aria-pressed="false"');
  });

  test('the pinned box reports itself pressed', () => {
    const { body } = drawCircuit(SMALL, 'oracle');
    expect(body).toContain('aria-pressed="true"');
    expect(body).toContain('circ-pinned');
    // Only one at a time.
    expect(body.match(/circ-pinned/g)).toHaveLength(1);
  });
});

describe('The circuit written out', () => {
  test('marks where the oracle ends', () => {
    const { body } = drawExpanded(SMALL);
    expect(body).toContain('circ-guard');
    expect(body).toContain('>oracle<');
    expect(body).toContain('>diffuser<');
  });

  test('a multi-controlled gate is dots joined to its target', () => {
    const { body } = drawExpanded(SMALL);
    expect(body).toContain('circ-ctrl');
    // Z on the target rather than a plain box, so the gate reads as controlled.
    expect(body).toContain('>Z<');
  });

  test('gates that share no qubits share a column', () => {
    // The opening layer of a round packs into a single column.
    const circuit = buildCircuit([[1], [1]], [[1], [1]]);
    expect(expandedColumns(circuit)).toBeLessThan(circuit.round.length);
  });

  test('a board with no legible expansion is over the cap', () => {
    // The constraint oracle writes one multi-controlled gate per allowed pattern.
    const clues = Array.from({ length: 6 }, () => [1]);
    expect(expandedColumns(buildCircuit(clues, clues))).toBeGreaterThan(MAX_EXPANDED_COLUMNS);
    expect(expandedColumns(SMALL)).toBeLessThanOrEqual(MAX_EXPANDED_COLUMNS);
  });

  test('carries no colour or font of its own', () => {
    const { body } = drawExpanded(SMALL);
    expect(body).not.toMatch(/#[0-9a-f]{3,6}/i);
    expect(body).not.toContain('font-family');
  });
});
