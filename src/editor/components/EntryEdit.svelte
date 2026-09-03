<script lang="ts">
  // Expand-in-place editor for a single entry. Data-driven from the section
  // type's field list (see section-types.ts) so it handles all 5 shapes:
  // paragraph → textarea; everything else → labelled fields (+ bullets when hasItems).
  //
  // Two modes, keyed off the active lens:
  //  • Main (no variant / a cover letter) → edits the base document, as always.
  //  • A CV/résumé variant is active → this panel edits THAT variant's view: field
  //    edits become per-variant overrides, and each entry/item gets a force-in/out
  //    control. Item content, tags, and add/delete/reorder are shared base structure,
  //    so they're Main-only (shown read-only here) — that keeps the mode banner honest:
  //    everything this panel presents as editable really is variant-scoped.
  import { editor } from '../lib/store.svelte';
  import { typeDef } from '../lib/section-types';
  import { itemIncluded } from '../lib/variant-lens';
  import { sortable, reorderKeydown } from '../lib/sortable';
  import { symbolInput } from '../lib/symbol-input.svelte';
  import TagChips from './TagChips.svelte';
  import SymbolPalette from './SymbolPalette.svelte';
  import UnknownWarning from './UnknownWarning.svelte';
  import type { Entry, Item, Section } from '../lib/types';

  let { section, entry }: { section: Section; entry: Entry } = $props();
  const def = $derived(typeDef(section.type));

  const sym = symbolInput();

  // Variant-lens editing state.
  const lens = $derived(editor.activeVariant);
  const overriding = $derived(!!lens && lens.kind !== 'coverletter');
  const fov = $derived(
    overriding ? (lens?.entryOverrides?.[entry.id]?.fieldsOverride ?? null) : null,
  );
  const entryIncl = $derived(
    overriding ? (lens?.entryOverrides?.[entry.id]?.included ?? null) : null,
  );

  /** The value to show for a field: the variant's override if set, else the base. */
  function fieldVal(key: string): string {
    return (overriding ? (fov?.[key] ?? entry.fields[key]) : entry.fields[key]) ?? '';
  }
  /** Whether this field currently carries a variant override (drives badge + reset). */
  function isOverridden(key: string): boolean {
    return !!fov && key in fov;
  }
  /** One handler for every field: writes an override in variant mode, the base in Main. */
  function onFieldInput(key: string, value: string) {
    if (overriding && lens) editor.variants.setEntryFieldOverride(lens, entry, key, value);
    else {
      entry.fields[key] = value;
      editor.saveEntry(entry);
    }
  }
  /** The force-include state (1/0/null) an item carries in the active variant. */
  function itemIncl(id: number): number | null {
    return lens?.itemOverrides?.[id]?.included ?? null;
  }
  /** Effective (rules + override) visibility, for dimming the read-only item preview. */
  function itemDim(it: Item): boolean {
    return overriding && !!lens && !itemIncluded(it, lens);
  }

  // Every editable string in this entry — fed to the unrecognized-command warning.
  const text = $derived.by(() => {
    const parts: string[] = [];
    if (def?.isParagraph) parts.push(entry.fields.text ?? '');
    else {
      for (const f of def?.fields ?? []) parts.push(entry.fields[f.key] ?? '');
      for (const it of entry.items) parts.push(it.title ?? '', it.content ?? '');
    }
    return parts.join('  ');
  });

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') editor.clearSelection();
  }
</script>

<svelte:window onkeydown={onKeydown} />

{#snippet inclSeg(state: number | null, set: (s: number | null) => void)}
  <div class="seg" role="group" aria-label="Visibility in this variant">
    <button type="button" class:on={state == null} onclick={() => set(null)}>Follow tags</button>
    <button type="button" class:on={state === 1} onclick={() => set(1)}>Force show</button>
    <button type="button" class:on={state === 0} onclick={() => set(0)}>Force hide</button>
  </div>
{/snippet}

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="edit" onfocusin={sym.track}>
  <div class="ehead">
    <span class="etype"
      >{def?.label ?? section.type}{def?.entryLabel ? ` · ${def.entryLabel}` : ''}</span
    >
    <span class="eacts">
      <button
        class="mini sym-toggle"
        class:on={sym.open}
        title="Insert a symbol"
        aria-expanded={sym.open}
        onclick={() => sym.toggle()}>Ω</button
      >
      {#if !overriding}
        <button class="mini danger" onclick={() => editor.deleteEntry(section, entry.id)}
          >Delete</button
        >
      {/if}
      <button class="mini primary" onclick={() => editor.clearSelection()}>Done</button>
    </span>
  </div>

  {#if overriding}
    <div class="vmode">
      Editing <strong>{lens?.name}</strong> — field edits and visibility below apply to this variant only.
      Switch the Variant menu to Main to edit the base.
    </div>
  {/if}

  {#if sym.open}
    <SymbolPalette onpick={sym.insert} />
  {/if}

  {#if def?.isParagraph}
    <div class="ov-wrap">
      <textarea
        class="in para"
        rows="5"
        placeholder="Write your summary…"
        value={fieldVal('text')}
        oninput={(e) => onFieldInput('text', e.currentTarget.value)}></textarea>
      {#if overriding && isOverridden('text')}
        <button
          class="ov-reset"
          onclick={() => lens && editor.variants.resetEntryField(lens, entry, 'text')}
          >↺ reset to Main</button
        >
      {/if}
    </div>
  {:else}
    <div class="fields">
      {#each def?.fields ?? [] as f (f.key)}
        {#if !(def?.latexType === 'cvskills' && f.key === 'skills')}
          <label class="fld">
            <span class="lbl">
              {f.label}
              {#if overriding && isOverridden(f.key)}<span
                  class="ov-badge"
                  title="Overridden for this variant">●</span
                >{/if}
            </span>
            <span class="fld-in">
              {#if f.options}
                <select
                  class="in"
                  value={fieldVal(f.key)}
                  onchange={(e) => onFieldInput(f.key, e.currentTarget.value)}
                >
                  {#each f.options as opt (opt)}<option value={opt}>{opt || '—'}</option>{/each}
                </select>
              {:else}
                <input
                  class="in"
                  placeholder={f.label}
                  value={fieldVal(f.key)}
                  oninput={(e) => onFieldInput(f.key, e.currentTarget.value)}
                />
              {/if}
              {#if overriding && isOverridden(f.key)}
                <button
                  class="ov-reset mini-reset"
                  title="Reset to Main"
                  aria-label={`Reset ${f.label} to Main`}
                  onclick={() => lens && editor.variants.resetEntryField(lens, entry, f.key)}
                  >↺</button
                >
              {/if}
            </span>
          </label>
        {/if}
      {/each}
    </div>

    {#if overriding}
      <div class="ov-incl">
        <span class="tags-lbl">Show entry</span>
        {@render inclSeg(
          entryIncl,
          (s) => lens && editor.variants.setEntryIncluded(lens, entry, s),
        )}
      </div>

      {#if def?.hasItems && entry.items.length}
        <div class="bl-wrap ro">
          {#each entry.items as it (it.id)}
            <div class="bl ro">
              <div class="bl-ins" class:dim={itemDim(it)}>
                {#if it.title}<span class="bl-title-ro">{it.title}</span>{/if}
                <span class="bl-content-ro">{it.content}</span>
              </div>
              {@render inclSeg(
                itemIncl(it.id),
                (s) => lens && editor.variants.setItemIncluded(lens, it, s),
              )}
            </div>
          {/each}
        </div>
      {/if}
    {:else}
      <div class="tags-row">
        <span class="tags-lbl">Tags</span>
        <TagChips
          tags={entry.tags}
          onAdd={(t: string) => editor.tags.addToEntry(entry, [t])}
          onRemove={(t: string) => editor.tags.removeFromEntry(entry, t)}
        />
      </div>

      {#if def?.hasItems}
        <div
          class="bl-wrap"
          use:sortable={{ onReorder: (f, t) => editor.reorderItems(entry, f, t) }}
        >
          {#each entry.items as it, iIdx (it.id)}
            <div class="bl" data-sortable>
              <button
                class="grip bl-grip"
                data-drag-handle
                draggable="true"
                title="Drag, or press Alt+↑/↓ to reorder"
                aria-label="Reorder bullet"
                aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
                onkeydown={(ev) =>
                  reorderKeydown(ev, iIdx, entry.items.length, (f, t) =>
                    editor.reorderItems(entry, f, t),
                  )}>⠿</button
              >
              <div class="bl-ins">
                <input
                  class="in bl-title"
                  placeholder="lead-in (optional)"
                  bind:value={it.title}
                  oninput={() => editor.saveItem(it)}
                />
                <textarea
                  class="in bl-content"
                  rows="2"
                  placeholder={`${def.itemLabel ?? 'Bullet'} text…`}
                  bind:value={it.content}
                  oninput={() => editor.saveItem(it)}></textarea>
                <TagChips
                  tags={it.tags}
                  onAdd={(t: string) => editor.tags.addToItem(it, [t])}
                  onRemove={(t: string) => editor.tags.removeFromItem(it, t)}
                />
              </div>
              <button
                class="mini danger x"
                title="Delete bullet"
                aria-label="Delete bullet"
                onclick={() => editor.deleteBullet(entry, it.id)}>×</button
              >
            </div>
          {/each}
          <button class="mini add" onclick={() => editor.addBullet(entry)}
            >＋ {(def.itemLabel ?? 'bullet').toLowerCase()}</button
          >
        </div>
      {/if}
    {/if}
  {/if}

  <UnknownWarning {text} />
</div>

<style>
  .edit {
    border: 1px solid var(--ink);
    border-radius: var(--radius-md);
    background: var(--paper);
    box-shadow: var(--shadow);
    padding: 13px 14px;
    margin: 4px -10px;
    font-family: var(--sans);
  }

  .ehead {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 11px;
  }

  .etype {
    font-size: var(--text-4xs);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--dim);
    font-weight: 700;
  }

  .eacts {
    display: flex;
    gap: 6px;
  }

  .mini {
    font-family: var(--sans);
    font-size: var(--text-4xs);
    font-weight: 600;
    border: 1px solid var(--ink);
    border-radius: var(--radius);
    padding: 3px 10px;
    background: var(--paper);
    color: var(--ink);
    cursor: pointer;
    box-shadow: var(--shadow-sm);
  }

  .mini.primary {
    background: var(--ink);
    color: var(--paper);
  }

  .mini.sym-toggle {
    font-family: var(--serif);
    font-size: var(--text-3xs);
    padding: 3px 9px;
  }

  .mini.sym-toggle.on {
    background: var(--ink);
    color: var(--paper);
  }

  .mini.danger {
    color: var(--accent);
  }

  .mini:active {
    transform: translate(1px, 1px);
    box-shadow: none;
  }

  /* Variant-editing mode: the accent left-border makes the mode unmistakable, so a
     field edit is never mistaken for a base edit. */
  .vmode {
    font-size: var(--text-3xs);
    line-height: 1.5;
    color: var(--ink-2);
    background: var(--chrome-hi);
    border: 1px solid var(--accent);
    border-left-width: 3px;
    border-radius: var(--radius);
    padding: 8px 10px;
    margin-bottom: 11px;
  }

  .vmode strong {
    color: var(--ink);
  }

  .fields {
    display: flex;
    flex-direction: column;
    gap: 9px;
  }

  .tags-row {
    display: grid;
    grid-template-columns: 116px 1fr;
    align-items: start;
    gap: 12px;
    margin-top: 11px;
  }

  .tags-lbl {
    font-size: var(--text-4xs);
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--ink-2);
    padding-top: 3px;
  }

  .fld {
    display: grid;
    grid-template-columns: 116px 1fr;
    align-items: center;
    gap: 12px;
  }

  .lbl {
    font-size: var(--text-4xs);
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--ink-2);
  }

  .ov-badge {
    color: var(--accent);
    font-size: var(--text-4xs);
    margin-left: 5px;
    vertical-align: middle;
  }

  /* The field cell holds the input plus an optional inline "reset to Main". */
  .fld-in {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  .fld-in .in {
    flex: 1;
    min-width: 0;
  }

  .in {
    font-family: var(--sans);
    font-size: var(--text-xs);
    color: var(--ink);
    background: var(--chrome-hi);
    border: 1px solid var(--ink);
    border-radius: var(--radius);
    padding: 7px 10px;
    width: 100%;
  }

  .in:focus {
    outline: 2px solid var(--ink);
    outline-offset: 1px;
  }

  .para {
    font-family: var(--serif);
    resize: vertical;
  }

  .ov-wrap {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 7px;
  }

  .ov-reset {
    font-family: var(--sans);
    font-size: var(--text-4xs);
    font-weight: 600;
    border: 1px solid var(--ink);
    border-radius: var(--radius);
    padding: 3px 8px;
    background: var(--paper);
    color: var(--ink-2);
    cursor: pointer;
    box-shadow: var(--shadow-sm);
    white-space: nowrap;
  }

  .ov-reset:active {
    transform: translate(1px, 1px);
    box-shadow: none;
  }

  .mini-reset {
    padding: 4px 7px;
  }

  /* Segmented Follow-tags / Force-show / Force-hide control for per-entry + per-item visibility. */
  .ov-incl {
    display: grid;
    grid-template-columns: 116px 1fr;
    align-items: center;
    gap: 12px;
    margin-top: 11px;
  }

  .seg {
    display: inline-flex;
    border: 1px solid var(--ink);
    border-radius: var(--radius);
    overflow: hidden;
    justify-self: start;
  }

  .seg button {
    font-family: var(--sans);
    font-size: var(--text-4xs);
    font-weight: 600;
    padding: 3px 10px;
    background: var(--paper);
    color: var(--ink);
    border: 0;
    border-left: 1px solid var(--ink);
    cursor: pointer;
  }

  .seg button:first-child {
    border-left: 0;
  }

  .seg button.on {
    background: var(--ink);
    color: var(--paper);
  }

  .bl-wrap {
    margin-top: 13px;
    border-top: 1px solid var(--paper-3);
    padding-top: 11px;
    display: flex;
    flex-direction: column;
    gap: 9px;
  }

  .bl {
    display: flex;
    gap: 8px;
    align-items: flex-start;
  }

  /* Read-only bullet rows in variant mode: content on the left, visibility control right. */
  .bl-wrap.ro {
    gap: 7px;
  }

  .bl.ro {
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .bl.ro .bl-ins {
    gap: 2px;
  }

  .bl-title-ro {
    font-size: var(--text-3xs);
    font-weight: 600;
    color: var(--ink);
  }

  .bl-content-ro {
    font-family: var(--serif);
    font-size: var(--text-2xs);
    color: var(--ink);
  }

  .bl-ins.dim {
    opacity: 0.4;
  }

  .grip {
    font-family: var(--sans);
    font-size: var(--text-3xs);
    line-height: 1.7;
    color: var(--dim);
    background: none;
    border: 0;
    padding: 2px;
    cursor: grab;
    opacity: 0.4;
  }

  .grip:hover {
    opacity: 1;
  }

  .grip:active {
    cursor: grabbing;
  }

  .bl-ins {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 5px;
    min-width: 0;
  }

  .bl-title {
    font-size: var(--text-3xs);
    font-weight: 600;
  }

  .bl-content {
    font-family: var(--serif);
    font-size: var(--text-2xs);
    resize: vertical;
  }

  .x {
    padding: 2px 8px;
    font-size: var(--text-2xs);
    line-height: 1;
  }

  .add {
    align-self: flex-start;
    border-style: dashed;
    box-shadow: none;
    color: var(--ink-3);
  }

  /* Narrow phones: the fixed 116px label column leaves too little for the input, so
     stack label over field — each then spans the full width. */
  @media (width <= 640px) {
    .tags-row,
    .ov-incl,
    .fld {
      grid-template-columns: 1fr;
      align-items: start;
      gap: 4px;
    }
  }
</style>
