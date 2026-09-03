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

export interface NormalizeSpec {
  scale: number;
  mean: number[];
  std: number[];
}

interface ModelDisplay {
  label?: string;
  subset?: string;
}

/** The linear platform models (mnist.json, iris.json). */
export interface LinearModel {
  kind?: 'linear';
  normalize: NormalizeSpec;
  weight: number[][];
  bias: number[];
  classes: string[];
  features?: string[];
  feature_ranges?: [number, number][];
  test_accuracy?: number;
  display?: ModelDisplay;
}

/** The QSVM paper recreation (qsvm-mnist.json, qsvm-iris.json). */
export interface QsvmModel {
  kind: 'qsvm';
  raw_input?: 'pixels' | 'features';
  ink_threshold: number;
  w: [number, number];
  map: { a: number; b: number; c: number; d: number };
  classes: [string, string];
  num_params?: number;
  features?: string[];
  feature_ranges?: [number, number][];
  test_accuracy?: number;
  display?: ModelDisplay;
}

export type ClassifierModel = LinearModel | QsvmModel;

export interface Prediction {
  prediction: string;
  confidence: number | null;
  probs: number[] | null;
}

export interface ClassifierInferApi {
  loadModel(dataset: string): Promise<ClassifierModel>;
  predict(model: ClassifierModel, raw: number[]): Prediction;
}

const cache: Partial<Record<string, Promise<ClassifierModel>>> = {};

/** Fetch + cache a model spec (same-origin JSON) by asset name. */
function loadModel(dataset: string): Promise<ClassifierModel> {
  const hit = cache[dataset];
  if (hit) return hit;
  const p = fetch(`/classifiers/models/${dataset}.json`).then((r) => {
    if (!r.ok) throw new Error(`model '${dataset}' unavailable (${String(r.status)})`);
    // Trusted same-origin asset, drift-checked against the exporting repo's CI.
    return r.json() as Promise<ClassifierModel>;
  });
  cache[dataset] = p;
  return p;
}

/**
 * Normalise a raw input vector per the model's spec: divide by `scale`, then
 * z-score with mean/std. mean/std of length 1 broadcast across all inputs
 * (images); length == input applies per-feature (tabular).
 */
function normalize(raw: number[], spec: NormalizeSpec): Float64Array {
  const { scale, mean, std } = spec;
  const out = new Float64Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    const m = mean[i % mean.length] ?? 0;
    const s = std[i % std.length] ?? 1;
    out[i] = ((raw[i] ?? 0) / scale - m) / s;
  }
  return out;
}

/** Numerically stable softmax. */
function softmax(logits: number[]): number[] {
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
 */
function predictLinear(model: LinearModel, raw: number[]): Prediction {
  const x = normalize(raw, model.normalize);
  const { weight, bias, classes } = model;
  const logits = new Array<number>(weight.length);
  for (let o = 0; o < weight.length; o++) {
    const row = weight[o] ?? [];
    let acc = bias[o] ?? 0;
    for (let i = 0; i < row.length; i++) acc += (row[i] ?? 0) * (x[i] ?? 0);
    logits[o] = acc;
  }
  const probs = softmax(logits);
  let best = 0;
  for (let i = 1; i < probs.length; i++) if ((probs[i] ?? 0) > (probs[best] ?? 0)) best = i;
  return { prediction: classes[best] ?? '', confidence: probs[best] ?? 0, probs };
}

/**
 * The paper's ink-ratio features from the 28×28 grid: black-pixel counts in
 * the left/right and top/bottom halves. The Math.max guard covers a blank
 * half (counts are integers, so it only engages at zero).
 */
function inkRatios(raw: number[], threshold: number): [number, number] {
  let left = 0,
    right = 0,
    top = 0,
    bottom = 0;
  for (let i = 0; i < 784; i++) {
    if ((raw[i] ?? 0) <= threshold) continue;
    if (i % 28 < 14) left++;
    else right++;
    if (i < 14 * 28) top++;
    else bottom++;
  }
  return [left / Math.max(right, 1), top / Math.max(bottom, 1)];
}

/**
 * The QSVM paper recreation's deployed rule (arXiv:1909.11988):
 *   s = w1·(a·f1 + b) + w2·(c·f2 + d),  s > 0 → classes[0].
 * For pixel input the two features are the paper's ink ratios; tabular input
 * arrives as [f1, f2] already. A sign classifier has no probability
 * distribution — confidence is honestly null.
 */
function predictQsvm(model: QsvmModel, raw: number[]): Prediction {
  const [f1, f2] =
    model.raw_input === 'pixels' ? inkRatios(raw, model.ink_threshold) : [raw[0] ?? 0, raw[1] ?? 0];
  const { w, map, classes } = model;
  const s = w[0] * (map.a * f1 + map.b) + w[1] * (map.c * f2 + map.d);
  return { prediction: s > 0 ? classes[0] : classes[1], confidence: null, probs: null };
}

/** Dispatch on the model's kind (default: the linear platform models). */
function predict(model: ClassifierModel, raw: number[]): Prediction {
  return model.kind === 'qsvm' ? predictQsvm(model, raw) : predictLinear(model, raw);
}

export const ClassifierInfer: ClassifierInferApi = { loadModel, predict };

window.ClassifierInfer = ClassifierInfer;
