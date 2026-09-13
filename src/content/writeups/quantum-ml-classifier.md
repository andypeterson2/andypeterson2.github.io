---
title: Quantum ML Classifier Platform
summary: A plugin-based ML platform benchmarking quantum-enhanced classifiers against classical baselines — plus Yang et al.'s NISQ-era quantum SVM rebuilt in modern Qiskit.
---

An extensible platform for training, evaluating, and comparing classifiers — built so a new dataset drops in as a **plugin** without touching existing code.

## How it works

Each dataset is a plugin that declares its models, preprocessing, and UI config. Out of the box there are **6+ model architectures per dataset** — CNNs, linear models, SVMs, and quantum-kernel methods via **Qiskit** — trained with **live training curves streamed over Server-Sent Events**, and evaluated past a single accuracy number: per-class breakdowns, **knowledge distillation**, **ensembles**, and **ablation studies**.

## What's real

- **The paper's quantum SVM, on real hardware.** Yang et al.'s 2019 least-squares QSVM is rebuilt end to end; on **ibm_marrakesh** its circuit scored a Jensen–Shannon divergence of **0.0127 against the paper's 0.130** on IBMQX2 — ten times closer to ideal, before any error mitigation. It reaches **97% on Iris** and **91.5% on MNIST 6-vs-9**.
- **500+ test functions** across model architectures, training loops, API routes, and persistence.
- **It predicts in your browser.** The exact preprocessing and softmax the server runs are ported client-side, on weights exported from the same models; the QSVM ships as six numbers.
- **BB84 as a dataset.** Simulated key-distribution sessions — the video chat's channel physics — classified as clean or eavesdropped from QBER and sifted-key rate: 95% linear, 90% through the same six-number QSVM rule. The serving tier needed zero changes.

The math, the derivations and the hardware run are in **[the QSVM paper recreation](/writeups/qsvm-recreation/)**.

## Stack

PyTorch · Qiskit (optional quantum layers, plus the QSVM notebook lane) · Flask + Server-Sent Events · a dependency-free JavaScript frontend and UI kit.
