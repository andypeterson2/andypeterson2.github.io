---
title: Quantum Nonogram Solver
summary: Grover-accelerated constraint solving, validated on IBM hardware — and solvable in your browser.
---

Nonograms are picture-logic puzzles: fill a grid so each row and column matches its run-length clues. At heart, that is a Boolean satisfiability problem — which makes it a clean testbed for the question that matters: **where does a quantum computer actually help?**

## How it works

Each puzzle becomes a Boolean formula with one bit for each cell, from a precomputed lookup table of the legal fill patterns for each line. Two solvers then use the *same* encoding:

- a **classical brute-force** enumeration of candidate grids, and
- a **Grover-based quantum** search with an oracle that marks satisfying assignments — Grover's algorithm gives a quadratic speedup on unstructured search.

The browser UI has a canvas puzzle editor and live probability histograms, and it shows the classical and quantum results side by side.

## On IBM hardware

I validated it on **IBM quantum hardware**: a 2×2 puzzle resolved the correct result with **32.3% probability versus 6.25% for random chance** — a measured lift on hardware with noise, not a textbook figure.

## Try it with no backend

The classical solver is ported **into your browser** — make or randomize a puzzle and it finds the answer instantly. It shows the time it took and the number of candidate grids, with no backend awake. The quantum and IBM-hardware runs use the live solver and a gallery of captured hardware results.

## Stack

Python · Qiskit (Grover, statevector sampling, IBM Runtime) · Flask + Socket.IO · a dependency-free JavaScript frontend. Tests examine the Boolean encoding, the solver, and hardware integration.
