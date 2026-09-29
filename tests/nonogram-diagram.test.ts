import { describe, test, expect } from 'vitest';
import { buildCircuit } from '../src/apps/nonogram/circuit';
import {
  drawCircuit,
  ghostBlock,
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

  test('an opened block reports itself pressed', () => {
    const { body } = drawCircuit(SMALL, new Set(['oracle']));
    expect(body).toContain('aria-pressed="true"');
    // One open, one still folded.
    expect(body.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(body.match(/aria-pressed="false"/g)).toHaveLength(1);
  });

  test('every block says what it is made of, folded or open', () => {
    const folded = drawCircuit(SMALL).body;
    const open = drawCircuit(SMALL, new Set(['oracle', 'diffuser'])).body;
    for (const body of [folded, open]) {
      expect(body).toContain('<title>Oracle \u2014 the X pattern spells the grid being marked');
      expect(body).toContain('<title>Diffuser \u2014 the same for every puzzle');
    }
  });
});

describe('A block written out in place', () => {
  const open = (blocks: ('oracle' | 'diffuser')[]) => drawCircuit(SMALL, new Set(blocks));

  test('replaces the folded box with a dashed frame around its gates', () => {
    const { body } = open(['oracle']);
    expect(body).toContain('circ-frame');
    // A multi-controlled gate is dots joined to a Z on the target.
    expect(body).toContain('circ-ctrl');
    expect(body).toContain('>Z<');
  });

  test('leaves the other block folded', () => {
    const { body } = open(['oracle']);
    expect(body.match(/circ-frame/g)).toHaveLength(1);
  });

  test('takes the room its gates need', () => {
    const folded = drawCircuit(SMALL);
    const wide = open(['oracle']);
    expect(wide.blocks.oracle.width).toBeGreaterThan(folded.blocks.oracle.width);
    expect(wide.width).toBeGreaterThan(folded.width);
    // Opening one block moves the next one along, and nothing above it.
    expect(wide.blocks.diffuser.x).toBeGreaterThan(folded.blocks.diffuser.x);
    expect(wide.blocks.oracle.x).toBe(folded.blocks.oracle.x);
  });

  test('gates that share no qubits share a column', () => {
    // The opening flips of a round pack into a single column.
    const wide = open(['oracle']);
    const columns = (wide.blocks.oracle.width - 30) / 32;
    expect(columns).toBeLessThan(SMALL.oracle.length);
  });

  test('a copy for the animation draws either form on its own', () => {
    expect(ghostBlock(SMALL, 'oracle', 100, false)).toContain('circ-box');
    expect(ghostBlock(SMALL, 'oracle', 100, true)).toContain('circ-frame');
    expect(ghostBlock(SMALL, 'oracle', 100, true)).toContain('circ-ghost-block');
  });

  test('carries no colour or font of its own', () => {
    const { body } = open(['oracle', 'diffuser']);
    expect(body).not.toMatch(/#[0-9a-f]{3,6}/i);
    expect(body).not.toContain('font-family');
  });
});
