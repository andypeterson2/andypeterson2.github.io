---
title: The QSVM paper recreation
project: quantum-ml-classifier
summary: Yang, Awan & Vall-Llosera's NISQ-era least-squares quantum SVM, rebuilt end-to-end in modern Qiskit, verified on ibm_marrakesh, and shipped to the browser as six numbers.
---
In 2019, Yang, Awan & Vall-Llosera at Ericsson Research took the least-squares quantum SVM — an algorithm that on paper needs error-corrected hardware — and re-engineered it until it ran on a real 5-qubit IBM device ([arXiv:1909.11988](https://arxiv.org/abs/1909.11988)). The recreation lives as an [executed notebook](https://github.com/andypeterson2/quantum-machine-learning/tree/main/notebooks/qsvm-iris) in the quantum-machine-learning repo, rebuilt end-to-end in modern Qiskit — and its final classifiers run **live on [the classifier demo](/projects/ai-ml/app/)**: the QSVM rows in the models table are the paper's actual solved decision rule, on Iris and MNIST under the paper's own parameters.

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

The **kernel oracle** is a depth-1 circuit whose raw measurement counts reconstruct the 2×2 kernel matrix — no state tomography. The **optimized HHL solver** is the paper's 4-qubit shallow circuit (Fig. 10), reconstructed from the text; its shot readout under the Aer simulator yields α ∝ (0.51, −0.49), and the ibm_marrakesh run yields the (0.501, −0.485) that ships; the notebook **verifies both against the classical LS-SVM solution** α ∝ (1, −1) — the sign rule is identical, so the deployed classifier is provably the classical solution with the quantum measurement's ~1.5° boundary tilt.

## Results — and the rule you're clicking

On held-out data the rule scores **96.7% on Iris** (setosa vs versicolor from sepal width and petal length; 29 of 30, 95% CI 83.3–99.4%). The same quantum solution, with only the map coefficients changed, scores **89.8% on MNIST 6-vs-9** (every other 6 and 9 in the corpus, 13,634 digits, 95% CI 89.2–90.2%) using the paper's pixel-ratio features — the fraction of ink in the left vs right and top vs bottom halves of the image. A classical logistic regression fitted to the same points scores 100% and 90.9%.

On Iris, none of that 3.3-point gap is the quantum part: rebuilding the rule from the exact classical α changes none of the 30 predictions. The gap is the paper's fixed map geometry. Pinning the two class means to the paper's targets solves *a* to 7.67 while *c* stays at the paper's 0.95, so in raw units the shipped Iris rule reads

<div class="math-scroll"><code>s = 2.505·sepal_width − 0.357·petal_length − 6.377</code></div>

— sepal width at about seven times the weight of petal length, on a pair that petal length separates by itself (setosa reaches 1.9 cm, versicolor starts at 3.0). A depth-1 decision stump gets 100% on this pair in 10-fold cross-validation, so 96.7% is below the floor a trivial fitted model sets, and the single miss is a wide-sepalled versicolor at (3.3, 4.7). The demo loads on (sepal width 3.2, petal length 4.0), where the rule answers setosa and the logistic regression beside it answers versicolor; the logistic regression is right. What the recreation shows at this point is the paper's geometry, not a competitive classifier.

## All three species, on the same alpha

The rule above is the paper's Iris experiment, and the paper's Iris experiment is two species and
two of the four measurements. A second model in the demo widens it: the same rule run once per
pair of species over all four columns, with the three verdicts put to a vote. It scores
**84.4% on the held-out split** (38 of 45, 95% CI 71.2–92.3%) and **87.3% averaged over 20
independent splits**, against 96.7% for a logistic regression on the same four columns.

The quantum part does not change, and that is the interesting bit. Widening the fixed targets
across four coordinates leaves their inner product at 0.490974, so the kernel matrix, its
eigenvalues and the alpha measured on ibm_marrakesh are the same numbers — **one hardware run
still serves all three pairwise rules**, and they share a single weight vector. What would change
is the kernel oracle: four features need two qubits per training point instead of one, so the
paper's Fig. 9 circuit does not cover it. That circuit is computed classically here, and it was
not re-run.

Two things this is not. It is not the paper's Iris experiment — Sec. V-A2 names sepal width and
petal length, and those two columns are what the model beside it reads. And it is not the
least-squares quantum SVM of Rebentrost, Mohseni & Lloyd that the paper cites as [6]: that one
solves an (M+1)×(M+1) system over every training point with an offset and a kernel built from the
data, where this keeps the paper's two class means, no offset, and a kernel the preprocessing
pins to a constant. On this split the two rules agree on every point but their weight vectors sit
35.7° apart; on a harder pair they diverge to 83.8°.

Every error it makes is versicolor against virginica. Setosa it never misses, in either
direction. The limit is the map, which fits each coordinate from two class means and so cannot
represent a correlation between two of them — not the feature count, and not the quantum step.

The notebook closes with the paper's own noise yardstick — the Jensen–Shannon divergence between ideal and measured output distributions — first under a depolarizing + readout model standing in for the retired IBMQX2, and then **on real hardware**: the same optimized circuit executed on **ibm_marrakesh** (2026, 8192 raw shots) scored **D_JS = 0.0127** against the paper's **0.130** on IBMQX2 in 2019.

That ratio is not a result of this recreation. It measures seven years of IBM's hardware against a circuit the paper designed, and the only choice made here was `optimization_level=3` — which produced a transpiled depth of 18 against the paper's logical depth 7, so the comparison is not even like-for-like on the circuit. The paper ran its figures twenty times to suppress random error; this is one job. And the yardstick's base is ambiguous: Eq. 33 defines the KL term with a natural log while stating a range of [0, 1], which is base 2. In the same units, 0.0127 bits is 0.0088 nats. The gap is real and it is large, and it belongs to the device.

What belongs to the recreation is what the readout was worth downstream. The rule decides by `sign(v · w)`, so α's scale cancels and only the ratio of its two components reaches the boundary — one scalar, and it came out **3.3% from exact**, -1.0327 against -1. The `(+, -)` sign pattern is not measured at all, but taken from the ideal solution `F`⁻¹`y`. Holding the map, orientation and split fixed and rebuilding the rule from the exact classical α tilts the boundary **1.58°** and changes **166 of 13,664** held-out predictions: none of 30 on Iris, 166 of 13,634 on MNIST.

Both rules score the same digits, so the comparison is a paired one — the pairs they agree on carry no information, and comparing the two accuracy intervals instead would discard 98.8% of the data. McNemar's exact test on the 112 pairs the measured α gets right against the 54 it gets wrong gives **p = 7.9×10⁻⁶**: a real difference of **+0.42 points, 95% CI [0.24, 0.61]**. Thirty Iris samples resolve nothing either way, and are not evidence of agreement.

Resolved is not the same as meaningful, and that p-value is a fact about one fit sample. The rule is fitted to 200 digits drawn at random; redraw them 60 times, refit the map on each draw and score both α on everything that draw left out, and the difference averages **−0.03 points with a standard deviation of 0.29** — the measured α ahead in 28 draws and behind in 30, and a 95% interval on the mean of [−0.10, +0.05] that admits zero. Against that, the rule's own accuracy swings **three times as widely** on the sample alone, a standard deviation of 0.86 points. Half the individual draws clear p < 0.05, in both directions.

Why the sign is arbitrary shows up in the curve the two α sit on. Scoring the same rule across the ratio — the one number α reduces to — gives accuracy climbing straight through the exact solution's 1.0 (89.3%) and the hardware's 1.03 (89.8%) to a peak at **1.20 (90.6%)**. On this map the exact α is not the optimum, so a readout error that lands nearer the peak scores better for a reason that has nothing to do with the hardware, and a more precise α would not have helped. What the quantum step contributes is one magnitude ratio that the Eq. 24 map and the choice of (c, d) dominate — the sign of α is not measured at all, but taken from the ideal solution, so none of this bears on it.

Taking the question off MNIST settles it. Fashion-MNIST is the same 28×28 shape, so the paper's two ink ratios apply unchanged, and it has 45 class pairs the paper never fitted — 45 independent chances for the hardware α's advantage to hold. It does not: resolved on 31 pairs, **ahead on 9 and behind on 22**. The same run says something sharper about the recreation itself. The preprocessing does not travel. Median accuracy across the 45 pairs is **62.7%**, against **73.4%** for a logistic regression on the same two features; the paper's rule wins on 9 pairs of 45, and on Dress vs Bag it lands below chance. The Eq. 24 map pins two class means onto targets taken from the paper's own digits, and a corpus whose geometry sits elsewhere has no reason to land where those targets expect.

Every pair is reported, because choosing one would be choosing the answer. A pair rule stated before scoring — the largest class-mean VR gap on the fit sample, an analogue of the paper's own rotation pair — names T-shirt vs Bag, which scores 60.5%. Within each pair the orientation and (c, d) are chosen under the exact α, so the arm under test does not pick its own model; the two α would choose the same on 39 of the 45.

It is all in `exports/alpha-sensitivity.json`, `exports/alpha-ratio-sweep.json`, `exports/alpha-fit-noise.json` and `exports/qsvm-transfer.json`, recomputed by their tests rather than read back.

(The error-suppressed run scored 0.0211, recorded as slightly worse than raw at this depth.) So **the six numbers in your browser do include an α read out from a real quantum computer** — and that α moves about one prediction in eighty.

What ships to your browser is the whole thing collapsed to six numbers:

<div class="math-scroll"><math xmlns="http://www.w3.org/1998/Math/MathML" display="block"><mrow><mi>s</mi><mo>&#x0003D;</mo><msub><mi>w</mi><mn>1</mn></msub><mspace width="0.167em" /><mo stretchy="false">&#x00028;</mo><mi>a</mi><msub><mi>f</mi><mn>1</mn></msub><mo>&#x0002B;</mo><mi>b</mi><mo stretchy="false">&#x00029;</mo><mo>&#x0002B;</mo><msub><mi>w</mi><mn>2</mn></msub><mspace width="0.167em" /><mo stretchy="false">&#x00028;</mo><mi>c</mi><msub><mi>f</mi><mn>2</mn></msub><mo>&#x0002B;</mo><mi>d</mi><mo stretchy="false">&#x00029;</mo></mrow></math></div>

Two of the six, *w*₁ and *w*₂, are the quantum solution, and they are the same pair for all three datasets the repo exports; the other four are each dataset's map, solved classically. Draw a six, and that one line — the paper's map plus one dot product — decides. The weights are exported closed-form from the quantum-machine-learning repo with provenance stamped, and CI re-derives them on every run.
