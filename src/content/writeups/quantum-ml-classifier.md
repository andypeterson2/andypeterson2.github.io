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

In 2019, Yang, Awan & Vall-Llosera at Ericsson Research took the least-squares quantum SVM — an algorithm that on paper needs error-corrected hardware — and re-engineered it until it ran on a real 5-qubit IBM device ([arXiv:1909.11988](https://arxiv.org/abs/1909.11988)). The recreation lives as an [executed notebook](https://github.com/andypeterson2/quantum-machine-learning/tree/main/notebooks/qsvm-iris) in this repo, rebuilt end-to-end in modern Qiskit — and its final classifiers run **live on this demo page**: the QSVM rows in the Models, Predictions, and Evaluation panels are the paper's actual solved decision rule.

### The least-squares QSVM

The LS reformulation turns SVM training into a linear system over the kernel matrix (the paper's Eq. 10). In the non-offset case the decision boundary passes through the origin:

<div class="math-scroll"><math xmlns="http://www.w3.org/1998/Math/MathML" display="block"><mrow><mi>F</mi><mover><mi>&#x003B1;</mi><mo stretchy="true">&#x02192;</mo></mover><mo>&#x0003D;</mo><mover><mi>y</mi><mo stretchy="true">&#x02192;</mo></mover><mo>&#x0002C;</mo><mspace width="2em" /><mi>F</mi><mo>&#x0003D;</mo><mi>K</mi><mo>&#x0002B;</mo><msup><mi>&#x003B3;</mi><mrow><mo>&#x02212;</mo><mn>1</mn></mrow></msup><mi>I</mi></mrow></math></div>

A new point is then classified by a signed sum of kernel evaluations against the training points:

<div class="math-scroll"><math xmlns="http://www.w3.org/1998/Math/MathML" display="block"><mrow><mi>y</mi><mo stretchy="false">&#x00028;</mo><msub><mover><mi>x</mi><mo stretchy="true">&#x02192;</mo></mover><mn>0</mn></msub><mo stretchy="false">&#x00029;</mo><mo>&#x0003D;</mo><mrow><mi mathvariant="normal">s</mi><mi mathvariant="normal">g</mi><mi mathvariant="normal">n</mi></mrow><mo minsize="1.623em" maxsize="1.623em">(</mo><munderover><mo>&#x02211;</mo><mrow><mi>i</mi><mo>&#x0003D;</mo><mn>1</mn></mrow><mrow><mi>M</mi></mrow></munderover><msub><mi>&#x003B1;</mi><mi>i</mi></msub><mspace width="0.167em" /><msub><mover><mi>x</mi><mo stretchy="true">&#x02192;</mo></mover><mi>i</mi></msub><mo>&#x000B7;</mo><msub><mover><mi>x</mi><mo stretchy="true">&#x02192;</mo></mover><mn>0</mn></msub><mo minsize="1.623em" maxsize="1.623em">)</mo></mrow></math></div>

HHL solves the linear system on a quantum computer. Everything else in the paper exists to make the system small and friendly enough for a depth-7 circuit: exactly two training points — the class means — pinned by preprocessing onto a fixed geometry.

### Preprocessing: the solved map

The paper states its preprocessing as a destination, not a route; the notebook derives the route. Each class mean is pushed through an affine map (Eq. 24),

<div class="math-scroll"><math xmlns="http://www.w3.org/1998/Math/MathML" display="block"><mrow><mo stretchy="false">&#x00028;</mo><msub><mover><mi>v</mi><mo stretchy="true">&#x02192;</mo></mover><mi>i</mi></msub><msub><mo stretchy="false">&#x00029;</mo><mn>1</mn></msub><mo>&#x0003D;</mo><mi>a</mi><mspace width="0.167em" /><mo stretchy="false">&#x00028;</mo><msub><mi>t</mi><mi>i</mi></msub><msub><mo stretchy="false">&#x00029;</mo><mn>1</mn></msub><mo>&#x0002B;</mo><mi>b</mi><mo>&#x0002C;</mo><mspace width="2em" /><mo stretchy="false">&#x00028;</mo><msub><mover><mi>v</mi><mo stretchy="true">&#x02192;</mo></mover><mi>i</mi></msub><msub><mo stretchy="false">&#x00029;</mo><mn>2</mn></msub><mo>&#x0003D;</mo><mi>c</mi><mspace width="0.167em" /><mo stretchy="false">&#x00028;</mo><msub><mi>t</mi><mi>i</mi></msub><msub><mo stretchy="false">&#x00029;</mo><mn>2</mn></msub><mo>&#x0002B;</mo><mi>d</mi></mrow></math></div>

with *a, b* solved in closed form (and *c, d* hand-picked) so that after L² normalization the two training points land exactly on the paper's fixed targets:

<div class="math-scroll"><math xmlns="http://www.w3.org/1998/Math/MathML" display="block"><mrow><msub><mover><mi>x</mi><mo stretchy="true">&#x02192;</mo></mover><mn>1</mn></msub><mo>&#x0003D;</mo><mo stretchy="false">&#x00028;</mo><mn>0.987</mn><mo>&#x0002C;</mo><mtext>&#x000A0;</mtext><mn>0.159</mn><mo stretchy="false">&#x00029;</mo><mo>&#x0002C;</mo><mspace width="2em" /><msub><mover><mi>x</mi><mo stretchy="true">&#x02192;</mo></mover><mn>2</mn></msub><mo>&#x0003D;</mo><mo stretchy="false">&#x00028;</mo><mn>0.345</mn><mo>&#x0002C;</mo><mtext>&#x000A0;</mtext><mn>0.935</mn><mo stretchy="false">&#x00029;</mo></mrow></math></div>

Because the training geometry is fixed, the quantum solution is **dataset-independent** — only the four map coefficients change between Iris and MNIST.

### The quantum pipeline

The **kernel oracle** is a depth-1 circuit whose raw measurement counts reconstruct the 2×2 kernel matrix — no state tomography. The **optimized HHL solver** is the paper's 4-qubit shallow circuit (Fig. 10), reconstructed from the text; its shot readout yields α ∝ (0.51, −0.49), which the notebook **verifies against the classical LS-SVM solution** α ∝ (1, −1) — the sign rule is identical, so the deployed classifier is provably the classical solution with the quantum measurement's ~1.5° boundary tilt.

### Results — and the rule you're clicking

**97% on Iris** (setosa vs versicolor from sepal width and petal length) — exactly the paper's simulated result. The same quantum solution, with only the map coefficients changed, scores **91% on MNIST 6-vs-9** using the paper's pixel-ratio features — the fraction of ink in the left vs right and top vs bottom halves of the image — near the 92.5% ceiling an unconstrained classical SVM reaches on those same features. The notebook closes with the paper's own noise yardstick: the Jensen–Shannon divergence between ideal and noisy output distributions, repeated under a depolarizing + readout model standing in for the retired IBMQX2 device.

What ships to your browser is the whole thing collapsed to six numbers:

<div class="math-scroll"><math xmlns="http://www.w3.org/1998/Math/MathML" display="block"><mrow><mi>s</mi><mo>&#x0003D;</mo><msub><mi>w</mi><mn>1</mn></msub><mspace width="0.167em" /><mo stretchy="false">&#x00028;</mo><mi>a</mi><msub><mi>f</mi><mn>1</mn></msub><mo>&#x0002B;</mo><mi>b</mi><mo stretchy="false">&#x00029;</mo><mo>&#x0002B;</mo><msub><mi>w</mi><mn>2</mn></msub><mspace width="0.167em" /><mo stretchy="false">&#x00028;</mo><mi>c</mi><msub><mi>f</mi><mn>2</mn></msub><mo>&#x0002B;</mo><mi>d</mi><mo stretchy="false">&#x00029;</mo></mrow></math></div>

Draw a six, and that one line — the paper's map plus one dot product — decides. The weights are exported closed-form from this repo with provenance stamped, and CI re-derives them on every run.

## Stack

PyTorch · Qiskit (optional quantum layers, plus the QSVM notebook lane) · Flask + Server-Sent Events · a dependency-free JavaScript frontend and UI kit.
