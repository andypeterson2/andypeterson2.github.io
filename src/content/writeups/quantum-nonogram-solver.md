---
title: Quantum Nonogram Solver
summary: Grover's algorithm against a backtracking solver on an NP-complete puzzle — enumerated to 4x4, run on IBM hardware, and solvable in your browser.
---

Nonograms are picture-logic puzzles: fill a grid so every row and column matches its run-length clues. Underneath, that is a Boolean satisfiability problem — which makes it a clean testbed for the real question: **where does a quantum computer actually help?** Here, it does not.

Begun at Qualcomm Institute as a group project. The enumeration, the clue-pattern oracle, the hardware runs and everything measured below are mine.

## How it works

The standard oracle hands the clue formula to Qiskit's `PhaseOracleGate`, which reduces it over all 2^n grids and emits one multi-controlled Z per solution. **Constructing it means solving the puzzle first.** Its cost is then a function of board size and solution count alone: across 30 distinct single-solution 4x4 boards it compiles to the same 227.5 two-qubit gates every time — the median of 8 recorded transpiler seeds against the `FakeTorino` device model, and the eight-seed multiset is identical board to board. Different puzzle, identical circuit. A benchmark resting on it reports the cost of Grover on an arbitrary n-bit function, not on the problem in its title.

So I built an oracle that does not hold the answer: it raises a flag qubit per line over that line's legal patterns, which costs about 7x the answer-marking form at 3x3 and grows exponentially in line width. It is also still an enumeration, only over patterns instead of solutions. An oracle that tests the clues rather than enumerating them — a reversible run-length automaton per line, polynomial in line width — is the comparison this project has not built, so what such an oracle costs is unmeasured here.

## The result

Every solvable board up to 4x4 was enumerated and deduplicated by clue pair — **62,535 puzzles** — and scored against Grover's round count. On **100% of single-solution boards from 3x3 upward**, a backtracking solver's *worst* board asks fewer questions than Grover needs rounds: 15 against 17 at 3x3, 56 against 201 at 4x4, and 246 against 4,549 on a 396,554-puzzle 5x5 sample. The gap widens with every size. The two units are reported separately rather than merged, since a placement is an upper bound on grid queries and a Grover round is exact.

On hardware, a 2x2 puzzle on `ibm_fez` resolved the correct state at **36.8% against 6.25% for chance** — 377 of 1,024 shots, against 47.3% for the same one-iteration circuit run noiselessly. A measured lift on a real device, not a textbook figure. One iteration, transpiled depth 146, job `db4m98imb58s7389da60`, and the run records its own counts, job id, backend and depth so the figure can be traced back to it. Nothing larger fits: at 3x3 not one of the 17 required rounds survives a 200-layer coherence budget.

A classical solver runs **entirely in your browser** — draw or randomize a puzzle and it solves instantly, reporting real solve time and search-space size, with no backend awake. Building and running a Grover circuit needs Qiskit, so the quantum side calls a Python service when one is up; when it is not, a gallery of captured simulator runs shows real quantum output instead.

## What's checked

Every oracle is verified against the textbook amplification curve to 1e-9, so the comparison is between circuits that agree on which grids they mark. The harness records every transpiler seed rather than the best one, which is what let a selection artifact in an early draft be caught. Rebuilding IBM's own published Grover tutorial reproduces its circuit to within 0.5%. Tests cover the Boolean encoding, solver correctness, oracle amplification, and hardware integration.
