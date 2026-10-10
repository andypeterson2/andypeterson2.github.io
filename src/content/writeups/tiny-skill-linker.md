---
title: Tiny Skill Linker
summary: A 22M-parameter sentence embedder fine-tuned to link resume and job-ad sentences to ESCO skills — matching a published 110M model on two of three public benchmarks.
---

Given one sentence from a resume or a job ad, which of the 13,891 skills in the European ESCO taxonomy does it describe? The usual answer is a large embedding model. This fine-tunes a **22M-parameter** one, all-MiniLM-L6-v2, and measures what the smaller model gives up.

## How it works

A skill is just a text label, so both the sentence and every skill name go through the same encoder and are ranked by cosine similarity. New skills need no retraining — they are new text, not new classes. Training follows the recipe from Decorte et al. ([arXiv:2307.10778](https://arxiv.org/abs/2307.10778)): multiple-negatives ranking loss, one epoch, batch 64, 2e-5, 5% warmup, on their synthetic ESCO sentences. One epoch is about 72 minutes on a CPU.

## Calibrate the ruler first

Before measuring anything new, the harness has to agree with the literature. Stock all-mpnet-base-v2 through this evaluation reproduces the paper's own RP@5 — **39.60 / 26.17 / 33.48** against its published 39.6 / 26.2 / 33.5 on TECH, HOUSE and TECHWOLF. Every number after this is read off an instrument known to match.

That calibration immediately moved the baseline. Stock MiniLM scores **45.57 / 33.85 / 36.74**, above stock mpnet on all three sets at a fifth of the parameters, so the thing to beat is stock MiniLM rather than the paper's stock row — the harder comparison, not the flattering one.

## What the small model gets

Fine-tuned, three seeds, mean ± sd, against the paper's best fine-tuned 110M model:

![A fifth the parameters, set by set: stock MiniLM, the fine-tuned 22M model and the published 110M model, RP@5 on TECH, HOUSE and TECHWOLF.](/figures/skill-linker/against-published.svg)

Three seeds, mean ± sd: **53.80 ± 0.88** on TECH, **46.62 ± 0.93** on HOUSE, **47.66 ± 0.48** on TECHWOLF, against the published 54.62 / 45.74 / 54.57.

So at a fifth of the size it lands within a point on TECH, goes **ahead** on HOUSE, and **loses 6.9 points on TECHWOLF**. That last column is what the smaller model costs, and the one result here that does not favour it.

Quantizing to int8 costs 0 to 1.2 RP@5 and at most 0.5 MRR, which leaves the int8 model 8 to 12 RP@5 above stock — the point being that the cheap model stays cheap without giving the gain back.

![What fine-tuning bought and what int8 gave back, as RP@5 points on one axis.](/figures/skill-linker/gain-vs-cost.svg)

## Does it generalise, or just memorise the vocabulary?

The claim that new skills work without retraining is testable, so it is tested. A separate run drops 2,765 of the 13,826 training skills — 20%, chosen at random — **and every sentence mentioning them**, then scores only the 282 test pairs whose gold skill was never seen.

![Skills the model never trained on: hit@5 for stock, for the model trained on all skills, and for the model with 2,765 skills held out, on seen and unseen skills.](/figures/skill-linker/unseen-skills.svg)

On skills it never saw, the held-out model still gains **+8.16 hit@5** over stock, 95% CI [+3.55, +12.77] by paired bootstrap, against +10.04 on skills it did see. Against the models that *did* train on those skills it sits 1.18 lower, and every interval on that comparison includes zero.

The caveat belongs next to the result: the held-out run is one seed, and only 282 test pairs involve held-out skills. The models it is compared against cover three seeds, so the spread is known on one side of that comparison and not the other.

## Where the gain stops

A gain on one task is not a gain on every task, so the model — seed 1, int8, in transformers.js — was tried on a second one: tagging 68 private resume bullets with 26 broad categories such as `system-architecture` and `leadership`. The set has one annotator, and the check was run once, after the model was chosen. It is worse than stock there — hit@3 0.809 against 0.868, a difference of **-0.059** (95% CI [-0.133, 0.000], cluster bootstrap), better on 1 bullet and worse on 5 (McNemar p = 0.22). It wins on tags named like concrete skills and loses on broad categories, which is what training on fine-grained ESCO skill names would predict. The resume tagger this site's editor uses keeps the stock model.

The bullets are not published, so these numbers cannot be reproduced from this repository. The method can be re-run: the script takes any set of texts with gold tags and writes the metrics and the input's digest, never the text.

## What's checked

No training sentence appears in any evaluation set — zero overlap, exact and after normalising case and punctuation, across all five splits. Query prefixes for the bge and arctic comparisons were chosen on validation, never on test. Weight interpolation against stock was swept under a rule fixed before the sweep, and the answer was that no blend is needed.

Every row in every table is one evaluation run stored as its own file with the library versions, dataset revisions and machine that produced it, plus a digest of the code and the weights, so a row stays checkable after the commit it names has moved.

## See it for yourself

[The benchmark viewer](/projects/tiny-skill-linker/app/) carries what the stock model, one fine-tuned seed and the held-out run ranked for all 926 test sentences, with the correct skills marked. Its RP@5 is counted in the browser from the rows on screen, so the stock row above and the gain over it can be arrived at rather than taken on trust.

## Stack

Python · sentence-transformers · PyTorch · ONNX int8 export · ESCO 1.1.0 · TechWolf's public skill-linking test sets through WorkRB, CC-BY-4.0.
