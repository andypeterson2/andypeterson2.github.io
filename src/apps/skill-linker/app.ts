/**
 * The skill-linker benchmark viewer.
 *
 * Two states over one file of precomputed candidates: a walk through the
 * sentences one at a time, with each arm's running RP@5 converging on the figure
 * its own run recorded, and a table of all of them with filters. Both read their
 * figures from the candidates it was served, so a reader can count the same rows.
 */
import {
  applyFilters,
  armName,
  armRun,
  buildRows,
  loadDemo,
  outcome,
  pct,
  rankCell,
  RP_K,
  setName,
  summarize,
  type Filters,
  type Row,
  type SkillLinkerDemo,
  type Summary,
} from './link';

const PAGE = 100;
/** The two arms the walk puts side by side; the third is what the held-out filter is for. */
const WALK_ARMS = ['stock', 'tuned'] as const;

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

/** A skill name as a chip, marked when it is one the sentence's answer key names. */
function skillChip(name: string, gold: boolean, heldout = false): HTMLElement {
  const chip = el('li', gold ? 'sl-chip sl-chip--gold' : 'sl-chip', name);
  if (gold) {
    const mark = el('span', 'sl-mark', heldout ? 'correct, held out' : 'correct');
    chip.prepend(mark);
  }
  return chip;
}

/** Write one arm's candidates into the card already on the page. */
function fillCandidates(demo: SkillLinkerDemo, row: Row, arm: string, card: HTMLElement): void {
  const name = card.querySelector('.sl-arm-name');
  const score = card.querySelector('.sl-arm-score');
  const list = card.querySelector('.sl-candidates');
  if (!name || !score || !list) return;
  name.textContent = armName(demo, arm);
  (name as HTMLElement).title = armRun(demo, arm);
  score.textContent = `RP@${String(RP_K)} ${rpAt(row, arm).toFixed(2)}`;
  const gold = new Set(row.gold);
  const heldout = new Set(row.heldoutGold);
  const ranked = (row.top[arm] ?? []).slice(0, RP_K);
  // The slots are fixed, so each one is rewritten rather than the list rebuilt.
  const slots = [...list.querySelectorAll('.sl-chip')];
  slots.forEach((slot) => {
    slot.replaceChildren();
    slot.classList.remove('sl-chip--gold');
  });
  // Clipped to the slots that exist, so every index below lands on one.
  ranked.slice(0, slots.length).forEach((id, i) => {
    const slot = slots[i];
    const isGold = gold.has(id);
    slot.classList.toggle('sl-chip--gold', isGold);
    if (isGold)
      slot.append(el('span', 'sl-mark', heldout.has(id) ? 'correct, held out' : 'correct'));
    slot.append(document.createTextNode(demo.labels[id]));
  });
}

function rpAt(row: Row, arm: string): number {
  return summarize([row], arm).rp5;
}

function summaryTable(
  demo: SkillLinkerDemo,
  rows: Row[],
  heldoutOnly: boolean,
  shown: number,
): HTMLElement {
  const table = el('table', 's6-data-table sl-summary');
  const caption = el(
    'caption',
    'sl-caption',
    heldoutOnly
      ? `${String(rows.length)} sentences, scoring only their held-out skills.`
      : `All ${String(rows.length)} kept sentences, not just the ${String(Math.min(shown, rows.length))} shown.`,
  );
  table.append(caption);
  const head = el('thead');
  const headRow = el('tr');
  [
    'Model',
    `RP@${String(RP_K)}`,
    `hit@${String(RP_K)}`,
    `MRR@${String(demo.k)}`,
    'Sentences',
  ].forEach((label) => headRow.append(el('th', undefined, label)));
  head.append(headRow);
  table.append(head);
  const body = el('tbody');
  for (const arm of Object.keys(demo.arms)) {
    const stats: Summary = summarize(rows, arm, (row) =>
      heldoutOnly ? row.heldoutGold : row.gold,
    );
    const tr = el('tr');
    const label = el('th', undefined, armName(demo, arm));
    label.append(el('span', 'sl-run', armRun(demo, arm)));
    tr.append(label);
    [pct(stats.rp5), pct(stats.hit5), stats.mrr.toFixed(3), String(stats.queries)].forEach(
      (value) => tr.append(el('td', 'sl-num', value)),
    );
    body.append(tr);
  }
  table.append(body);
  return table;
}

function mount(demo: SkillLinkerDemo, root: HTMLElement): void {
  const rows = buildRows(demo);
  const arms = Object.keys(demo.arms);
  const filters: Filters = {
    set: 'all',
    outcome: 'any',
    outcomeArm: 'tuned',
    heldoutOnly: false,
  };
  let walkSet = 'tech';
  let walkAt = 0;
  let shown = PAGE;

  /** A node the view cannot be drawn without. Its absence means the markup is broken. */
  const need = (selector: string): HTMLElement => {
    const node = root.querySelector<HTMLElement>(selector);
    if (!node) throw new Error(`skill-linker markup is missing ${selector}`);
    return node;
  };

  const walkPanel = need('#sl-walk');
  const tablePanel = need('#sl-table');
  const sentence = need('#sl-sentence');
  const answer = need('#sl-answer');
  const columns = need('#sl-columns');
  const progress = need('#sl-progress');
  const running = need('#sl-running');
  const head = need('#sl-head');
  const rowsHost = need('#sl-rows');
  const summaryHost = need('#sl-summary');
  const more = need('#sl-more');

  const walkRows = () => rows.filter((row) => row.set === walkSet);

  function drawWalk(): void {
    const subset = walkRows();
    if (subset.length === 0) return;
    const row = subset[walkAt];
    progress.textContent = `Sentence ${String(walkAt + 1)} of ${String(subset.length)} · ${setName(walkSet)}`;
    sentence.textContent = row.text;

    answer.replaceChildren();
    answer.append(el('span', 'sl-answer-label', `Correct skills (${String(row.gold.length)}):`));
    const list = el('ul', 'sl-answer-list');
    const heldout = new Set(row.heldoutGold);
    row.gold.forEach((g) => {
      list.append(skillChip(demo.labels[g], true, heldout.has(g)));
    });
    answer.append(list);

    const seen = subset.slice(0, walkAt + 1);
    WALK_ARMS.forEach((arm) => {
      const card = columns.querySelector<HTMLElement>(`[data-arm="${arm}"]`);
      if (card) fillCandidates(demo, row, arm, card);

      const line = running.querySelector<HTMLElement>(`[data-arm="${arm}"]`);
      if (!line) return;
      const stats = summarize(seen, arm);
      const published = demo.arms[arm]?.published_rp5[walkSet] ?? 0;
      const name = line.querySelector('.sl-running-name');
      const now = line.querySelector('.sl-num');
      const aim = line.querySelector('.sl-running-aim');
      if (name) name.textContent = armName(demo, arm);
      if (now) now.textContent = `${pct(stats.rp5)} · n=${String(stats.queries)}`;
      if (aim) aim.textContent = `full set ${pct(published)}`;
    });
  }

  function drawTable(): void {
    head.replaceChildren(
      ...['Set', 'Sentence', 'Correct skills'].map((label) => el('th', undefined, label)),
      ...arms.map((arm) => {
        const cell = el('th', undefined, armName(demo, arm));
        cell.title = armRun(demo, arm);
        return cell;
      }),
    );
    const kept = applyFilters(rows, filters);
    summaryHost.replaceChildren(summaryTable(demo, kept, filters.heldoutOnly, shown));

    const page = kept.slice(0, shown);
    rowsHost.replaceChildren();
    page.forEach((row) => {
      const tr = el('tr');
      tr.append(el('th', 'sl-set', setName(row.set)));
      const text = el('td', 'sl-text', row.text);
      text.title = row.text;
      tr.append(text);
      const golds = el('td', 'sl-golds', row.gold.map((g) => demo.labels[g]).join('; '));
      if (row.heldoutGold.length > 0) {
        golds.append(
          el('span', 'sl-mark', `${String(row.heldoutGold.length)} held out of training`),
        );
      }
      tr.append(golds);
      arms.forEach((arm) => {
        const cell = el('td', `sl-num sl-${outcome(row, arm)}`, rankCell(row, arm, demo.k));
        cell.title = `${armName(demo, arm)}: rank of each correct skill`;
        tr.append(cell);
      });
      rowsHost.append(tr);
    });

    more.hidden = kept.length <= shown;
    more.textContent = `Show ${String(Math.min(PAGE, kept.length - shown))} more of ${String(kept.length)}`;
  }

  root.querySelectorAll<HTMLButtonElement>('[data-state]').forEach((button) => {
    button.addEventListener('click', () => {
      const wanted = button.dataset.state;
      root.querySelectorAll<HTMLButtonElement>('[data-state]').forEach((other) => {
        other.setAttribute('aria-selected', String(other.dataset.state === wanted));
      });
      walkPanel.hidden = wanted !== 'walk';
      tablePanel.hidden = wanted !== 'table';
      if (wanted === 'table') drawTable();
    });
  });

  root.querySelector<HTMLButtonElement>('#sl-next')?.addEventListener('click', () => {
    walkAt = (walkAt + 1) % walkRows().length;
    drawWalk();
  });
  root.querySelector<HTMLSelectElement>('#sl-walk-set')?.addEventListener('change', (event) => {
    walkSet = (event.target as HTMLSelectElement).value;
    walkAt = 0;
    drawWalk();
  });
  root.querySelector<HTMLSelectElement>('#sl-filter-set')?.addEventListener('change', (event) => {
    filters.set = (event.target as HTMLSelectElement).value;
    shown = PAGE;
    drawTable();
  });
  root
    .querySelector<HTMLSelectElement>('#sl-filter-outcome')
    ?.addEventListener('change', (event) => {
      filters.outcome = (event.target as HTMLSelectElement).value as Filters['outcome'];
      shown = PAGE;
      drawTable();
    });
  root.querySelector<HTMLSelectElement>('#sl-filter-arm')?.addEventListener('change', (event) => {
    filters.outcomeArm = (event.target as HTMLSelectElement).value;
    shown = PAGE;
    drawTable();
  });
  root
    .querySelector<HTMLInputElement>('#sl-filter-heldout')
    ?.addEventListener('change', (event) => {
      filters.heldoutOnly = (event.target as HTMLInputElement).checked;
      shown = PAGE;
      drawTable();
    });
  more.addEventListener('click', () => {
    shown += PAGE;
    drawTable();
  });

  // The arm pickers name the models the export actually carries, so a renamed arm
  // cannot leave a stale option behind.
  const armOptions = root.querySelector<HTMLSelectElement>('#sl-filter-arm');
  if (armOptions) {
    armOptions.replaceChildren(
      ...arms.map((arm) => {
        const option = el('option', undefined, armName(demo, arm));
        option.value = arm;
        option.selected = arm === filters.outcomeArm;
        return option;
      }),
    );
  }

  drawWalk();
}

const root = document.getElementById('skill-linker-app');
if (root) {
  loadDemo()
    .then((demo) => {
      mount(demo, root);
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      const note = root.querySelector('#sl-scope');
      if (note) note.textContent = `Could not load the benchmark data: ${message}`;
    });
}
