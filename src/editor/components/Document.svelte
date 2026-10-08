<script lang="ts">
  import { editor } from '../lib/store.svelte';
  import { typeDef, presetsByCategory } from '../lib/section-types';
  import EntryEdit from './EntryEdit.svelte';
  import PersonalEdit from './PersonalEdit.svelte';
  import { sortable, reorderKeydown } from '../lib/sortable';
  import { entryIncluded, sectionScopedOut } from '../lib/variant-lens';
  import type { Section, Entry } from '../lib/types';

  const person = $derived(editor.person);
  const presets = presetsByCategory();
  let picking = $state(false);

  function chooseSection(type: string) {
    void editor.addSection(type);
    picking = false;
  }
  function confirmDelete(section: Section) {
    if (window.confirm(`Delete the "${section.title}" section and everything in it?`)) {
      void editor.deleteSection(section.id);
    }
  }

  // Two dimming modes compose onto the same .dim class: the tag spotlight
  // (tags.highlight) and the variant lens (activeVariant → what a variant drops).
  const hl = $derived(editor.tags.highlight);
  /** Greyed by the tag spotlight: the entry carries none of the highlighted tag. */
  function spotlightDim(e: Entry): boolean {
    return !!hl && !(e.tags.includes(hl) || e.items.some((i) => i.tags.includes(hl)));
  }
  /** Greyed by the spotlight, or dropped by the variant lens the document is under. */
  function entryDim(section: Section, e: Entry): boolean {
    if (sectionDim(section)) return false; // the section container handles it
    if (spotlightDim(e)) return true;
    return !!lens && !entryIncluded(e, lens);
  }
  const lens = $derived(editor.activeVariant);

  /** Whole section greyed — the variant scopes it out entirely. */
  function sectionDim(section: Section): boolean {
    return !!lens && sectionScopedOut(section, lens);
  }
  // Scroll a newly-created section into view once it renders.
  $effect(() => {
    const id = editor.scrollTarget;
    if (id == null) return;
    editor.scrollTarget = null;
    requestAnimationFrame(() => {
      document.getElementById(`sec-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  // Set --accent via CSSOM setProperty, not `style:--accent`: the directive
  // server-renders a style="…" attribute that the site's strict hashed CSP refuses.
  let docEl = $state<HTMLElement>();
  $effect(() => {
    docEl?.style.setProperty('--accent', editor.accentHex);
  });
</script>

<article class="doc" bind:this={docEl}>
  <PersonalEdit />

  <div class="sections" use:sortable={{ onReorder: (f, t) => editor.reorderSections(f, t) }}>
    {#each person.sections as section, sIdx (section.id)}
      {@const def = typeDef(section.type)}
      <section
        class="sec"
        class:dim={sectionDim(section)}
        data-sortable
        id={`sec-${section.id}`}
        use:sortable={{ onReorder: (f, t) => editor.reorderEntries(section, f, t) }}
      >
        <div class="sec-head">
          <button
            class="grip"
            data-drag-handle
            draggable="true"
            title="Drag, or press Alt+↑/↓ to reorder"
            aria-label="Reorder section"
            aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
            onkeydown={(ev) =>
              reorderKeydown(ev, sIdx, person.sections.length, (f, t) =>
                editor.reorderSections(f, t),
              )}
            onclick={(e) => e.stopPropagation()}>⠿</button
          >
          <h2>{section.title}</h2>
          <span class="sec-tools">
            <button
              class="tool"
              title="Add entry"
              aria-label="Add entry"
              onclick={() => editor.addEntry(section)}>＋</button
            >
            <button
              class="tool danger"
              title="Delete section"
              aria-label="Delete section"
              onclick={() => confirmDelete(section)}>×</button
            >
          </span>
        </div>

        {#if def?.isParagraph}
          {@const pe = section.entries[0]}
          {#if pe}
            <EntryEdit {section} entry={pe} index={0} dim={entryDim(section, pe)} />
          {:else}
            <button class="empty" onclick={() => editor.addEntry(section)}>＋ Add text</button>
          {/if}
        {:else if def?.latexType === 'cvskills'}
          {#each section.entries as e, eIdx (e.id)}
            <EntryEdit {section} entry={e} index={eIdx} dim={entryDim(section, e)} />
          {/each}
        {:else if def?.latexType === 'cvhonors'}
          {#each section.entries as e, eIdx (e.id)}
            <EntryEdit {section} entry={e} index={eIdx} dim={entryDim(section, e)} />
          {/each}
        {:else if def?.latexType === 'cvreferences'}
          {#each section.entries as e, eIdx (e.id)}
            <EntryEdit {section} entry={e} index={eIdx} dim={entryDim(section, e)} />
          {/each}
        {:else}
          {#each section.entries as e, eIdx (e.id)}
            <EntryEdit {section} entry={e} index={eIdx} dim={entryDim(section, e)} />
          {/each}
        {/if}

        {#if !def?.isParagraph && section.entries.length === 0}
          <button class="empty" onclick={() => editor.addEntry(section)}
            >＋ Add {def?.entryLabel?.toLowerCase() ?? 'entry'}</button
          >
        {/if}
      </section>
    {/each}
  </div>

  <div class="add-wrap">
    {#if picking}
      <div class="picker">
        {#each Object.entries(presets) as [cat, items] (cat)}
          <div class="pick-cat">{cat}</div>
          {#each items as it (it.key)}
            <button class="pick" onclick={() => chooseSection(it.key)}>
              <span class="pick-label">{it.label}</span>
              <span class="pick-desc">{it.description}</span>
            </button>
          {/each}
        {/each}
        <button class="pick-cancel" onclick={() => (picking = false)}>Cancel</button>
      </div>
    {:else}
      <button class="add-section" onclick={() => (picking = true)}>＋ Add section</button>
    {/if}
  </div>
</article>

<style>
  /* Fills the pane it sits in: the window around it already sets the measure, and
     a page-width column inside left a wide band of paper either side of it. */
  .doc {
    font-family: var(--serif);
    padding: 40px 46px 54px;
    color: var(--ink);
  }

  .doc-head {
    cursor: pointer;
    border: 1px solid transparent;
    border-radius: var(--radius);
    padding: 6px 10px;
    margin: -6px -10px 0;
  }

  .doc-head:hover {
    border-color: var(--paper-3);
    background: var(--paper-2);
  }

  .doc-head h1 {
    font-size: var(--text-lg);
    font-weight: 700;
    margin: 0 0 4px;
  }

  .doc-head h1.untitled {
    color: var(--ink);
  }

  .contact {
    font-size: var(--text-3xs);
    color: var(--ink-3);
    margin: 0;
  }

  .sec {
    margin-top: 28px;
    border-top: 1px solid var(--ink);
    padding-top: 15px;
  }

  .sec-head {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 8px;
  }

  /* The resume's own type: the print faces. */
  .sec-head h2 {
    font-family: var(--doc-sans);
    font-size: var(--text-4xs);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: var(--ink);
    margin: 0;
  }

  /* Always at full strength: a control that fades until hovered reads as disabled,
     and a half-strength mark is a grey the rest of the editor does not use. */
  .sec-tools {
    margin-left: auto;
  }

  .grip {
    font-family: var(--sans);
    font-size: var(--text-3xs);
    line-height: 1;
    color: var(--ink);
    background: none;
    border: 0;
    padding: 2px 4px;
    cursor: grab;
  }

  .grip:active {
    cursor: grabbing;
  }

  :global([data-dragging]) {
    opacity: 0.4;
  }

  :global([data-over]) {
    outline: 2px dashed var(--dim);
    outline-offset: 2px;
    border-radius: var(--radius);
  }

  .tool {
    font-family: var(--sans);
    font-size: var(--text-2xs);
    line-height: 1;
    color: var(--ink);
    background: none;
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    padding: 2px 7px;
    cursor: pointer;
  }

  .tool:hover {
    border-color: var(--ink);
    color: var(--ink);
  }

  .tool.danger:hover {
    background: var(--ink);
    color: var(--paper);
  }

  .para {
    font-size: var(--text-2xs);
    line-height: 1.55;
    margin: 0;
  }

  .skill {
    display: grid;
    grid-template-columns: 132px 1fr;
    gap: 12px;
    font-size: var(--text-2xs);
    margin: 4px 0;
  }

  .skill-cat {
    font-weight: 700;
  }

  /* Long skills and tag chips wrap instead of pushing the page sideways at 320px. */
  .skill-list {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .entry-hit {
    cursor: pointer;
    border: 1px solid transparent;
    border-radius: var(--radius);
  }

  .para.entry-hit {
    padding: 6px 10px;
    margin: 0 -10px;
  }

  .skill.entry-hit {
    padding: 6px 10px;
    margin: 2px -10px;
  }

  .entry-hit:hover {
    border-color: var(--paper-3);
    background: var(--paper-2);
  }

  .entry {
    padding: 9px 10px;
    margin: 2px -10px;
    border: 1px solid transparent;
    border-radius: var(--radius);
    cursor: pointer;
  }

  .entry:hover {
    border-color: var(--paper-3);
    background: var(--paper-2);
  }

  .entry:focus-visible,
  .entry-hit:focus-visible,
  .doc-head:focus-visible {
    outline: 2px solid var(--ink);
    outline-offset: 1px;
  }

  .dim {
    opacity: 0.28;
    transition: opacity var(--dur);
  }

  .entry-line {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 14px;
  }

  .entry-title {
    font-size: var(--text-2xs);
    font-weight: 600;
  }

  .entry-date {
    font-family: var(--doc-mono);
    font-size: var(--text-3xs);
    color: var(--ink-3);
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  /* Mobile: the resume renders in a narrow column, so the role/date row and the
     skill category/list grid get crushed (a role wraps to 4 lines beside its date).
     Stack them — role over date, category over list — so each gets the full width. */
  @media (width <= 640px) {
    .entry-line {
      flex-direction: column;
      align-items: flex-start;
      gap: 2px;
    }

    .skill {
      grid-template-columns: minmax(0, 1fr);
      gap: 2px;
    }
  }

  ul {
    margin: 6px 0 0;
    padding-left: 20px;
  }

  li {
    font-size: var(--text-2xs);
    line-height: 1.55;
    margin: 3px 0;
  }

  .tag {
    font-family: var(--mono);
    font-size: var(--text-4xs);
    color: var(--ink);
    margin-left: 6px;
  }

  .empty {
    font-family: var(--sans);
    font-size: var(--text-3xs);
    color: var(--ink-3);
    background: none;
    border: 1px dashed var(--dim);
    border-radius: var(--radius);
    padding: 8px 12px;
    cursor: pointer;
  }

  .add-wrap {
    margin-top: 22px;
  }

  .add-section {
    font-family: var(--sans);
    font-size: var(--text-3xs);
    color: var(--ink-3);
    background: none;
    border: 1px dashed var(--dim);
    border-radius: var(--radius);
    padding: 7px 12px;
    cursor: pointer;
    width: 100%;
  }

  .picker {
    border: 1px solid var(--ink);
    border-radius: var(--radius-md);
    background: var(--paper);
    padding: 8px;
  }

  .pick-cat {
    font-family: var(--sans);
    font-size: var(--text-4xs);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--ink);
    padding: 8px 8px 4px;
  }

  .pick {
    display: flex;
    flex-direction: column;
    gap: 1px;
    width: 100%;
    text-align: left;
    background: none;
    border: 0;
    border-radius: var(--radius);
    padding: 6px 8px;
    cursor: pointer;
    font-family: var(--sans);
  }

  .pick:hover {
    background: var(--chrome-hi);
  }

  .pick-label {
    font-size: var(--text-3xs);
    font-weight: 600;
    color: var(--ink);
  }

  .pick-desc {
    font-size: var(--text-4xs);
    color: var(--ink-3);
  }

  .pick-cancel {
    margin-top: 6px;
    width: 100%;
    font-family: var(--sans);
    font-size: var(--text-3xs);
    border: 1px solid var(--ink);
    border-radius: var(--radius);
    background: var(--paper);
    padding: 5px;
    cursor: pointer;
  }

  /* Touch: grips and section tools get a 44px hit area and stop hiding behind
     hover, which a finger can't do. */
  @media (pointer: coarse) {
    .grip,
    .tool {
      min-width: 44px;
      min-height: 44px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .grip,
    .sec-tools {
      opacity: 1;
    }
  }
</style>
