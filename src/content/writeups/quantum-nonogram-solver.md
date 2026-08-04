---
title: Quantum Nonogram Solver
summary: Grover-accelerated constraint solving, validated on real IBM hardware — and now solvable in your browser.
---

Nonograms are picture-logic puzzles: fill a grid so every row and column matches its run-length clues. Underneath, that is a Boolean satisfiability problem — which makes it a clean testbed for the real question: **where does a quantum computer actually help?**

## How it works

Each puzzle is encoded as a Boolean formula with one variable per cell, using a precomputed lookup table of the legal fill patterns for every line. Two solvers then race on the *same* encoding:

- a **classical brute-force** search that enumerates candidate grids, and
- a **Grover-based quantum** search whose oracle marks satisfying assignments — the quadratic speedup Grover's algorithm gives over unstructured search.

The browser UI has a canvas puzzle editor, live probability histograms, and a side-by-side classical-vs-quantum comparison.

## What's real, not just simulated

Validated on **real IBM quantum hardware**: a 2×2 puzzle resolved the correct state with **32.3% probability versus 6.25% for random chance** — a measured lift on noisy hardware, not a textbook figure.

## Try it with nothing running

The classical solver is ported to run **entirely in your browser** — draw or randomize a puzzle and it solves instantly, reporting real solve time and search-space size, with no backend awake. The quantum and IBM-hardware runs use the live solver and a gallery of captured real-hardware results.

## Stack

Python · Qiskit (Grover, statevector sampling, IBM Runtime) · Flask + Socket.IO · a dependency-free JavaScript frontend. Tests cover the Boolean encoding, solver correctness, and hardware integration.
