---
title: Quantum ML Classifier Platform
summary: A plugin-based ML platform where every published accuracy carries its uncertainty and is held there by a test — plus Yang et al.'s NISQ-era quantum SVM rebuilt in modern Qiskit and run on IBM hardware.
---

An extensible platform for training, evaluating, and comparing classifiers — built so a new dataset drops in as a **plugin** without touching existing code.

## How it works

Each dataset is a plugin that declares its models, preprocessing, and UI config. MNIST ships a CNN, a linear model and a hinge-loss SVM; Iris and BB84 ship a linear model, an SVM and a variational quantum circuit each, and PennyLane is an optional extra, so a lean install simply does not offer the quantum rows rather than failing at train time. Everything trains with **live curves streamed over Server-Sent Events**, and evaluates past a single accuracy number: per-class breakdowns, **knowledge distillation**, **ensembles**, and **ablation studies**.

## Every number has to survive a test

The discipline is the point of the project. Each published accuracy is one seeded run scored on the full test split, and it ships with **two** error components, because one of them alone is misleading. The 95% Wilson interval covers sampling error. The spread across ten seeds covers the rest — and on Iris that spread is the larger of the two, wide enough that the published run turns out to be the best of its ten on two of the three rows. The artifact records every seed so the estimator can be changed after the fact, and a test holds every served document, every README table and the browser weights to it. A model nobody measured has to say so.

Negative results stay in. Distilling the MNIST CNN into the linear student **costs** about a point and is worse on all three seeds. Error mitigation on the hardware run made the divergence worse, not better. Nothing quantum here beats its classical baseline on any dataset, and the tables say so.

## The paper's quantum SVM, and what the hardware actually contributed

Yang et al.'s 2019 least-squares QSVM is rebuilt end to end and its decision rule ships to the browser as six numbers. Four are solved classically from the class means; the other two come from an HHL circuit run on **ibm_marrakesh**.

The interesting question is not how clean that run was but what it was worth. The rule decides by `sign(v · w)`, so the measured alpha's scale cancels and only the ratio of its two components reaches the boundary — one scalar, which came out **3.3% from its exact value**. Alpha's sign pattern is not measured at all, but taken from the ideal solution. Holding the map, orientation and split fixed and rebuilding the rule from the exact classical alpha tilts the boundary **1.58°** and changes **19 of 1,530** held-out predictions: none of 30 on Iris, 4 of 500 on BB84, 15 of 1,000 on MNIST. The direction is inconsistent — MNIST is 1.5 points better under the hardware alpha, BB84 0.8 worse, each inside the other's interval. So this is a small perturbation these splits cannot resolve, which is the honest reading in both directions.

Scored on held-out data the rule reaches **96.7% on Iris** (29 of 30) and **89.1% on MNIST 6-vs-9**, against 100% and 91.6% for a logistic regression fitted to the same two features. On Iris the gap is not the quantum part — the exact classical α changes none of the 30 predictions — but the paper's fixed map geometry, which leaves the rule leaning on sepal width where petal length separates the pair on its own.

The run also sat 0.0127 from ideal by Jensen–Shannon divergence against the paper's 0.130 on IBMQX2 in 2019. That gap is seven years of IBM's hardware rather than anything built here — the circuit transpiles to depth 18 against the paper's logical depth 7 — so it is reported as context, not as a result.

## It predicts in your browser

The exact preprocessing and softmax the server runs are ported client-side, on weights exported from the same models, and CI re-scores those committed weights on the real test splits so they cannot drift from the server. **BB84 as a dataset** — simulated key-distribution sessions, the video chat's channel physics, classified as clean or eavesdropped from QBER and sifted-key rate — landed with zero changes to the serving tier. Being a simulator classifying a simulator, its accuracy is bounded by how the generator's two regimes were set, which the model card says.

## Stack

PyTorch · PennyLane for the variational classifiers and Qiskit for the QSVM recreation, both optional · Flask + Server-Sent Events · a dependency-free JavaScript frontend and UI kit. 439 test functions, 564 cases with parametrization, across model architectures, training loops, API routes, persistence and the published artifacts themselves.

The math, the derivations and the hardware run are in **[the QSVM paper recreation](/writeups/qsvm-recreation/)**.
