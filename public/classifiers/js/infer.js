"use strict";
/* =============================================================
   Client-side classifier inference — the zero-backend demo tier.

   Loads a compact model (public/classifiers/models/<name>.json, exported and
   drift-checked by the quantum-machine-learning repo) and runs its forward
   pass in the browser. Two kinds:
     - "linear": normalise → matmul → softmax → argmax (the platform models);
     - "qsvm":   the Yang et al. 2019 paper recreation — a 2-D affine map plus
                 one dot product; a sign classifier, so no probabilities.
   Both return the { prediction, confidence, probs } shape the server /predict
   route does (qsvm with null confidence — no fabricated numbers), so the
   existing renderers just work. No backend, no WASM.
   ============================================================= */
(function () {

  const _cache = {};

  /** Fetch + cache a model spec (same-origin JSON) by asset name. */
  function loadModel(dataset) {
    if (_cache[dataset]) return _cache[dataset];
    const p = fetch(`/classifiers/models/${dataset}.json`).then((r) => {
      if (!r.ok) throw new Error(`model '${dataset}' unavailable (${r.status})`);
      return r.json();
    });
    _cache[dataset] = p;
    return p;
  }

  /**
   * Normalise a raw input vector per the model's spec: divide by `scale`, then
   * z-score with mean/std. mean/std of length 1 broadcast across all inputs
   * (images); length == input applies per-feature (tabular).
   */
  function normalize(raw, spec) {
    const { scale, mean, std } = spec;
    const out = new Float64Array(raw.length);
    for (let i = 0; i < raw.length; i++) {
      const m = mean[i % mean.length];
      const s = std[i % std.length];
      out[i] = (raw[i] / scale - m) / s;
    }
    return out;
  }

  /** Numerically stable softmax. */
  function softmax(logits) {
    let max = -Infinity;
    for (const v of logits) if (v > max) max = v;
    let sum = 0;
    const exps = logits.map((v) => {
      const e = Math.exp(v - max);
      sum += e;
      return e;
    });
    return exps.map((e) => e / sum);
  }

  /**
   * Forward pass of a single linear layer:
   *   logits[o] = bias[o] + Σ_i weight[o][i] · x[i]
   * then softmax + argmax.
   *
   * @returns {{prediction: string, confidence: number, probs: number[]}}
   */
  function predictLinear(model, raw) {
    const x = normalize(raw, model.normalize);
    const { weight, bias, classes } = model;
    const logits = new Array(weight.length);
    for (let o = 0; o < weight.length; o++) {
      const row = weight[o];
      let acc = bias[o];
      for (let i = 0; i < row.length; i++) acc += row[i] * x[i];
      logits[o] = acc;
    }
    const probs = softmax(logits);
    let best = 0;
    for (let i = 1; i < probs.length; i++) if (probs[i] > probs[best]) best = i;
    return { prediction: classes[best], confidence: probs[best], probs };
  }

  /**
   * The QSVM paper recreation's deployed rule (arXiv:1909.11988):
   *   s = w1·(a·f1 + b) + w2·(c·f2 + d),  s > 0 → classes[0].
   * For pixel input the two features are the paper's ink ratios
   * (left/right and top/bottom black-pixel counts on the 28×28 grid);
   * tabular input arrives as [f1, f2] already. A sign classifier has no
   * probability distribution — confidence is honestly null.
   */
  /**
   * The paper's ink-ratio features from the 28×28 grid: black-pixel counts in
   * the left/right and top/bottom halves. The Math.max guard covers a blank
   * half (counts are integers, so it only engages at zero).
   */
  function inkRatios(raw, threshold) {
    let left = 0, right = 0, top = 0, bottom = 0;
    for (let i = 0; i < 784; i++) {
      if (raw[i] <= threshold) continue;
      if (i % 28 < 14) left++; else right++;
      if (i < 14 * 28) top++; else bottom++;
    }
    return [left / Math.max(right, 1), top / Math.max(bottom, 1)];
  }

  function predictQsvm(model, raw) {
    const [f1, f2] = model.raw_input === "pixels" ? inkRatios(raw, model.ink_threshold) : raw;
    const { w, map, classes } = model;
    const s = w[0] * (map.a * f1 + map.b) + w[1] * (map.c * f2 + map.d);
    return { prediction: s > 0 ? classes[0] : classes[1], confidence: null, probs: null };
  }

  /** Dispatch on the model's kind (default: the linear platform models). */
  function predict(model, raw) {
    return model.kind === "qsvm" ? predictQsvm(model, raw) : predictLinear(model, raw);
  }

  window.ClassifierInfer = { loadModel, predict };
})();
