/**
 * The skill-linker viewer's arithmetic and the names it puts on things, with no DOM
 * in it.
 *
 * The page is served the candidates three models returned for every sentence in
 * the ESCO skill-linking test split. Every number it shows is reduced from those
 * rows here, so a reader who scrolls the rows can arrive at the same figure the
 * writeup quotes instead of taking it on trust.
 */

/** One model's arm of the comparison, with the aggregate its own run recorded. */
export interface DemoArm {
  model: string;
  label: string;
  published_rp5: Partial<Record<string, number>>;
}

/** One benchmark set: the sentences, their correct skills, and each arm's candidates. */
export interface DemoSet {
  n_queries: number;
  n_targets: number;
  text: string[];
  gold: number[][];
  top: Partial<Record<string, number[][]>>;
}

export interface SkillLinkerDemo {
  schema: number;
  split: string;
  /** How many candidates per sentence the export kept. */
  k: number;
  esco_version: string;
  arms: Partial<Record<string, DemoArm>>;
  /** The arm trained without the skills listed in `heldout`. */
  holdout_arm: string;
  /** Every skill name this file mentions; all other fields index into it. */
  labels: string[];
  heldout: number[];
  sets: Record<string, DemoSet>;
  provenance: Record<string, unknown>;
}

/** A sentence, flattened out of its set so one list can be filtered and scored. */
export interface Row {
  set: string;
  q: number;
  text: string;
  gold: number[];
  /** The subset of `gold` kept out of the holdout arm's training. */
  heldoutGold: number[];
  top: Partial<Record<string, number[]>>;
}

export const RP_K = 5;

const SET_NAMES: Partial<Record<string, string>> = {
  tech: 'TECH',
  house: 'HOUSE',
  techwolf: 'TECHWOLF',
};

/** What each arm is called in the view. Its run label stays beside it, never instead. */
const ARM_NAMES: Partial<Record<string, string>> = {
  stock: 'Stock MiniLM',
  tuned: 'Fine-tuned',
  holdout: 'Fine-tuned, these skills held out',
};

export const pct = (value: number) => `${(value * 100).toFixed(1)}%`;

export const setName = (key: string) => SET_NAMES[key] ?? key.toUpperCase();

export function armName(demo: SkillLinkerDemo, key: string): string {
  return ARM_NAMES[key] ?? demo.arms[key]?.label ?? key;
}

/** The label the arm's own published run was recorded under. */
export function armRun(demo: SkillLinkerDemo, key: string): string {
  return demo.arms[key]?.label ?? key;
}

/**
 * Share of a sentence's correct skills found in the first k candidates.
 *
 * The divisor is min(k, number of correct skills), matching the R-precision at k the
 * benchmark reports: a sentence with one correct skill scores 1 or 0, and one with
 * six scores in fifths.
 */
export function rpAt(gold: number[], ranked: number[], k = RP_K): number {
  if (gold.length === 0) return 0;
  const head = ranked.slice(0, k);
  let hits = 0;
  for (const g of gold) if (head.includes(g)) hits++;
  return hits / Math.min(k, gold.length);
}

/** Rank of a skill among the candidates, or -1 when it is deeper than the export goes. */
export function rankOf(skill: number, ranked: number[]): number {
  return ranked.indexOf(skill);
}

/**
 * Where one arm put a sentence's correct skills, as a cell: "3, 418".
 *
 * Ranks count from 1 for a reader. A skill the export never reached reads as deeper
 * than the depth rather than as a rank, since its true position is not in the file.
 */
export function rankCell(row: Row, arm: string, depth: number): string {
  const ranked = row.top[arm] ?? [];
  return row.gold
    .map((g) => {
      const rank = rankOf(g, ranked);
      return rank < 0 ? `>${String(depth)}` : String(rank + 1);
    })
    .join(', ');
}

export interface Summary {
  /** Sentences counted. */
  queries: number;
  /** (sentence, correct skill) pairs counted. */
  pairs: number;
  rp5: number;
  hit5: number;
  /** Reciprocal rank of the best-placed correct skill, truncated at the export depth. */
  mrr: number;
}

/**
 * Reduce rows to one arm's figures.
 *
 * `golds` picks which correct skills of a row to count, so the held-out filter can
 * score one skill of a sentence and ignore the rest of it. hit@5 counts pairs,
 * following the ablation's own definition; RP@5 and the reciprocal rank average
 * over sentences.
 */
export function summarize(
  rows: Row[],
  arm: string,
  golds: (row: Row) => number[] = (row) => row.gold,
): Summary {
  let rp = 0;
  let rr = 0;
  let hits = 0;
  let pairs = 0;
  let queries = 0;
  for (const row of rows) {
    const gold = golds(row);
    const ranked = row.top[arm];
    if (gold.length === 0 || !ranked) continue;
    queries++;
    rp += rpAt(gold, ranked);
    const placed = placements(gold, ranked);
    hits += placed.hits;
    pairs += placed.pairs;
    rr += placed.reciprocal;
  }
  return {
    queries,
    pairs,
    rp5: queries ? rp / queries : 0,
    hit5: pairs ? hits / pairs : 0,
    mrr: queries ? rr / queries : 0,
  };
}

/** Where one sentence's correct skills landed: how many near the top, and the best. */
function placements(
  gold: number[],
  ranked: number[],
): { hits: number; pairs: number; reciprocal: number } {
  let hits = 0;
  let best = Infinity;
  for (const g of gold) {
    const rank = rankOf(g, ranked);
    if (rank < 0) continue;
    if (rank < RP_K) hits++;
    if (rank < best) best = rank;
  }
  return { hits, pairs: gold.length, reciprocal: best < Infinity ? 1 / (1 + best) : 0 };
}

/** Flatten the sets into one list, marking which correct skills were held out. */
export function buildRows(demo: SkillLinkerDemo): Row[] {
  const heldout = new Set(demo.heldout);
  const rows: Row[] = [];
  for (const [set, data] of Object.entries(demo.sets)) {
    for (let q = 0; q < data.text.length; q++) {
      const gold = data.gold[q] ?? [];
      const top: Partial<Record<string, number[]>> = {};
      for (const arm of Object.keys(data.top)) {
        const ranked = data.top[arm]?.[q];
        if (ranked) top[arm] = ranked;
      }
      rows.push({
        set,
        q,
        text: data.text[q] ?? '',
        gold,
        heldoutGold: gold.filter((g) => heldout.has(g)),
        top,
      });
    }
  }
  return rows;
}

export type Outcome = 'hit' | 'miss' | 'partial';

/** How an arm did on one sentence: every correct skill in the top five, some, or none. */
export function outcome(row: Row, arm: string): Outcome {
  const score = rpAt(row.gold, row.top[arm] ?? []);
  if (score === 0) return 'miss';
  return score === 1 ? 'hit' : 'partial';
}

export interface Filters {
  /** A set name, or 'all'. */
  set: string;
  /** Keep only sentences this arm hit, missed, or partly recovered. 'any' keeps all. */
  outcome: Outcome | 'any';
  /** The arm the outcome filter applies to. */
  outcomeArm: string;
  /** Keep only sentences with a correct skill held out of training. */
  heldoutOnly: boolean;
}

export function applyFilters(rows: Row[], filters: Filters): Row[] {
  return rows.filter((row) => {
    if (filters.set !== 'all' && row.set !== filters.set) return false;
    if (filters.heldoutOnly && row.heldoutGold.length === 0) return false;
    if (filters.outcome !== 'any' && outcome(row, filters.outcomeArm) !== filters.outcome) {
      return false;
    }
    return true;
  });
}

const cache: { demo?: Promise<SkillLinkerDemo> } = {};

/** Fetch and cache the export (same-origin JSON, read once per page). */
export function loadDemo(url = '/skill-linker/demo.json'): Promise<SkillLinkerDemo> {
  const hit = cache.demo;
  if (hit) return hit;
  const pending = fetch(url).then((r) => {
    if (!r.ok) throw new Error(`benchmark data unavailable (${String(r.status)})`);
    return r.json() as Promise<SkillLinkerDemo>;
  });
  cache.demo = pending;
  return pending;
}
