---
title: Quantum ML Classifier Platform
summary: A plugin-based ML platform where every published accuracy carries its uncertainty and is held there by a test — plus Yang et al.'s NISQ-era quantum SVM rebuilt in modern Qiskit and run on IBM hardware.
---

An extensible platform for training, evaluating, and comparing classifiers — built so a new dataset drops in as a **plugin** without touching existing code, and so that **every published accuracy carries its uncertainty and is held there by a test**.

## How it works

Each dataset is a plugin that declares its models, preprocessing, and UI config. MNIST ships a CNN, a linear model and a hinge-loss SVM; the tabular datasets ship a linear model, an SVM and a variational quantum circuit each, and PennyLane is an optional extra, so a lean install simply does not offer the quantum rows rather than failing at train time. Everything trains with **live curves streamed over Server-Sent Events**, and evaluates past a single accuracy number: per-class breakdowns, **knowledge distillation**, **ensembles**, and **ablation studies**.

## The result

Across the datasets, nothing quantum wins. On Iris the SVM scores 96.7% against the variational quantum classifier's 83.3%; on the BB84 session data it is 95.4% against 90.0%; the MNIST CNN reaches 98.8% and has no quantum entrant. Those are the published runs, and every ten-seed mean sits below its published figure: on Iris, 93.7% for the SVM, 88.3% for the linear model and 78.0% for the quantum one. That spread is what the tables exist to show.

The deeper result is a smaller one. Yang et al.'s 2019 least-squares QSVM is rebuilt end to end and its decision rule ships to the browser as six numbers. Four are solved classically from the class means; the other two come from an HHL circuit run on **ibm_marrakesh**. The run measures how well a device reproduces a known answer, not whether HHL's precision matters — a 2×2 system at condition number 2.5 says nothing about that. The question it can answer is what the error it does make was worth.

A single split said the hardware's answer was better than the exact one, at `p = 7.9×10⁻⁶`. Resampling the fit sixty times made that difference disappear. The sweep then said why: on this map the exact answer is not the optimum either, so a more precise readout would not have helped.

The derivation, since the conclusion rests on it. The rule decides by `sign(v · w)`, so the measured alpha's scale cancels and only the ratio of its two components reaches the boundary — one scalar, which came out **3.3% from its exact value**. Alpha's sign pattern is not measured at all, but taken from the ideal solution. Holding the map, orientation and split fixed and rebuilding the rule from the exact classical alpha tilts the boundary **1.58°** and changes **166 of 13,664** held-out predictions — none of the 30 Iris points, 166 of the 13,634 MNIST digits. Both rules score the same digits, so the test is McNemar's on the 112 pairs the measured alpha gets right against the 54 it gets wrong: **p = 7.9×10⁻⁶**, a real **+0.42 points [0.24, 0.61]**.

Then redrawing the 200-digit fit sample 60 times: the difference averages **−0.03 points, sd 0.29**, measured alpha ahead in 28 draws and behind in 30, with a 95% interval on the mean that admits zero — against a spread from the sample alone three times as wide, sd **0.86**. Half the individual draws clear `p < 0.05`, in both directions, which is what makes a single split's p-value a fact about that split. Sweeping the ratio alpha reduces to finishes it: accuracy peaks at 1.20, past both the exact solution's 1.0 and the hardware's 1.03.

Scored on held-out data the rule reaches **96.7% on Iris** — the same 29 of 30 the classical SVM gets, by coincidence rather than by agreement — and **89.8% on MNIST 6-vs-9** (13,634 digits), against 100% and 90.9% for a logistic regression fitted to the same two features. On Iris the gap is not the quantum part — the exact classical α changes none of the 30 predictions — but the paper's fixed map geometry, which leaves the rule leaning on sepal width where petal length separates the pair on its own. A second model widens that rule to all three species and all four measurements by running it once per pair and voting: 87.3% over 20 splits, on the same measured α, since the widened targets leave the kernel matrix alone.

Across a corpus the preprocessing was never fitted to, the advantage reverses: on all 45 Fashion-MNIST class pairs the measured alpha is behind the exact one on 32 of the 33 pairs that resolve at all. So the sign of that MNIST difference belongs to the corpus, not to the readout. All 45 are reported, because choosing one would be choosing the answer — and the rule travels no better than the alpha does, at a median 62.1% against 73.4% for a logistic regression on the same two features, ahead of it on 6 pairs of 45.

The run also sat 0.0127 from ideal by Jensen–Shannon divergence against the paper's 0.130 on IBMQX2 in 2019. That gap is seven years of IBM's hardware rather than anything built here — the circuit transpiles to depth 18 against the paper's logical depth 7 — so it is reported as context, not as a result.

The math, the derivations and the hardware run are in **[the QSVM paper recreation](/writeups/qsvm-recreation/)**.

## What's checked

The discipline is the point of the project. Each published accuracy is one seeded run scored on the full test split, and it ships with **two** error components, because one of them alone is misleading. The 95% Wilson interval covers sampling error. The spread across ten seeds covers the rest — and on Iris that spread is the larger of the two, wide enough that the published run turns out to be the best of its ten on two of the three rows. The artifact records every seed so the estimator can be changed after the fact, and a test holds every served document, every README table and the browser weights to it. A model nobody measured has to say so.

Negative results stay in. Distilling the MNIST CNN into the linear student **costs** about a point and is worse on all three seeds. Error mitigation on the hardware run made the divergence worse, not better. The quantum rows lose to their classical baselines, and the tables print them losing.

The exact preprocessing and softmax the server runs are ported client-side, on weights exported from the same models, and CI re-scores those committed weights on the real test splits so they cannot part company with the server. 439 test functions, 564 cases with parametrization, cover model architectures, training loops, API routes, persistence and the published artifacts themselves.
