---
title: Quantum Nonogram Solver
summary: Grover's algorithm against a backtracking solver on an NP-complete puzzle — enumerated to 4x4, run on IBM hardware, and solvable in your browser.
---

Nonograms are picture-logic puzzles: fill a grid so every row and column matches its run-length clues. Underneath, that is a Boolean satisfiability problem — which makes it a clean testbed for the real question: **where does a quantum computer actually help?**

## The result

Here, it does not. Every solvable board up to 4x4 was enumerated and deduplicated by clue pair — **62,535 puzzles** — and scored against Grover's round count. On **100% of single-solution boards from 3x3 upward**, a backtracking solver's *worst* board asks fewer questions than Grover needs rounds: 15 against 17 at 3x3, 56 against 201 at 4x4, and 246 against 4,549 on a 396,554-puzzle 5x5 sample. The gap widens with every size. The two units are reported separately rather than merged, since a placement is an upper bound on grid queries and a Grover round is exact.

## Why the usual benchmark hides this

The standard oracle hands the clue formula to Qiskit's `PhaseOracleGate`, which reduces it over all 2^n grids and emits one multi-controlled Z per solution. **Constructing it means solving the puzzle first.** Its cost is then a function of board size and solution count alone: across 30 distinct single-solution 4x4 boards it compiles to the same 227.5 two-qubit gates every time. Different puzzle, identical circuit. A benchmark resting on it reports the cost of Grover on an arbitrary n-bit function, not on the problem in its title.

So I built two oracles that do not hold the answer. One raises a flag qubit per line over that line's legal patterns: 7x the answer-marking form at 3x3, and exponential in line width — 5,385 gates against 29,254 at the same 24 cells, on board shape alone. The second is a reversible run-length automaton that consults no solution at all, a verified prototype at 7-12x the answer-marking oracle for 2.1-3.3x the qubits, or 12-19x on the schedule that fits the device. Neither ratio means anything without its qubit cost beside it.

## What ran on hardware

A 2x2 puzzle on `ibm_torino` resolved the correct state at **32.3% against 6.25% for chance** — five times chance, against 47.3% for the same one-iteration circuit run noiselessly. A measured lift on a real device, not a textbook figure. Nothing larger fits: at 3x3 not one of the 17 required rounds survives a 200-layer coherence budget.

## How it is checked

Every oracle is verified against the textbook amplification curve to 1e-9, so the comparison is between circuits that agree on which grids they mark; the automaton is additionally checked by exact reversible simulation over every basis input, asserting its scratch register returns to zero. The harness records every transpiler seed rather than the best one, which is what let a selection artifact in an early draft be caught. Rebuilding IBM's own published Grover tutorial reproduces its circuit to within 0.5%.

## Try it with nothing running

A classical solver runs **entirely in your browser** — draw or randomize a puzzle and it solves instantly, reporting real solve time and search-space size, with no backend awake. Quantum runs use the live solver; without it, a gallery of captured simulator runs shows real quantum output.

## Stack

Python · Qiskit (Grover, statevector sampling, IBM Runtime) · Flask + Socket.IO · a dependency-free JavaScript frontend. Tests cover the Boolean encoding, solver correctness, oracle amplification, and hardware integration.
