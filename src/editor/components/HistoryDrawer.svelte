<script lang="ts">
  // Version history (ADR-006). Increment 1: take a named checkpoint, list them,
  // restore one. Increment 2: Compare a checkpoint against the current document —
  // a structural diff (added / removed / changed sections, entries, bullets, and
  // personal fields). In the demo, history is for this session only (ADR-001).
  import { onMount } from 'svelte';
  import { editor } from '../lib/store.svelte';
  import type { DocDiff } from '../lib/diff';

  let label = $state('');
  /** the checkpoint being compared against the current document, or null */
  let compare = $state<{ id: number; label: string; diff: DocDiff } | null>(null);
  let comparing = $state(false);

  onMount(() => {
    void editor.history.load();
  });

  function take() {
    void editor.history.snapshot(label);
    label = '';
  }

  async function openCompare(id: number, name: string) {
    comparing = true;
    const diff = await editor.history.compare(id);
    comparing = false;
    if (diff) compare = { id, label: name, diff };
  }

  /** A compact "how long ago" — recomputed each render (the drawer is short-lived). */
  function when(ms: number): string {
    const secs = Math.round((Date.now() - ms) / 1000);
    if (secs < 45) return 'just now';
    const mins = Math.round(secs / 60);
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs} hr ago`;
    return new Date(ms).toLocaleDateString();
  }
</script>

{#snippet delta(from: string, to: string)}
  {#if from && to}<s class="del">{from}</s> <span class="ins">{to}</span>
  {:else if to}<span class="ins">{to}</span>
  {:else}<s class="del">{from}</s>{/if}
{/snippet}

{#if compare}
  <!-- ── compare view: what changed since this checkpoint ── -->
  <button class="back" onclick={() => (compare = null)}>← History</button>
  <p class="cmp-title">Changes since <b>{compare.label || 'checkpoint'}</b></p>

  {#if compare.diff.empty}
    <p class="empty">No changes since this checkpoint —<br />the document matches it exactly.</p>
  {:else}
    <p class="summary">
      {#if compare.diff.counts.added}<span class="s-add">+{compare.diff.counts.added} added</span>{/if}
      {#if compare.diff.counts.removed}<span class="s-del">−{compare.diff.counts.removed} removed</span>{/if}
      {#if compare.diff.counts.changed}<span class="s-chg">{compare.diff.counts.changed} changed</span>{/if}
    </p>

    {#if compare.diff.personal.length}
      <div class="grp">
        <div class="grp-h">Personal details</div>
        {#each compare.diff.personal as f (f.key)}
          <div class="fld"><span class="fk">{f.key}</span> {@render delta(f.from, f.to)}</div>
        {/each}
      </div>
    {/if}

    {#each compare.diff.sections as sec (sec.id)}
      <div class="grp">
        <div class="grp-h">
          {sec.title || 'Section'}<span class="badge b-{sec.kind}">{sec.kind}</span>
        </div>
        {#each sec.entries as e (e.id)}
          <div class="ent e-{e.kind}">
            <div class="ent-l">
              {#if e.kind === 'added'}<span class="mk ins">＋</span>{:else if e.kind === 'removed'}<span
                  class="mk del">－</span
                >{/if}
              <span class="ent-label" class:strike={e.kind === 'removed'}>{e.label}</span>
            </div>
            {#each e.fields as f (f.key)}
              <div class="fld"><span class="fk">{f.key}</span> {@render delta(f.from, f.to)}</div>
            {/each}
            {#each e.items as it (it.id)}
              <div class="itm">
                {#if it.kind === 'added'}<span class="ins">＋ {it.to}</span>
                {:else if it.kind === 'removed'}<span class="del">－ {it.from}</span>
                {:else}{@render delta(it.from, it.to)}{/if}
              </div>
            {/each}
          </div>
        {/each}
      </div>
    {/each}
  {/if}
{:else}
  <!-- ── default view: the checkpoint list ── -->
  <p class="note">
    A checkpoint captures the whole document. Restoring one replaces it and clears undo;
    <b>Compare</b> shows what changed since.
    {#if editor.connected}
      Durable, cross-session history lands with the backend.
    {:else}
      In the demo, history lives for this session only — nothing is saved.
    {/if}
  </p>

  <div class="make">
    <input
      class="in"
      placeholder="Checkpoint name (optional)"
      aria-label="Checkpoint name"
      bind:value={label}
      onkeydown={(e) => e.key === 'Enter' && take()}
    />
    <button class="snap" onclick={take}>Snapshot now</button>
  </div>

  {#if editor.history.versions.length === 0}
    <p class="empty">No checkpoints yet.<br />Snapshot the document to begin its history.</p>
  {:else}
    <ul class="list" aria-label="Checkpoints, newest first">
      {#each editor.history.versions as v, i (v.id)}
        <li class="row">
          <span class="dot" class:head={i === 0} aria-hidden="true"></span>
          <div class="meta">
            <span class="name" class:untitled={!v.label}>{v.label || 'Untitled checkpoint'}</span>
            <span class="time">{when(v.createdAt)}{i === 0 ? ' · latest' : ''}</span>
          </div>
          <div class="acts">
            <button
              class="act"
              disabled={comparing}
              onclick={() => openCompare(v.id, v.label || 'checkpoint')}>Compare</button
            >
            <button
              class="act restore"
              disabled={editor.history.restoring}
              onclick={() => editor.history.restore(v.id)}>Restore</button
            >
          </div>
        </li>
      {/each}
    </ul>
  {/if}
{/if}

<style>
  .note {
    font-size: 11.5px;
    line-height: 1.5;
    color: #55534e;
    margin: 0 0 16px;
  }
  .make {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 8px;
    margin-bottom: 18px;
  }
  .in {
    font-family: var(--sans);
    font-size: 14px;
    color: var(--ink);
    background: var(--chrome-hi);
    border: 1px solid var(--ink);
    border-radius: 6px;
    padding: 6px 9px;
    width: 100%;
  }
  .snap {
    font-family: var(--sans);
    font-size: 12.5px;
    font-weight: 700;
    color: var(--paper);
    background: var(--ink);
    border: 1px solid var(--ink);
    border-radius: 6px;
    padding: 6px 12px;
    cursor: pointer;
    white-space: nowrap;
  }
  .snap:active {
    transform: translateY(1px);
  }
  .empty {
    font-size: 12px;
    line-height: 1.6;
    color: #77756e;
    text-align: center;
    margin: 26px 0;
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
  }
  .row {
    display: grid;
    grid-template-columns: 14px 1fr auto;
    align-items: center;
    gap: 10px;
    padding: 9px 0;
    border-bottom: 1px solid var(--faint, #e4e2db);
  }
  .row:last-child {
    border-bottom: 0;
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    border: 1px solid var(--ink);
    background: var(--paper);
    justify-self: center;
  }
  .dot.head {
    background: var(--ink);
  }
  .meta {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }
  .name {
    font-size: 13px;
    font-weight: 600;
    color: var(--ink);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .name.untitled {
    font-weight: 400;
    color: #77756e;
  }
  .time {
    font-size: 10.5px;
    color: #8f8d86;
    font-variant-numeric: tabular-nums;
  }
  .acts {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .act {
    font-family: var(--sans);
    font-size: 11px;
    font-weight: 700;
    color: var(--ink);
    background: var(--paper);
    border: 1px solid var(--ink);
    border-radius: 6px;
    padding: 3px 10px;
    cursor: pointer;
  }
  .act:hover:not(:disabled) {
    background: var(--chrome-hi);
  }
  .act:disabled {
    opacity: 0.4;
    cursor: default;
  }

  /* ── compare view ── */
  .back {
    font-family: var(--mono);
    font-size: 11px;
    color: #55534e;
    background: none;
    border: 0;
    padding: 2px 0;
    cursor: pointer;
    margin-bottom: 8px;
  }
  .back:hover {
    color: var(--ink);
  }
  .cmp-title {
    font-size: 13px;
    color: var(--ink);
    margin: 0 0 12px;
  }
  .cmp-title b {
    font-weight: 700;
  }
  .summary {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    font-family: var(--mono);
    font-size: 11px;
    margin: 0 0 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--faint, #e4e2db);
  }
  .s-add {
    color: var(--state-live, #2f7d4c);
  }
  .s-del {
    color: var(--state-error, #b3261e);
  }
  .s-chg {
    color: #8a6d1a;
  }
  .grp {
    margin-bottom: 16px;
  }
  .grp-h {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 10.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: #4a4944;
    margin-bottom: 8px;
  }
  .badge {
    font-family: var(--mono);
    font-size: 9px;
    font-weight: 400;
    text-transform: lowercase;
    letter-spacing: 0;
    padding: 1px 6px;
    border-radius: 8px;
    border: 1px solid currentColor;
  }
  .b-added {
    color: var(--state-live, #2f7d4c);
  }
  .b-removed {
    color: var(--state-error, #b3261e);
  }
  .b-changed {
    color: #8a6d1a;
  }
  .ent {
    padding: 6px 0 6px 10px;
    border-left: 2px solid var(--faint, #e4e2db);
    margin-bottom: 6px;
  }
  .ent.e-added {
    border-left-color: var(--state-live, #2f7d4c);
  }
  .ent.e-removed {
    border-left-color: var(--state-error, #b3261e);
  }
  .ent-l {
    display: flex;
    align-items: baseline;
    gap: 5px;
  }
  .ent-label {
    font-size: 12.5px;
    font-weight: 600;
    color: var(--ink);
  }
  .ent-label.strike {
    text-decoration: line-through;
    color: #77756e;
  }
  .mk {
    font-family: var(--mono);
    font-weight: 700;
  }
  .fld,
  .itm {
    font-size: 11.5px;
    line-height: 1.5;
    color: #4a4944;
    margin-top: 3px;
    word-break: break-word;
  }
  .fk {
    font-family: var(--mono);
    font-size: 10px;
    color: #8f8d86;
  }
  .ins {
    color: var(--state-live, #2f7d4c);
  }
  .del {
    color: var(--state-error, #b3261e);
    text-decoration: line-through;
  }
</style>
