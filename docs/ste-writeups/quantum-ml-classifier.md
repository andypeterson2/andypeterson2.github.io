---
title: Quantum ML Classifier Platform
summary: A plugin-based ML platform benchmarking quantum-enhanced classifiers against classical baselines, plus Yang et al.'s quantum SVM rebuilt in Qiskit.
---

An extensible platform for training, evaluating, and comparing classifiers — built so you add a new dataset as a **plugin**, with no changes to existing code.

## How it works

Each dataset is a plugin that declares its models, preprocessing, and UI config. Out of the box there are **6+ model architectures for each dataset** — CNNs, linear models, SVMs, and quantum-kernel methods through **Qiskit and PennyLane**. Live training curves come through **Server-Sent Events**.

The test pipeline does more than give one number: a score for each class, **knowledge distillation**, **ensembles**, and **ablation studies**.

## Interface

A custom **40+ component UI kit** with dark/light theming, a **draw-to-predict canvas** for MNIST, and a **field-based predictor** for Iris — all driven by a clean client-side data layer.

## Verification

There are **454 test functions**, across model architectures, training loops, API routes, and persistence. Models emit raw logits. The same preprocessing and softmax also operate **in the browser**, for a zero-backend inference demo.

## The QSVM paper recreation

In 2019, engineers at Ericsson Research made the least-squares quantum SVM operate on a real 5-qubit IBM computer ([arXiv:1909.11988](https://arxiv.org/abs/1909.11988)). On paper, that algorithm needs error-corrected hardware. This repo contains the full recreation as one [executed notebook](https://github.com/andypeterson2/quantum-machine-learning/tree/main/notebooks/qsvm-iris). The final classifiers operate **live on the demo page**: the QSVM rows in the Models, Predictions, and Evaluation panels apply the paper's solved decision rule.

### The least-squares QSVM

The LS method changes SVM training into a linear system over the kernel matrix (the paper's Eq. 10). In the non-offset case, the decision boundary goes through the origin. A new point gets a class from a signed sum of kernel values against the training points.

HHL solves the linear system on a quantum computer. All other parts of the paper make the system small: exactly two training points — the class means — held on a fixed geometry by preprocessing.

### Preprocessing: the solved map

The paper gives its preprocessing as a destination, not a route. The notebook finds the route. An affine map (Eq. 24) moves each class mean. The notebook solves *a, b* in closed form (and sets *c, d* by hand) so that, after L² normalization, the two training points land exactly on the paper's fixed targets. The training geometry is fixed, so the quantum solution is **the same for each dataset** — only the four map values change between Iris and MNIST.

### The quantum pipeline

The **kernel oracle** is a depth-1 circuit. Its raw measurement counts give the 2×2 kernel matrix — no state tomography. The **optimized HHL solver** is the paper's 4-qubit shallow circuit (Fig. 10). Its shot readout gives α ∝ (0.51, −0.49). The notebook **compares this against the classical LS-SVM solution** α ∝ (1, −1) — the sign rule is identical. Thus the deployed classifier is the classical solution, with the quantum measurement's small boundary tilt (~1.5°).

### Results — and the rule you operate

**97% on Iris** (setosa vs versicolor from sepal width and petal length) — equal to the paper's simulated result. The same quantum solution, with only the map values changed, gets **91% on MNIST 6-vs-9** with the paper's pixel-ratio features — near the 92.5% limit of an unconstrained classical SVM on those features. The notebook ends with the paper's own noise measure: the Jensen–Shannon divergence between clean and noisy output distributions, under a depolarizing + readout model in place of the retired IBMQX2 computer.

What goes to your browser is the full method in six numbers: the paper's map plus one dot product. Make a drawing of a six, and that one line decides. The weights come from the repo in closed form, with provenance data, and CI makes the derivation again on each run.

## Stack

PyTorch · Qiskit / PennyLane (optional quantum layers, plus the QSVM notebook lane) · Flask + Server-Sent Events · a dependency-free JavaScript frontend and UI kit.
