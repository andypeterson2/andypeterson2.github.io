---
title: Quantum ML Classifier Platform
summary: A plugin-based ML platform benchmarking quantum-enhanced classifiers against classical baselines — plus Yang et al.'s NISQ-era quantum SVM rebuilt in modern Qiskit.
---

An extensible platform for training, evaluating, and comparing classifiers — built so a new dataset drops in as a **plugin** without touching existing code.

## How it works

Each dataset is a plugin that declares its models, preprocessing, and UI config. Out of the box there are **6+ model architectures per dataset** — CNNs, linear models, SVMs, and quantum-kernel methods via **Qiskit** — trained with **live training curves streamed over Server-Sent Events**.

The evaluation pipeline goes well past a single accuracy number: per-class accuracy breakdowns, **knowledge distillation**, **ensembles**, and **ablation studies**.

## Interface

A custom **40+ component UI kit** with dark/light theming, a **draw-to-predict canvas** for MNIST, and a form-based predictor for Iris — all driven by a clean client-side state layer.

## What's real

Covered by **438 tests** across model architectures, training loops, API routes, and persistence. Models emit raw logits, and the exact preprocessing and softmax that run server-side are **also ported to run in the browser** — draw a digit or enter flower measurements and it predicts with nothing running, on weights exported from the same model the backend serves.

## The QSVM paper recreation

In 2019, Yang, Awan & Vall-Llosera at Ericsson Research took the least-squares quantum SVM — an algorithm that on paper needs error-corrected hardware — and re-engineered it until it ran on a real 5-qubit IBM device ([arXiv:1909.11988](https://arxiv.org/abs/1909.11988)). The same demo page carries that paper recreated **end-to-end in modern Qiskit** as one executed, readable notebook: the solved preprocessing map (Eq. 24), the depth-1 kernel oracle read out from raw counts, the 4-qubit optimized HHL solver of Fig. 10 **verified against the classical LS-SVM solution**, and the paper's Jensen–Shannon noise analysis under a depolarizing + readout model.

**97% on Iris** — exactly the paper's simulated result (they measured 98% on hardware). The same quantum solution, with only the mapping coefficients changed, scores **91% on MNIST 6-vs-9** with the paper's pixel-ratio features — near the 92.5% ceiling of an unconstrained classical SVM on those features. The notebook is exported with math rendered to native MathML — no JavaScript, no CDN, provenance-stamped to the source commit.

## Stack

PyTorch · Qiskit (optional quantum layers, plus the QSVM notebook lane) · Flask + Server-Sent Events · a dependency-free JavaScript frontend and UI kit.
