/**
 * Grover's algorithm for the browser tier: the amplitudes in closed form, exact and
 * noiseless. Nothing here builds a circuit.
 *
 * The oracle marks exactly the grids the classical solver already found, so the state
 * never leaves the plane spanned by "some solution" and "no solution". Two amplitudes
 * describe it completely at every step:
 *
 *   θ = arcsin(√(M/N))
 *   after k iterations, each marked state holds sin((2k+1)θ)/√M
 *                       each other state holds cos((2k+1)θ)/√(N−M)
 *
 * (Boyer, Brassard, Høyer & Tapp, quant-ph/9605034 — the same closed form the backend
 * uses as `grover_success_probability`.)
 *
 * Working in that plane rather than over a 2^n vector is what makes this viable in a
 * browser: nothing here is sized by N, so a 25-cell puzzle costs the same as a 4-cell
 * one. It also means there is no circuit, so there is no depth and no gate count to
 * report, and the metrics table shows both as unknown.
 */

/** What a measurement of the post-Grover state would give. */
export interface GroverOutcome {
  /** Probability the measurement lands on any marked state at all. */
  markedProbability: number;
  /** Probability of one specific marked state. */
  perMarked: number;
  /** Probability of one specific unmarked state. */
  perUnmarked: number;
  iterations: number;
  qubits: number;
  /** 2^qubits — the size of the space being searched. */
  searchSpace: number;
  solutionCount: number;
}

/**
 * The iteration count that lands closest to a marked state.
 *
 * P(k) is periodic, so more is not better: past the peak the amplitude rotates back
 * off the solutions again.
 */
export function optimalIterations(solutionCount: number, qubits: number): number {
  const searchSpace = 2 ** qubits;
  if (solutionCount <= 0 || solutionCount >= searchSpace) return 0;
  return Math.floor((Math.PI / 4) * Math.sqrt(searchSpace / solutionCount));
}

/** Amplitudes after `iterations` rounds, defaulting to the count that peaks. */
export function groverOutcome(
  solutionCount: number,
  qubits: number,
  iterations?: number,
): GroverOutcome {
  const searchSpace = 2 ** qubits;
  const k = iterations ?? optimalIterations(solutionCount, qubits);
  const base = { iterations: k, qubits, searchSpace, solutionCount };

  // Nothing satisfies the clues: the oracle marks no state, θ is 0, and the register
  // stays in the uniform superposition it started from however long it is turned.
  if (solutionCount <= 0) {
    return { ...base, markedProbability: 0, perMarked: 0, perUnmarked: 1 / searchSpace };
  }
  // Everything satisfies them: the measurement cannot miss.
  if (solutionCount >= searchSpace) {
    return { ...base, markedProbability: 1, perMarked: 1 / searchSpace, perUnmarked: 0 };
  }

  const theta = Math.asin(Math.sqrt(solutionCount / searchSpace));
  const marked = Math.sin((2 * k + 1) * theta) ** 2;
  return {
    ...base,
    markedProbability: marked,
    perMarked: marked / solutionCount,
    perUnmarked: (1 - marked) / (searchSpace - solutionCount),
  };
}

/** Row-major "0"/"1" grid to the basis state it names. */
function stateIndex(bits: string): number {
  let index = 0;
  for (let i = 0; i < bits.length; i++) if (bits[i] === '1') index += 2 ** i;
  return index;
}

/** The inverse, padded to `length` cells. */
function stateBits(index: number, length: number): string {
  let bits = '';
  for (let i = 0; i < length; i++) bits += Math.floor(index / 2 ** i) % 2 ? '1' : '0';
  return bits;
}

/**
 * The r-th unmarked state, counting from zero.
 *
 * Stepping past each marked index in turn is what keeps this independent of N: the
 * alternative, listing the unmarked states, would be 2^n entries long.
 */
function unmarkedAt(r: number, sortedMarked: number[]): number {
  let index = r;
  for (const marked of sortedMarked) if (marked <= index) index++;
  return index;
}

/**
 * The exact distribution, one entry per basis state, for a space small enough to list.
 *
 * Used where there is nothing to amplify: a draw would scatter shots unevenly and a
 * few states would clear the peak threshold by luck alone, which reads as a set of
 * answers to a puzzle that has none. A flat line is what the amplitudes actually say.
 */
function uniformCounts(qubits: number): Record<string, number> {
  const counts: Record<string, number> = {};
  for (let index = 0; index < 2 ** qubits; index++) {
    counts[stateBits(index, qubits).split('').reverse().join('')] = 1;
  }
  return counts;
}

/** Above this many states the exact listing costs more than it is worth. */
const EXACT_LIMIT = 12;

/**
 * Draw `shots` measurements from the exact distribution, keyed the way a real run is.
 *
 * Qiskit reports little-endian bitstrings and the renderer reverses them to read a
 * grid, so these keys are reversed to match — a simulated run and a hardware one have
 * to be readable by the same code.
 *
 * Sampling rather than reporting the two exact values keeps the histogram shaped like
 * the live one, at the cost of being a draw: the bars move between runs. The exact
 * probability is reported separately, in the metrics.
 */
export function sampleCounts(
  solutions: string[],
  qubits: number,
  shots: number,
  outcome: GroverOutcome,
  rng: () => number = Math.random,
): Record<string, number> {
  const counts: Record<string, number> = {};
  if (shots <= 0) return counts;
  // No marked state means no interference, so report the flat distribution itself.
  // Past EXACT_LIMIT a draw is already flat enough that no state clears the threshold.
  if (outcome.markedProbability === 0 && qubits <= EXACT_LIMIT) return uniformCounts(qubits);

  const marked = solutions.map(stateIndex).sort((a, b) => a - b);
  const unmarkedTotal = outcome.searchSpace - marked.length;
  const bump = (index: number): void => {
    const key = stateBits(index, qubits).split('').reverse().join('');
    counts[key] = (counts[key] ?? 0) + 1;
  };

  /** One of the marked states, uniformly — they all carry the same amplitude. */
  const anyMarked = (): number =>
    marked[Math.min(marked.length - 1, Math.floor(rng() * marked.length))] ?? 0;

  for (let shot = 0; shot < shots; shot++) {
    if (marked.length > 0 && rng() < outcome.markedProbability) bump(anyMarked());
    else if (unmarkedTotal > 0) {
      bump(unmarkedAt(Math.min(unmarkedTotal - 1, Math.floor(rng() * unmarkedTotal)), marked));
    } else bump(anyMarked());
  }
  return counts;
}
