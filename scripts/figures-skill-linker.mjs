/**
 * Draw the skill-linker results as standalone figures.
 *
 * Three claims, one figure each: what the small model scores against a published model
 * five times its size, what it keeps on skills it never trained on, and what quantizing
 * costs. Build artifacts: run `npm run figures:skill-linker` after the measurements change.
 *
 * 1-bit, as the rest of the site is. A series is told apart by fill and by its own label,
 * never by a hue: solid ink is the subject, stipple is the model it is measured against,
 * and paper with a rule is the baseline it started from.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { W, INK, PAPER, text, bar, note, figureWriter } from './lib/figure-kit.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const figure = figureWriter(join(root, 'public/figures/skill-linker'));
const d = (
  await import(join(root, 'src/data/skill-linker-benchmarks.json'), { with: { type: 'json' } })
).default;

const SETS = ['tech', 'house', 'techwolf'];
const LABEL = { tech: 'TECH', house: 'HOUSE', techwolf: 'TECHWOLF' };
const PROVENANCE =
  `Retrieval precision at 5, ranking all ${d.targets.toLocaleString('en-US')} ESCO 1.1.0 skills per sentence. ` +
  `TECH ${d.sets.tech}, HOUSE ${d.sets.house}, TECHWOLF ${d.sets.techwolf} held-out queries.`;

/** Paper fill with a rule, stipple, and solid ink: the three fills a series can take. */
const FILLS = { base: PAPER, context: 'url(#stipple)', subject: INK };

/** A value label sits above its bar, or inside it when the bar is the tall one. */
function barLabel(x, y, value, { inside = false } = {}) {
  return text(x, inside ? y + 13 : y - 4, value.toFixed(1), {
    size: 10,
    anchor: 'middle',
    weight: 700,
  }).replace(inside ? `fill="${INK}"` : 'x=', inside ? `fill="${PAPER}"` : 'x=');
}

/** A key naming each fill, since fill is the only thing telling the series apart. */
function legend(y, entries) {
  let x = 34;
  return entries
    .map(([fill, label]) => {
      const mark = bar(x, y - 8, 14, 10, fill);
      const t = text(x + 19, y, label, { size: 10 });
      x += 19 + label.length * 5.6 + 18;
      return mark + t;
    })
    .join('');
}

/** Horizontal gridlines and a y axis in points, kept recessive. */
function grid(top, h, max, step) {
  let out = '';
  for (let v = 0; v <= max; v += step) {
    const y = top + h - (v / max) * h;
    out +=
      `<line x1="34" y1="${y}" x2="${W - 8}" y2="${y}" stroke="${INK}" stroke-width="1" ` +
      `opacity="${v === 0 ? 1 : 0.25}"/>` +
      text(30, y + 3, String(v), { size: 9, anchor: 'end' });
  }
  return out;
}

/** What the small model scores against the published one, set by set. */
function figureAgainstPublished() {
  const top = 22;
  const h = 150;
  const max = 60;
  const groupW = (W - 34 - 8) / SETS.length;
  const barW = 36;
  let body = grid(top, h, max, 10);

  SETS.forEach((s, i) => {
    const cx = 34 + groupW * i + groupW / 2;
    const series = [
      [d.rp5.stock[s], FILLS.base, false],
      [d.rp5.fine_tuned[s].mean, FILLS.subject, true],
      [d.rp5.published[s], FILLS.context, false],
    ];
    series.forEach(([v, fill, inside], k) => {
      const x = cx - (barW * 3 + 12) / 2 + k * (barW + 6);
      const bh = (v / max) * h;
      body +=
        bar(x, top + h - bh, barW, bh, fill) + barLabel(x + barW / 2, top + h - bh, v, { inside });
    });
    body += text(cx, top + h + 14, LABEL[s], { size: 11, anchor: 'middle', weight: 700 });
    body += text(cx, top + h + 27, `${d.sets[s]} queries`, { size: 9, anchor: 'middle' });
  });

  body += legend(top + h + 48, [
    [FILLS.base, 'stock MiniLM, 22M'],
    [FILLS.subject, 'fine-tuned, 22M'],
    [FILLS.context, 'published best, 110M'],
  ]);
  body += note(
    34,
    top + h + 68,
    'The fine-tuned bar is the mean of three seeds. It lands within a point of the 110M model on TECH, ' +
      'above it on HOUSE, and 6.9 points below it on TECHWOLF, which is the cost of the smaller model.',
  );

  return figure(
    'against-published.svg',
    'A fifth the parameters, set by set',
    top + h + 104,
    body,
    PROVENANCE +
      '\nFine-tuned: 3 seeds, fp32, mean. Published: Decorte et al. best fine-tuned all-mpnet-base-v2, as reported.',
  );
}

/** What survives on skills the model never trained on. */
function figureUnseen() {
  const u = d.unseen;
  const top = 22;
  const h = 132;
  const max = 50;
  const groups = [
    [
      'on skills it trained on',
      u.stock.seen,
      u.trained_on_all.seen.mean,
      u.held_out.seen,
      u.n_seen,
    ],
    [
      'on skills held out entirely',
      u.stock.unseen,
      u.trained_on_all.unseen.mean,
      u.held_out.unseen,
      u.n_unseen,
    ],
  ];
  const groupW = (W - 34 - 8) / groups.length;
  const barW = 44;
  let body = grid(top, h, max, 10);

  groups.forEach(([label, stock, all, held, n], i) => {
    const cx = 34 + groupW * i + groupW / 2;
    [
      [stock, FILLS.base, false],
      [all, FILLS.context, false],
      [held, FILLS.subject, true],
    ].forEach(([v, fill, inside], k) => {
      const x = cx - (barW * 3 + 12) / 2 + k * (barW + 6);
      const bh = (v / max) * h;
      body +=
        bar(x, top + h - bh, barW, bh, fill) + barLabel(x + barW / 2, top + h - bh, v, { inside });
    });
    body += text(cx, top + h + 14, label, { size: 11, anchor: 'middle', weight: 700 });
    body += text(cx, top + h + 27, `n = ${n.toLocaleString('en-US')}`, {
      size: 9,
      anchor: 'middle',
    });
  });

  body += legend(top + h + 48, [
    [FILLS.base, 'stock MiniLM'],
    [FILLS.context, 'fine-tuned on all skills'],
    [FILLS.subject, 'fine-tuned with these held out'],
  ]);
  body += note(
    34,
    top + h + 68,
    `Holding 2,765 skills and every sentence mentioning them out of training still leaves ` +
      `+${u.gain_unseen.points.toFixed(2)} hit@5 over stock on the skills it never saw ` +
      `(95% CI [+${u.gain_unseen.ci[0].toFixed(2)}, +${u.gain_unseen.ci[1].toFixed(2)}]), against ` +
      `+${u.gain_seen.points.toFixed(2)} on the ones it did.`,
  );

  return figure(
    'unseen-skills.svg',
    'Skills the model never trained on',
    top + h + 104,
    body,
    `hit@5 over ${d.targets.toLocaleString('en-US')} ESCO skills. One held-out run, one seed; the arms it is ` +
      `compared against cover three seeds, so the spread is known on one side of this and not the other.`,
  );
}

/** What fine-tuning bought against what quantizing gave back, in the same unit. */
function figureGainVsCost() {
  const top = 30;
  const rowH = 34;
  const left = 132;
  const right = W - 76;
  const lo = -4;
  const hi = 14;
  const x = (v) => left + ((v - lo) / (hi - lo)) * (right - left);
  const zero = x(0);
  let body = '';

  for (let v = lo; v <= hi; v += 2) {
    body +=
      `<line x1="${x(v)}" y1="${top - 16}" x2="${x(v)}" y2="${top + SETS.length * rowH - 12}" ` +
      `stroke="${INK}" stroke-width="1" opacity="${v === 0 ? 1 : 0.18}"/>`;
    if (v % 4 === 0)
      body += text(x(v), top + SETS.length * rowH + 2, String(v), { size: 9, anchor: 'middle' });
  }

  SETS.forEach((s, i) => {
    const y = top + i * rowH;
    const gain = d.rp5.fine_tuned[s].mean - d.rp5.stock[s];
    const cost = d.rp5.int8[s].mean - d.rp5.fine_tuned[s].mean;
    body +=
      text(left - 10, y + 10, LABEL[s], { size: 11, anchor: 'end', weight: 700 }) +
      bar(zero, y - 2, x(gain) - zero, 10, FILLS.subject) +
      bar(x(cost), y + 11, zero - x(cost), 10, FILLS.context) +
      text(x(gain) + 6, y + 7, `+${gain.toFixed(2)}`, { size: 10, weight: 700 }) +
      text(x(cost) - 6, y + 20, cost.toFixed(2), { size: 10, anchor: 'end' });
  });

  const axisY = top + SETS.length * rowH;
  body +=
    legend(axisY + 24, [
      [FILLS.subject, 'gained by fine-tuning, against stock'],
      [FILLS.context, 'given back by quantizing to int8'],
    ]) +
    note(
      34,
      axisY + 44,
      'Both bars are RP@5 points on one axis, so the two are directly comparable. Fine-tuning buys 8 to 13 ' +
        'points; quantizing hands back at most 1.22, and the file that ships is the int8 one.',
    );

  return figure(
    'gain-vs-cost.svg',
    'What fine-tuning bought, and what int8 gave back',
    axisY + 80,
    body,
    PROVENANCE +
      '\nBoth arms are the mean of the same three seeds. A negative bar is a loss against the fp32 model.',
  );
}

const written = [figureAgainstPublished(), figureUnseen(), figureGainVsCost()];
console.log(`figures/skill-linker: ${written.join(', ')}`);
