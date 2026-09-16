---
title: Quantum ML Classifier Platform
summary: A plugin-based ML platform benchmarking quantum-enhanced classifiers against classical baselines — plus Yang et al.'s NISQ-era quantum SVM rebuilt in modern Qiskit.
---

An extensible platform for training, evaluating, and comparing classifiers — built so a new dataset drops in as a **plugin** without touching existing code.

## How it works

Each dataset is a plugin that declares its models, preprocessing, and UI config. Out of the box there are **up to seven model architectures per dataset** — seven for MNIST (CNN, linear, SVM, quadratic, polynomial and two **Qiskit** hybrids), three each for Iris and BB84 (linear, SVM, a variational quantum circuit) — trained with **live training curves streamed over Server-Sent Events**, and evaluated past a single accuracy number: per-class breakdowns, **knowledge distillation**, **ensembles**, and **ablation studies**.

## What's real

- **The paper's quantum SVM, on real hardware.** Yang et al.'s 2019 least-squares QSVM is rebuilt end to end; on **ibm_marrakesh** its circuit scored a Jensen–Shannon divergence of **0.0127 against the paper's 0.130** on IBMQX2 in 2019 — the same circuit and the same 16-outcome comparison at 8,192 shots, seven years of hardware later, an order of magnitude closer to ideal before any error mitigation. Scored on held-out data, its decision rule reaches **96.7% on Iris** and **89.1% on MNIST 6-vs-9**, a few points under a classical linear model on the same two features: the result here is the hardware reproduction, not an accuracy win.
- **500+ test functions** across model architectures, training loops, API routes, and persistence.
- **It predicts in your browser.** The exact preprocessing and softmax the server runs are ported client-side, on weights exported from the same models. The QSVM ships as six numbers: four map coefficients per dataset, solved classically from the class means, and a shared two-number *w* derived from the α read out on the quantum hardware.
- **BB84 as a dataset.** Simulated key-distribution sessions — the video chat's channel physics — classified as clean or eavesdropped from QBER and sifted-key rate: 95% linear, 91% through the same six-number QSVM rule, on held-out sessions. The serving tier needed zero changes.

The math, the derivations and the hardware run are in **[the QSVM paper recreation](/writeups/qsvm-recreation/)**.

## Stack

PyTorch · Qiskit (optional quantum layers, plus the QSVM notebook lane) · Flask + Server-Sent Events · a dependency-free JavaScript frontend and UI kit.
