/**
 * The circuit as source a visitor can copy and run elsewhere.
 *
 * The emitted text is circuit and nothing else — no header, no annotation. What the
 * circuit means belongs on the page around it, where it can be read without being
 * pasted into an interpreter.
 *
 * Both formats are written from the gate list, never from the boolean expression the
 * backend uses: Qiskit's `PhaseOracleGate` synthesises by evaluating that expression
 * over all 2^n assignments, so a pasted script would sit for hours on a board of any
 * size before emitting a gate.
 *
 * The oracle and the diffuser are emitted as separate named gates. Folded that way a
 * reader sees the algorithm's shape first and can open either one, which is also how
 * the diagram draws it.
 */
import { type Circuit, type Gate } from './circuit';

/**
 * Iterations past which OpenQASM 3 switches to a loop.
 *
 * A call per iteration is what every tool executes, but the count reaches six figures
 * on a large board and the text stops being copyable long before that.
 */
const QASM_UNROLL_LIMIT = 1000;

/** Consecutive gates of one name on distinct qubits, written as a single call. */
export interface GateRun {
  name: Gate['name'];
  qubits: number[];
}

/** True when this gate belongs to the run still open. */
export function extendsRun(run: GateRun | null, gate: Gate): run is GateRun {
  return run?.name === gate.name && !run.qubits.includes(gate.target);
}

/** Runs of the same single-qubit gate collapse into one call. */
function groupSingles(gates: Gate[]): GateRun[] {
  const out: GateRun[] = [];
  let run: GateRun | null = null;
  for (const gate of gates) {
    if (gate.controls.length) {
      out.push({ name: gate.name, qubits: [...gate.controls, gate.target] });
      run = null;
      continue;
    }
    if (extendsRun(run, gate)) {
      run.qubits.push(gate.target);
      continue;
    }
    run = { name: gate.name, qubits: [gate.target] };
    out.push(run);
  }
  return out;
}

function qiskitBody(gates: Gate[], indent: string): string[] {
  return groupSingles(gates).map((g) => {
    const qubits = g.qubits;
    if (g.name === 'mcz') {
      const controls = qubits.slice(0, -1);
      const target = qubits[qubits.length - 1];
      return `${indent}qc.append(ZGate().control(${String(controls.length)}), [${controls.join(', ')}, ${String(target)}])`;
    }
    if (g.name === 'mcx') {
      const controls = qubits.slice(0, -1);
      const target = qubits[qubits.length - 1];
      return `${indent}qc.mcx([${controls.join(', ')}], ${String(target)})`;
    }
    return `${indent}qc.${g.name}([${qubits.join(', ')}])`;
  });
}

/** A runnable Qiskit script. A Python loop carries any iteration count. */
export function toQiskit(circuit: Circuit): string {
  return [
    'from qiskit import QuantumCircuit',
    'from qiskit.circuit.library import ZGate',
    '',
    `CELLS = ${String(circuit.problemQubits)}`,
    `ANCILLAS = ${String(circuit.ancillas)}`,
    `ITERATIONS = ${String(circuit.iterations)}`,
    '',
    '',
    'def oracle(qc):',
    ...qiskitBody(circuit.oracle, '    '),
    '',
    '',
    'def diffuser(qc):',
    ...qiskitBody(circuit.diffuser, '    '),
    '',
    '',
    'qc = QuantumCircuit(CELLS + ANCILLAS, CELLS)',
    ...qiskitBody(circuit.prepare, ''),
    'for _ in range(ITERATIONS):',
    '    oracle(qc)',
    '    diffuser(qc)',
    'qc.measure(range(CELLS), range(CELLS))',
    '',
  ].join('\n');
}

function qasmGate(gate: Gate, names: (i: number) => string): string {
  const target = names(gate.target);
  if (gate.controls.length === 0) return `  ${gate.name} ${target};`;
  const all = [...gate.controls.map(names), target].join(', ');
  // No ccz in stdgates.inc, and gate modifiers are the portable spelling anyway.
  const base = gate.name === 'mcz' ? 'z' : 'x';
  return `  ${'ctrl @ '.repeat(gate.controls.length)}${base} ${all};`;
}

/**
 * OpenQASM 3.
 *
 * Written against what Qiskit's importer accepts: `gate` definitions rather than
 * `def` subroutines, `ctrl @` modifiers rather than `ccz`, and one qubit per
 * statement rather than the broadcast form. Reading it back needs
 * `pip install qiskit_qasm3_import`, which plain Qiskit does not ship.
 */
export function toQasm3(circuit: Circuit): string {
  const params = Array.from({ length: circuit.qubits }, (_, i) => `a${String(i)}`);
  const args = Array.from({ length: circuit.qubits }, (_, i) => `q[${String(i)}]`);
  const calls = [`oracle ${args.join(', ')};`, `diffuser ${args.join(', ')};`];

  const body =
    circuit.iterations <= QASM_UNROLL_LIMIT
      ? Array.from({ length: circuit.iterations }, () => calls).flat()
      : [
          `for int i in [0:${String(circuit.iterations - 1)}] {`,
          ...calls.map((c) => `  ${c}`),
          '}',
        ];

  return [
    'OPENQASM 3.0;',
    'include "stdgates.inc";',
    '',
    `gate oracle ${params.join(', ')} {`,
    ...circuit.oracle.map((g) => qasmGate(g, (i) => params[i])),
    '}',
    '',
    `gate diffuser ${params.join(', ')} {`,
    ...circuit.diffuser.map((g) => qasmGate(g, (i) => params[i])),
    '}',
    '',
    `qubit[${String(circuit.qubits)}] q;`,
    `bit[${String(circuit.problemQubits)}] c;`,
    '',
    ...circuit.prepare.map((g) => qasmGate(g, (i) => args[i]).trimStart()),
    '',
    ...body,
    '',
    ...Array.from(
      { length: circuit.problemQubits },
      (_, i) => `c[${String(i)}] = measure q[${String(i)}];`,
    ),
    '',
  ].join('\n');
}

export type ExportFormat = 'qiskit' | 'qasm3';

export function exportCircuit(circuit: Circuit, format: ExportFormat): string {
  return format === 'qiskit' ? toQiskit(circuit) : toQasm3(circuit);
}
