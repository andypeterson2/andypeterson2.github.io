import { describe, test, expect } from 'vitest';
import { buildCircuit } from '../src/apps/nonogram/circuit';
import { exportCircuit, toQasm3, toQiskit } from '../src/apps/nonogram/export';

const ROWS = [[1], [1]];
const COLS = [[1], [1]];

describe('Qiskit export', () => {
  const circuit = buildCircuit(ROWS, COLS);
  const src = toQiskit(circuit);

  test('never reaches for PhaseOracleGate', () => {
    // Qiskit synthesises that by walking all 2^n assignments, so a pasted script
    // would stall before emitting a gate. The whole export exists to avoid it.
    expect(src).not.toContain('PhaseOracleGate');
    expect(src).not.toContain('BooleanExpression');
  });

  test('carries no prose at all', () => {
    for (const line of src.split('\n')) {
      expect(line.trimStart().startsWith('#')).toBe(false);
      expect(line).not.toContain('"""');
    }
  });

  test('names the oracle and the diffuser separately', () => {
    expect(src).toContain('def oracle(qc):');
    expect(src).toContain('def diffuser(qc):');
    expect(src).toContain('    oracle(qc)');
    expect(src).toContain('    diffuser(qc)');
  });

  test('carries the iteration count in a loop rather than repeated text', () => {
    expect(src).toContain('for _ in range(ITERATIONS)');
    expect(src).toContain(`ITERATIONS = ${String(circuit.iterations)}`);
  });

  test('builds a register wide enough for the ancillas', () => {
    const wide = buildCircuit(ROWS, COLS, { oracle: 'constraints' });
    const text = toQiskit(wide);
    expect(text).toContain(`ANCILLAS = ${String(wide.ancillas)}`);
    expect(text).toContain('QuantumCircuit(CELLS + ANCILLAS, CELLS)');
  });
});

describe('OpenQASM 3 export', () => {
  const circuit = buildCircuit(ROWS, COLS);
  const src = toQasm3(circuit);

  test('carries no prose at all', () => {
    expect(src).not.toContain('//');
  });

  test("uses only the constructs Qiskit's importer accepts", () => {
    expect(src).toContain('gate oracle');
    expect(src).toContain('gate diffuser');
    expect(src).toContain('ctrl @ ');
    // def subroutines and ccz are both rejected by qiskit_qasm3_import.
    expect(src).not.toMatch(/^def /m);
    expect(src).not.toContain('ccz');
  });

  test('puts one qubit per statement inside a gate body', () => {
    // The broadcast form `x a0, a1;` is rejected inside a gate definition.
    const body = src.slice(src.indexOf('gate oracle'), src.indexOf('}'));
    for (const line of body.split('\n')) {
      if (/^\s+[hxz] /.test(line)) expect(line).not.toContain(',');
    }
  });

  test('calls the oracle and the diffuser once per iteration', () => {
    const oracles = src.split('\n').filter((l) => l.startsWith('oracle q[')).length;
    const diffusers = src.split('\n').filter((l) => l.startsWith('diffuser q[')).length;
    expect(oracles).toBe(circuit.iterations);
    expect(diffusers).toBe(circuit.iterations);
    expect(src).not.toContain('for int i');
  });

  test('switches to a loop when the calls would run away', () => {
    const many = buildCircuit(ROWS, COLS, { iterations: 5000 });
    const text = toQasm3(many);
    expect(text).toContain('for int i in [0:4999]');
    expect(text.split('\n').filter((l) => l.startsWith('oracle q['))).toHaveLength(0);
    // The loop must stay small enough to be worth copying.
    expect(text.length).toBeLessThan(20_000);
  });

  test('measures only the cells, not the ancillas', () => {
    const wide = buildCircuit(ROWS, COLS, { oracle: 'constraints' });
    const text = toQasm3(wide);
    expect(text).toContain(`qubit[${String(wide.qubits)}] q;`);
    expect(text).toContain(`bit[${String(wide.problemQubits)}] c;`);
    const measures = text.split('\n').filter((l) => l.startsWith('c[')).length;
    expect(measures).toBe(wide.problemQubits);
  });
});

describe('Export at every board size', () => {
  test('a board past the local solve limit still exports', () => {
    // The point of the constraint oracle: no solving, so no size ceiling.
    const clues = Array.from({ length: 6 }, () => [1]);
    const circuit = buildCircuit(clues, clues);
    const src = toQiskit(circuit);
    expect(circuit.oracleKind).toBe('constraints');
    expect(src).toContain('def oracle(qc):');
    // A Python loop means the text stays small however many iterations there are.
    expect(circuit.iterations).toBeGreaterThan(200_000);
    expect(src.length).toBeLessThan(100_000);
  });

  test('the format switch returns the matching text', () => {
    const circuit = buildCircuit(ROWS, COLS);
    expect(exportCircuit(circuit, 'qiskit')).toBe(toQiskit(circuit));
    expect(exportCircuit(circuit, 'qasm3')).toBe(toQasm3(circuit));
  });
});
