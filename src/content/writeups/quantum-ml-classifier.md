---
title: Quantum ML Classifier Platform
summary: A plugin-based ML platform benchmarking quantum-enhanced classifiers against classical baselines — 438 tests deep.
---

An extensible platform for training, evaluating, and comparing classifiers — built so a new dataset drops in as a **plugin** without touching existing code.

## How it works

Each dataset is a plugin that declares its models, preprocessing, and UI config. Out of the box there are **6+ model architectures per dataset** — CNNs, linear models, SVMs, and quantum-kernel methods via **Qiskit** — trained with **live training curves streamed over Server-Sent Events**.

The evaluation pipeline goes well past a single accuracy number: per-class accuracy breakdowns, **knowledge distillation**, **ensembles**, and **ablation studies**.

## Interface

A custom **40+ component UI kit** with dark/light theming, a **draw-to-predict canvas** for MNIST, and a form-based predictor for Iris — all driven by a clean client-side state layer.

## What's real

Covered by **438 tests** across model architectures, training loops, API routes, and persistence. Models emit raw logits, and the exact preprocessing and softmax that run server-side are **also ported to run in the browser** — draw a digit or enter flower measurements and it predicts with nothing running, on weights exported from the same model the backend serves.

## Stack

PyTorch · Qiskit (optional quantum layers) · Flask + Server-Sent Events · a dependency-free JavaScript frontend and UI kit.
