/**
 * Client-side classifier inference — the zero-backend demo tier. Runs an exported model's
 * forward pass in the browser: "linear" (normalise → matmul → softmax → argmax), "qsvm"
 * (the Yang et al. 2019 recreation: a 2-D affine map plus one dot product; a sign classifier,
 * so null confidence), or "qsvm-ovo" (that same rule once per pair of classes, then a vote).
 * All return the server /predict shape { prediction, confidence, probs }.
 */

export interface NormalizeSpec {
  scale: number;
  mean: number[];
  std: number[];
}

interface ModelDisplay {
  label?: string;
  subset?: string;
}

/** Where a weight file came from: the exporting commit, its date and the seed. */
export interface ModelProvenance {
  source_sha?: string;
  exported_at?: string;
  seed?: number;
}

/** The linear platform models (MNIST, Iris). */
export interface LinearModel {
  kind?: 'linear';
  normalize: NormalizeSpec;
  weight: number[][];
  bias: number[];
  classes: string[];
  features?: string[];
  feature_ranges?: [number, number][];
  test_accuracy?: number;
  /** Wilson interval on test_accuracy, and the sample it was measured over. */
  test_accuracy_ci?: [number, number];
  test_n?: number;
  test_protocol?: string;
  display?: ModelDisplay;
  provenance?: ModelProvenance;
}

/** The QSVM paper recreation (the qsvm-* models). */
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
  /** Wilson interval on test_accuracy, and the sample it was measured over. */
  test_accuracy_ci?: [number, number];
  test_n?: number;
  test_protocol?: string;
  display?: ModelDisplay;
  provenance?: ModelProvenance;
}

/** One pair of classes, and the map that tells them apart. */
export interface QsvmOvoRule {
  pair: [string, string];
  a: number[];
  b: number[];
}

/**
 * The three-class Iris recreation: the paper's rule run once per pair of
 * classes over all four measurements, then a vote. The widened targets keep the
 * kernel matrix, so every rule shares one `w` and one measured alpha.
 */
export interface QsvmOvoModel {
  kind: 'qsvm-ovo';
  raw_input?: 'features';
  w: number[];
  targets: number[][];
  rules: QsvmOvoRule[];
  classes: string[];
  num_params?: number;
  features?: string[];
  feature_ranges?: [number, number][];
  test_accuracy?: number;
  test_accuracy_ci?: [number, number];
  test_n?: number;
  test_protocol?: string;
  /** Mean accuracy over several splits, because one held-out split is small. */
  cv_accuracy?: number;
  cv_splits?: number;
  display?: ModelDisplay;
  provenance?: ModelProvenance;
}

export type ClassifierModel = LinearModel | QsvmModel | QsvmOvoModel;

/** One pairwise rule's verdict: who it picked, by how much, and how decisively. */
export interface QsvmContest {
  pair: [string, string];
  winner: string;
  s: number;
  lean: number;
}

export interface Prediction {
  prediction: string;
  confidence: number | null;
  probs: number[] | null;
  /**
   * The QSVM's two features, its signed margin s, and the two terms that sum to
   * it. A term's sign is the class it argues for, and its size is how loudly:
   * s is what is left when they are set against each other.
   */
  qsvm?: { f1: number; f2: number; s: number; t1: number; t2: number };
  /**
   * The three-class rule's workings: every pairwise contest, the votes they
   * cast, and the narrowest contest the winner was in — which is how close the
   * answer came to going the other way.
   */
  ovo?: {
    votes: Record<string, number>;
    contests: QsvmContest[];
    tightest: QsvmContest;
  };
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
  const t1 = w[0] * (map.a * f1 + map.b);
  const t2 = w[1] * (map.c * f2 + map.d);
  const s = t1 + t2;
  return {
    prediction: s > 0 ? classes[0] : classes[1],
    confidence: null,
    probs: null,
    qsvm: { f1, f2, s, t1, t2 },
  };
}

/** True when a 28×28 grid has no ink at all (nothing drawn yet). */
export function isBlank(raw: readonly number[]): boolean {
  return raw.every((v) => !v);
}

interface Box {
  x0: number;
  y0: number;
  w: number;
  h: number;
}

/** The bounding box of the ink in a size×size grid, or null when it's blank. */
function inkBox(raw: readonly number[], size: number): Box | null {
  let x0 = size,
    y0 = size,
    x1 = -1,
    y1 = -1;
  raw.forEach((v, i) => {
    if (!v) return;
    const x = i % size,
      y = Math.floor(i / size);
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  });
  return x1 < 0 ? null : { x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** Area-weighted mean of the source cells covering the rectangle [sx0,sx1)×[sy0,sy1). */
function cellAverage(
  raw: readonly number[],
  size: number,
  [sx0, sx1, sy0, sy1]: readonly [number, number, number, number],
): number {
  let acc = 0,
    area = 0;
  for (let sy = Math.floor(sy0); sy < Math.ceil(sy1); sy++) {
    const oy = Math.min(sy + 1, sy1) - Math.max(sy, sy0);
    for (let sx = Math.floor(sx0); sx < Math.ceil(sx1); sx++) {
      const a = (Math.min(sx + 1, sx1) - Math.max(sx, sx0)) * oy;
      if (a <= 0) continue;
      acc += (raw[sy * size + sx] ?? 0) * a;
      area += a;
    }
  }
  return area ? acc / area : 0;
}

/** Centre of mass (x, y) of a w×h grid. */
function centreOfMass(g: Float64Array, w: number): [number, number] {
  let mass = 0,
    mx = 0,
    my = 0;
  g.forEach((v, i) => {
    mass += v;
    mx += v * (i % w);
    my += v * Math.floor(i / w);
  });
  return [mx / mass, my / mass];
}

/**
 * MNIST's own preprocessing for a hand-drawn 28×28 grid: crop to the ink, scale the
 * longer side to 20px (keeping the aspect ratio, area-averaged), then place it in a
 * 28×28 frame so its centre of mass sits at the centre. The training digits went
 * through exactly this; without it a plainly drawn 7 reads as a 2 or 3.
 * Returns the grid unchanged if it's blank.
 */
export function preprocessDigit(raw: readonly number[], size = 28, box = 20): number[] {
  const b = inkBox(raw, size);
  if (!b) return Array.from(raw);
  const scale = box / Math.max(b.w, b.h);
  const tw = Math.max(1, Math.round(b.w * scale)),
    th = Math.max(1, Math.round(b.h * scale));
  const scaled = new Float64Array(tw * th);
  for (let i = 0; i < tw * th; i++) {
    const tx = i % tw,
      ty = Math.floor(i / tw);
    scaled[i] = cellAverage(raw, size, [
      b.x0 + tx / scale,
      b.x0 + (tx + 1) / scale,
      b.y0 + ty / scale,
      b.y0 + (ty + 1) / scale,
    ]);
  }
  const [cx, cy] = centreOfMass(scaled, tw);
  const ox = Math.round((size - 1) / 2 - cx),
    oy = Math.round((size - 1) / 2 - cy);
  const out = new Array<number>(size * size).fill(0);
  scaled.forEach((v, i) => {
    const x = (i % tw) + ox,
      y = Math.floor(i / tw) + oy;
    if (x >= 0 && y >= 0 && x < size && y < size) out[y * size + x] = Math.round(v);
  });
  return out;
}

/**
 * The three-class rule: score every pair, vote, and report how near the
 * narrowest of the winner's contests came to flipping.
 *
 * Each pairwise score is taken on the unit circle (paper Eq. 22), unlike the
 * binary rule which skips the normalisation because scaling leaves a sign
 * alone. Here the sizes are compared across rules, so they have to share a
 * scale. `lean` is the score as a share of the evidence behind it, the same
 * ratio the binary rule's cell reports.
 */
function predictQsvmOvo(model: QsvmOvoModel, raw: number[]): Prediction {
  const { w, rules, classes } = model;
  const votes: Record<string, number> = {};
  for (const c of classes) votes[c] = 0;
  const contests: QsvmContest[] = rules.map((rule) => {
    let dot = 0;
    let norm = 0;
    const terms = w.map((wk, k) => {
      const v = (rule.a[k] ?? 0) * (raw[k] ?? 0) + (rule.b[k] ?? 0);
      norm += v * v;
      return wk * v;
    });
    const scale = Math.sqrt(norm) || 1;
    let total = 0;
    for (const t of terms) {
      dot += t / scale;
      total += Math.abs(t / scale);
    }
    const winner = dot > 0 ? rule.pair[0] : rule.pair[1];
    votes[winner] = (votes[winner] ?? 0) + 1;
    return { pair: rule.pair, winner, s: dot, lean: total === 0 ? 0 : dot / total };
  });
  // Ties go to the class whose wins were widest; three rules can split 1-1-1.
  let prediction = classes[0] ?? '';
  let best = [-1, -1];
  for (const c of classes) {
    const width = contests
      .filter((k) => k.winner === c)
      .reduce((acc, k) => acc + Math.abs(k.lean), 0);
    if ((votes[c] ?? 0) > (best[0] ?? 0) || ((votes[c] ?? 0) === best[0] && width > (best[1] ?? 0))) {
      best = [votes[c] ?? 0, width];
      prediction = c;
    }
  }
  const won = contests.filter((k) => k.winner === prediction);
  const ranked = (won.length > 0 ? won : contests).reduce((a, k) =>
    Math.abs(k.lean) < Math.abs(a.lean) ? k : a,
  );
  return {
    prediction,
    confidence: null,
    probs: null,
    ovo: { votes, contests, tightest: ranked },
  };
}

/** Dispatch on the model's kind (default: the linear platform models). */
function predict(model: ClassifierModel, raw: number[]): Prediction {
  if (model.kind === 'qsvm') return predictQsvm(model, raw);
  if (model.kind === 'qsvm-ovo') return predictQsvmOvo(model, raw);
  return predictLinear(model, raw);
}

export const ClassifierInfer: ClassifierInferApi = { loadModel, predict };
