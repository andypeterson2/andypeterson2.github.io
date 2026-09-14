---
title: The QSVM paper recreation
project: quantum-ml-classifier
summary: Yang, Awan & Vall-Llosera's NISQ-era least-squares quantum SVM, rebuilt end-to-end in modern Qiskit, verified on ibm_marrakesh, and shipped to the browser as six numbers.
---
In 2019, Yang, Awan & Vall-Llosera at Ericsson Research took the least-squares quantum SVM — an algorithm that on paper needs error-corrected hardware — and re-engineered it until it ran on a real 5-qubit IBM device ([arXiv:1909.11988](https://arxiv.org/abs/1909.11988)). The recreation lives as an [executed notebook](https://github.com/andypeterson2/quantum-machine-learning/tree/main/notebooks/qsvm-iris) in the quantum-machine-learning repo, rebuilt end-to-end in modern Qiskit — and its final classifiers run **live on [the classifier demo](/projects/ai-ml/app/)**: the QSVM rows in the Models, Predictions, and Evaluation panels are the paper's actual solved decision rule.

## The least-squares QSVM

The LS reformulation turns SVM training into a linear system over the kernel matrix (the paper's Eq. 10). In the non-offset case the decision boundary passes through the origin:

<div class="math-scroll"><math xmlns="http://www.w3.org/1998/Math/MathML" display="block"><mrow><mi>F</mi><mover><mi>&#x003B1;</mi><mo stretchy="true">&#x02192;</mo></mover><mo>&#x0003D;</mo><mover><mi>y</mi><mo stretchy="true">&#x02192;</mo></mover><mo>&#x0002C;</mo><mspace width="2em" /><mi>F</mi><mo>&#x0003D;</mo><mi>K</mi><mo>&#x0002B;</mo><msup><mi>&#x003B3;</mi><mrow><mo>&#x02212;</mo><mn>1</mn></mrow></msup><mi>I</mi></mrow></math></div>

A new point is then classified by a signed sum of kernel evaluations against the training points:

<div class="math-scroll"><math xmlns="http://www.w3.org/1998/Math/MathML" display="block"><mrow><mi>y</mi><mo stretchy="false">&#x00028;</mo><msub><mover><mi>x</mi><mo stretchy="true">&#x02192;</mo></mover><mn>0</mn></msub><mo stretchy="false">&#x00029;</mo><mo>&#x0003D;</mo><mrow><mi mathvariant="normal">s</mi><mi mathvariant="normal">g</mi><mi mathvariant="normal">n</mi></mrow><mo minsize="1.623em" maxsize="1.623em">(</mo><munderover><mo>&#x02211;</mo><mrow><mi>i</mi><mo>&#x0003D;</mo><mn>1</mn></mrow><mrow><mi>M</mi></mrow></munderover><msub><mi>&#x003B1;</mi><mi>i</mi></msub><mspace width="0.167em" /><msub><mover><mi>x</mi><mo stretchy="true">&#x02192;</mo></mover><mi>i</mi></msub><mo>&#x000B7;</mo><msub><mover><mi>x</mi><mo stretchy="true">&#x02192;</mo></mover><mn>0</mn></msub><mo minsize="1.623em" maxsize="1.623em">)</mo></mrow></math></div>

HHL solves the linear system on a quantum computer. Everything else in the paper exists to make the system small and friendly enough for a depth-7 circuit: exactly two training points — the class means — pinned by preprocessing onto a fixed geometry.

## Preprocessing: the solved map

The paper states its preprocessing as a destination, not a route; the notebook derives the route. Each class mean is pushed through an affine map (Eq. 24),

<div class="math-scroll"><math xmlns="http://www.w3.org/1998/Math/MathML" display="block"><mrow><mo stretchy="false">&#x00028;</mo><msub><mover><mi>v</mi><mo stretchy="true">&#x02192;</mo></mover><mi>i</mi></msub><msub><mo stretchy="false">&#x00029;</mo><mn>1</mn></msub><mo>&#x0003D;</mo><mi>a</mi><mspace width="0.167em" /><mo stretchy="false">&#x00028;</mo><msub><mi>t</mi><mi>i</mi></msub><msub><mo stretchy="false">&#x00029;</mo><mn>1</mn></msub><mo>&#x0002B;</mo><mi>b</mi><mo>&#x0002C;</mo><mspace width="2em" /><mo stretchy="false">&#x00028;</mo><msub><mover><mi>v</mi><mo stretchy="true">&#x02192;</mo></mover><mi>i</mi></msub><msub><mo stretchy="false">&#x00029;</mo><mn>2</mn></msub><mo>&#x0003D;</mo><mi>c</mi><mspace width="0.167em" /><mo stretchy="false">&#x00028;</mo><msub><mi>t</mi><mi>i</mi></msub><msub><mo stretchy="false">&#x00029;</mo><mn>2</mn></msub><mo>&#x0002B;</mo><mi>d</mi></mrow></math></div>

with *a, b* solved in closed form (and *c, d* hand-picked) so that after L² normalization the two training points land exactly on the paper's fixed targets:

<div class="math-scroll"><math xmlns="http://www.w3.org/1998/Math/MathML" display="block"><mrow><msub><mover><mi>x</mi><mo stretchy="true">&#x02192;</mo></mover><mn>1</mn></msub><mo>&#x0003D;</mo><mo stretchy="false">&#x00028;</mo><mn>0.987</mn><mo>&#x0002C;</mo><mtext>&#x000A0;</mtext><mn>0.159</mn><mo stretchy="false">&#x00029;</mo><mo>&#x0002C;</mo><mspace width="2em" /><msub><mover><mi>x</mi><mo stretchy="true">&#x02192;</mo></mover><mn>2</mn></msub><mo>&#x0003D;</mo><mo stretchy="false">&#x00028;</mo><mn>0.345</mn><mo>&#x0002C;</mo><mtext>&#x000A0;</mtext><mn>0.935</mn><mo stretchy="false">&#x00029;</mo></mrow></math></div>

Because the training geometry is fixed, the quantum solution is **dataset-independent** — only the four map coefficients change between Iris and MNIST.

## The quantum pipeline

The **kernel oracle** is a depth-1 circuit whose raw measurement counts reconstruct the 2×2 kernel matrix — no state tomography. The **optimized HHL solver** is the paper's 4-qubit shallow circuit (Fig. 10), reconstructed from the text; its shot readout yields α ∝ (0.51, −0.49), which the notebook **verifies against the classical LS-SVM solution** α ∝ (1, −1) — the sign rule is identical, so the deployed classifier is provably the classical solution with the quantum measurement's ~1.5° boundary tilt.

## Results — and the rule you're clicking

On held-out data the rule scores **96.7% on Iris** (setosa vs versicolor from sepal width and petal length; 29 of 30). The same quantum solution, with only the map coefficients changed, scores **89.1% on MNIST 6-vs-9** (1,000 held-out digits) using the paper's pixel-ratio features — the fraction of ink in the left vs right and top vs bottom halves of the image. A classical logistic regression fitted to the same points scores 100% and 91.6%: a two-number quantum solution lands a few points under a classical linear model on the same features, which is what it should do.

The notebook closes with the paper's own noise yardstick — the Jensen–Shannon divergence between ideal and measured output distributions — first under a depolarizing + readout model standing in for the retired IBMQX2, and then **on real hardware**: the same optimized circuit executed on **ibm_marrakesh** (2026, 8192 raw shots) scored **D_JS = 0.0127** against the paper's **0.130** on IBMQX2 in 2019 — *ten times closer to ideal, measured with the paper's own yardstick, before any error mitigation* — the same circuit, seven years of hardware later.

(The error-suppressed run scored 0.0211 — honestly recorded as slightly worse than raw at this depth.) The hardware α readout reproduced every deployed accuracy within a point, so **the six numbers in your browser now include an α read out from a real quantum computer**, with the run cached and provenance-stamped in the repo.

What ships to your browser is the whole thing collapsed to six numbers:

<div class="math-scroll"><math xmlns="http://www.w3.org/1998/Math/MathML" display="block"><mrow><mi>s</mi><mo>&#x0003D;</mo><msub><mi>w</mi><mn>1</mn></msub><mspace width="0.167em" /><mo stretchy="false">&#x00028;</mo><mi>a</mi><msub><mi>f</mi><mn>1</mn></msub><mo>&#x0002B;</mo><mi>b</mi><mo stretchy="false">&#x00029;</mo><mo>&#x0002B;</mo><msub><mi>w</mi><mn>2</mn></msub><mspace width="0.167em" /><mo stretchy="false">&#x00028;</mo><mi>c</mi><msub><mi>f</mi><mn>2</mn></msub><mo>&#x0002B;</mo><mi>d</mi><mo stretchy="false">&#x00029;</mo></mrow></math></div>

Two of the six, *w*₁ and *w*₂, are the quantum solution, and they are the same pair for Iris, MNIST and BB84; the other four are each dataset's map, solved classically. Draw a six, and that one line — the paper's map plus one dot product — decides. The weights are exported closed-form from the quantum-machine-learning repo with provenance stamped, and CI re-derives them on every run.
