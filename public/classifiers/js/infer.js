"use strict";
/* =============================================================
   Client-side classifier inference — the zero-backend demo tier.

   Loads a compact linear model (public/classifiers/models/<dataset>.json,
   produced by scripts/export-classifier-models.py) and runs its forward pass
   in the browser: normalise → linear → softmax → argmax. Returns the same
   { prediction, confidence, probs } shape the server /predict route does, so
   the existing renderers just work. No backend, no WASM — a plain matmul over
   a few thousand weights. This is what lets a visitor draw a digit (or enter
   flower measurements) and get a prediction with nothing running.
   ============================================================= */
(function () {

  const _cache = {};

  /** Fetch + cache a model spec (same-origin JSON) by dataset name. */
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
  function predict(model, raw) {
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

  window.ClassifierInfer = { loadModel, predict };
})();
