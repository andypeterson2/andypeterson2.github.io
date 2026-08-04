---
title: Quantum ML Classifier Platform
summary: A plugin-based ML platform benchmarking quantum-enhanced classifiers against classical baselines, with 425 tests.
---

An extensible platform for training, evaluating, and comparing classifiers — built so you add a new dataset as a **plugin**, with no changes to existing code.

## How it works

Each dataset is a plugin that declares its models, preprocessing, and UI config. Out of the box there are **6+ model architectures for each dataset** — CNNs, linear models, SVMs, and quantum-kernel methods through **Qiskit and PennyLane**. Live training curves come through **Server-Sent Events**.

The test pipeline does more than give one number: a score for each class, **knowledge distillation**, **ensembles**, and **ablation studies**.

## Interface

A custom **40+ component UI kit** with dark/light theming, a **draw-to-predict canvas** for MNIST, and a **field-based predictor** for Iris — all driven by a clean client-side data layer.

## Verification

There are **425 tests**, across model architectures, training loops, API routes, and persistence. Models emit raw logits. The same server-side preprocessing and softmax will move **into the browser**, for a zero-backend inference demo.

## Stack

PyTorch · Qiskit / PennyLane (optional quantum layers) · Flask + Server-Sent Events · a dependency-free JavaScript frontend and UI kit.
