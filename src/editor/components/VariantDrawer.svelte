<script lang="ts">
  import { editor } from '../lib/store.svelte';
  import { countIncludedEntries } from '../lib/variant-lens';
  import TagChips from './TagChips.svelte';
  import type { Variant } from '../lib/types';

  const variants = $derived(editor.person.variants);
  const active = $derived(editor.activeVariant);

  function counts(v: Variant) {
    return countIncludedEntries(editor.person.sections, v);
  }
  function noun(v: Variant) {
    return v.kind === 'coverletter' ? 'cover letter' : 'variant';
  }
  function confirmDelete(v: Variant) {
    if (window.confirm(`Delete the "${v.name}" ${noun(v)}?`)) void editor.variants.remove(v);
  }
</script>

<p class="note">
  A variant is a lens on your main resume. Pick one to preview what it keeps — excluded entries
  and bullets dim in place. Editing here never changes the main.
</p>

<div class="picker">
  <button
    class="opt"
    class:on={editor.activeVariantId === null}
    onclick={() => editor.variants.select(null)}
  >
    <span class="radio"></span>
    <span class="opt-name">Main</span>
    <span class="opt-meta">full document</span>
  </button>
  {#each variants as v (v.id)}
    {@const c = v.kind === 'coverletter' ? null : counts(v)}
    <button
      class="opt"
      class:on={editor.activeVariantId === v.id}
      onclick={() => editor.variants.select(v.id)}
    >
      <span class="radio"></span>
      <span class="opt-name">{v.name}</span>
      <span class="opt-meta">{c ? `${c.shown}/${c.total} entries` : 'cover letter'}</span>
    </button>
  {/each}
</div>

<div class="new-row">
  <button class="new" onclick={() => editor.variants.add('New variant')}>＋ New variant</button>
  <button class="new" onclick={() => editor.variants.add('New cover letter', 'coverletter')}
    >＋ New cover letter</button
  >
</div>

{#if active}
  {@const v = active}
  <div class="edit">
    <label class="rename">
      <span class="rlbl">Name</span>
      <input
        class="in"
        value={v.name}
        onchange={(e) => editor.variants.rename(v, e.currentTarget.value)}
      />
    </label>

    {#if v.kind === 'coverletter'}
      <p class="hint">
        A cover letter has its own recipient and paragraphs — edit them on the letter itself. Tag
        rules don't apply.
      </p>
    {:else}
      <div class="rule">
        <span class="rule-lbl inc">Include</span>
        <TagChips
          tags={v.rules.include}
          onAdd={(t) => editor.variants.addRule(v, 'include', t)}
          onRemove={(t) => editor.variants.removeRule(v, 'include', t)}
        />
      </div>
      <div class="rule">
        <span class="rule-lbl exc">Exclude</span>
        <TagChips
          tags={v.rules.exclude}
          onAdd={(t) => editor.variants.addRule(v, 'exclude', t)}
          onRemove={(t) => editor.variants.removeRule(v, 'exclude', t)}
        />
      </div>
      <p class="hint">
        No include tags → every entry is in (minus excludes). Otherwise only entries carrying an
        include tag stay.
      </p>
    {/if}

    <button class="del" onclick={() => confirmDelete(v)}>Delete {noun(v)}</button>
  </div>
{/if}

<style>
  .note {
    font-size: var(--text-4xs);
    line-height: 1.55;
    color: var(--ink-3);
    margin: 0 0 16px;
  }
  .picker {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .opt {
    display: flex;
    align-items: center;
    gap: 9px;
    width: 100%;
    text-align: left;
    background: var(--paper);
    border: 1px solid var(--ink);
    border-radius: var(--radius-md);
    padding: 8px 11px;
    cursor: pointer;
    box-shadow: var(--shadow-sm);
    font-family: var(--sans);
  }
  .opt.on {
    background: var(--ink);
    color: var(--paper);
  }
  .opt:active {
    transform: translate(1px, 1px);
    box-shadow: none;
  }
  .radio {
    width: 11px;
    height: 11px;
    border-radius: var(--radius-round);
    border: 1.5px solid currentColor;
    flex: none;
  }
  .opt.on .radio {
    background:
      radial-gradient(circle, var(--paper) 0 2.5px, transparent 3px),
      var(--paper);
    background-clip: content-box;
    border-color: var(--paper);
    box-shadow: var(--shadow-ring);
  }
  .opt-name {
    font-size: var(--text-3xs);
    font-weight: 700;
  }
  .opt-meta {
    margin-left: auto;
    font-family: var(--mono);
    font-size: var(--text-4xs);
    opacity: 0.7;
    font-variant-numeric: tabular-nums;
  }
  .new-row {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 10px;
  }
  .new {
    width: 100%;
    font-family: var(--sans);
    font-size: var(--text-3xs);
    color: var(--ink-3);
    background: none;
    border: 1px dashed var(--dim);
    border-radius: var(--radius);
    padding: 7px 12px;
    cursor: pointer;
  }
  .edit {
    margin-top: 18px;
    padding-top: 16px;
    border-top: 1px solid var(--paper-4);
    display: flex;
    flex-direction: column;
    gap: 13px;
  }
  .rename {
    display: grid;
    grid-template-columns: 62px 1fr;
    align-items: center;
    gap: 10px;
  }
  .rlbl {
    font-size: var(--text-4xs);
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--ink-2);
  }
  .in {
    font-family: var(--sans);
    font-size: var(--text-2xs);
    color: var(--ink);
    background: var(--chrome-hi);
    border: 1px solid var(--ink);
    border-radius: var(--radius);
    padding: 6px 9px;
    width: 100%;
  }
  .rule {
    display: grid;
    grid-template-columns: 62px 1fr;
    align-items: start;
    gap: 10px;
  }
  .rule-lbl {
    font-size: var(--text-4xs);
    text-transform: uppercase;
    letter-spacing: 0.07em;
    font-weight: 700;
    padding-top: 3px;
  }
  .rule-lbl.inc {
    color: var(--color-success);
  }
  .rule-lbl.exc {
    color: var(--accent);
  }
  .hint {
    font-size: var(--text-4xs);
    line-height: 1.5;
    color: var(--color-text-muted);
    margin: 0;
  }
  .del {
    align-self: flex-start;
    font-family: var(--sans);
    font-size: var(--text-3xs);
    color: var(--accent);
    background: var(--paper);
    border: 1px solid var(--accent);
    border-radius: var(--radius);
    padding: 5px 12px;
    cursor: pointer;
    box-shadow: var(--shadow-accent);
  }
  .del:active {
    transform: translate(1px, 1px);
    box-shadow: none;
  }
</style>
