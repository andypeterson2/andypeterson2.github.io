<script lang="ts">
  // Expand-in-place editor for a single entry. Data-driven from the section
  // type's field list (see section-types.ts) so it handles all 5 shapes:
  // paragraph → textarea; everything else → labelled fields (+ bullets when hasItems).
  import { editor } from '../lib/store.svelte';
  import { typeDef } from '../lib/section-types';
  import { sortable, reorderKeydown } from '../lib/sortable';
  import TagChips from './TagChips.svelte';
  import type { Entry, Section } from '../lib/types';

  let { section, entry }: { section: Section; entry: Entry } = $props();
  const def = $derived(typeDef(section.type));

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') editor.clearSelection();
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="edit">
  <div class="ehead">
    <span class="etype">{def?.label ?? section.type}{def?.entryLabel ? ` · ${def.entryLabel}` : ''}</span>
    <span class="eacts">
      <button class="mini danger" onclick={() => editor.deleteEntry(section, entry.id)}>Delete</button>
      <button class="mini primary" onclick={() => editor.clearSelection()}>Done</button>
    </span>
  </div>

  {#if def?.isParagraph}
    <textarea
      class="in para"
      rows="5"
      placeholder="Write your summary…"
      bind:value={entry.fields.text}
      oninput={() => editor.saveEntry(entry)}
    ></textarea>
  {:else}
    <div class="fields">
      {#each def?.fields ?? [] as f (f.key)}
        <label class="fld">
          <span class="lbl">{f.label}</span>
          {#if f.options}
            <select class="in" bind:value={entry.fields[f.key]} onchange={() => editor.saveEntry(entry)}>
              {#each f.options as opt (opt)}<option value={opt}>{opt || '—'}</option>{/each}
            </select>
          {:else}
            <input
              class="in"
              placeholder={f.label}
              bind:value={entry.fields[f.key]}
              oninput={() => editor.saveEntry(entry)}
            />
          {/if}
        </label>
      {/each}
    </div>

    <div class="tags-row">
      <span class="tags-lbl">Tags</span>
      <TagChips
        tags={entry.tags}
        onAdd={(t) => editor.tags.addToEntry(entry, [t])}
        onRemove={(t) => editor.tags.removeFromEntry(entry, t)}
      />
    </div>

    {#if def?.hasItems}
      <div class="bl-wrap" use:sortable={{ onReorder: (f, t) => editor.reorderItems(entry, f, t) }}>
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
                oninput={() => editor.saveItem(it)}
              ></textarea>
              <TagChips
                tags={it.tags}
                onAdd={(t) => editor.tags.addToItem(it, [t])}
                onRemove={(t) => editor.tags.removeFromItem(it, t)}
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
</div>

<style>
  .edit {
    border: 1px solid var(--ink);
    border-radius: 8px;
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
    font-size: 10px;
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
    font-size: 11.5px;
    font-weight: 600;
    border: 1px solid var(--ink);
    border-radius: 6px;
    padding: 3px 10px;
    background: var(--paper);
    color: var(--ink);
    cursor: pointer;
    box-shadow: 1px 1px 0 var(--ink);
  }
  .mini.primary {
    background: var(--ink);
    color: var(--paper);
  }
  .mini.danger {
    color: #9c2b3f;
  }
  .mini:active {
    transform: translate(1px, 1px);
    box-shadow: none;
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
    font-size: 10.5px;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: #4a4944;
    padding-top: 3px;
  }
  .fld {
    display: grid;
    grid-template-columns: 116px 1fr;
    align-items: center;
    gap: 12px;
  }
  .lbl {
    font-size: 10.5px;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: #4a4944;
  }
  .in {
    font-family: var(--sans);
    font-size: 16px;
    color: var(--ink);
    background: var(--chrome-hi);
    border: 1px solid var(--ink);
    border-radius: 6px;
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
  .bl-wrap {
    margin-top: 13px;
    border-top: 1px solid #e2e0d8;
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
  .grip {
    font-family: var(--sans);
    font-size: 12px;
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
  }
  .bl-title {
    font-size: 13.5px;
    font-weight: 600;
  }
  .bl-content {
    font-family: var(--serif);
    font-size: 14px;
    resize: vertical;
  }
  .x {
    padding: 2px 8px;
    font-size: 14px;
    line-height: 1;
  }
  .add {
    align-self: flex-start;
    border-style: dashed;
    box-shadow: none;
    color: #55534e;
  }
</style>
