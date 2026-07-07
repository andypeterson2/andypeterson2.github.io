<script lang="ts">
  import { editor } from '../lib/store.svelte';
  import { typeDef, entryLead, hasBullets, presetsByCategory } from '../lib/section-types';
  import EntryEdit from './EntryEdit.svelte';
  import PersonalEdit from './PersonalEdit.svelte';
  import { sortable } from '../lib/sortable';
  import { entryIncluded, itemIncluded, sectionScopedOut } from '../lib/variant-lens';
  import type { Section, Entry, Item } from '../lib/types';

  const person = $derived(editor.person);
  const sel = $derived(editor.selection);
  const selEntry = $derived(sel.kind === 'entry' ? sel.entryId : null);
  const personalSel = $derived(sel.kind === 'personal');
  const fullName = $derived(
    `${person.personal.firstName ?? ''} ${person.personal.lastName ?? ''}`.trim(),
  );
  const presets = presetsByCategory();
  let picking = $state(false);

  function contactLine(): string {
    const p = person.personal;
    return [p.position, p.email, p.address, p.github && `github/${p.github}`]
      .filter(Boolean)
      .join(' · ');
  }
  function pick(sectionId: Section['id'], entryId: number) {
    editor.select({ kind: 'entry', sectionId, entryId });
  }
  function onKey(e: KeyboardEvent, fn: () => void) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fn();
    }
  }
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
  // (highlightTag) and the variant lens (activeVariant → what a variant drops).
  const hl = $derived(editor.highlightTag);
  const lens = $derived(editor.activeVariant);

  function spotlightDim(e: Entry): boolean {
    return !!hl && !(e.tags.includes(hl) || e.items.some((i) => i.tags.includes(hl)));
  }
  /** Whole section greyed — the variant scopes it out entirely. */
  function sectionDim(section: Section): boolean {
    return !!lens && sectionScopedOut(section, lens);
  }
  function entryDim(section: Section, e: Entry): boolean {
    if (sectionDim(section)) return false; // the section container handles it
    if (spotlightDim(e)) return true;
    return !!lens && !entryIncluded(e, lens);
  }
  /** A single bullet dropped by the lens, while its entry is otherwise shown. */
  function itemDim(section: Section, e: Entry, it: Item): boolean {
    if (!lens || sectionDim(section) || !entryIncluded(e, lens)) return false;
    return !itemIncluded(it, lens);
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
</script>

<article class="doc" style="--accent: {editor.accentHex}">
  {#if personalSel}
    <PersonalEdit />
  {:else}
    <div
      class="doc-head"
      role="button"
      tabindex="0"
      onclick={() => editor.select({ kind: 'personal' })}
      onkeydown={(e) => onKey(e, () => editor.select({ kind: 'personal' }))}
    >
      <h1 class:untitled={!fullName}>{fullName || 'Your name'}</h1>
      <p class="contact">{contactLine()}</p>
    </div>
  {/if}

  <div class="sections" use:sortable={{ onReorder: (f, t) => editor.reorderSections(f, t) }}>
  {#each person.sections as section (section.id)}
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
          title="Drag to reorder section"
          aria-label="Reorder section"
          onclick={(e) => e.stopPropagation()}>⠿</button
        >
        <h2>{section.title}</h2>
        <span class="sec-tools">
          <button class="tool" title="Add entry" aria-label="Add entry" onclick={() => editor.addEntry(section)}>＋</button>
          <button class="tool danger" title="Delete section" aria-label="Delete section" onclick={() => confirmDelete(section)}>×</button>
        </span>
      </div>

      {#if def?.isParagraph}
        {@const pe = section.entries[0]}
        {#if pe && selEntry === pe.id}
          <EntryEdit {section} entry={pe} />
        {:else if pe}
          <div
            class="para entry-hit"
            class:dim={entryDim(section, pe)}
            role="button"
            tabindex="0"
            onclick={() => pick(section.id, pe.id)}
            onkeydown={(e) => onKey(e, () => pick(section.id, pe.id))}
          >
            {pe.fields.text || 'Click to write a summary…'}
          </div>
        {:else}
          <button class="empty" onclick={() => editor.addEntry(section)}>＋ Add text</button>
        {/if}
      {:else if def?.latexType === 'cvskills'}
        {#each section.entries as e (e.id)}
          {#if selEntry === e.id}
            <EntryEdit {section} entry={e} />
          {:else}
            <div
              class="skill entry-hit"
              class:dim={entryDim(section, e)}
              role="button"
              tabindex="0"
              draggable="true"
              data-drag-handle
              data-sortable
              onclick={() => pick(section.id, e.id)}
              onkeydown={(ev) => onKey(ev, () => pick(section.id, e.id))}
            >
              <span class="skill-cat">{e.fields.category}</span><span>{e.fields.skills}</span>
            </div>
          {/if}
        {/each}
      {:else if def?.latexType === 'cvhonors'}
        {#each section.entries as e (e.id)}
          {#if selEntry === e.id}
            <EntryEdit {section} entry={e} />
          {:else}
            <div
              class="entry"
              class:dim={entryDim(section, e)}
              role="button"
              tabindex="0"
              draggable="true"
              data-drag-handle
              data-sortable
              onclick={() => pick(section.id, e.id)}
              onkeydown={(ev) => onKey(ev, () => pick(section.id, e.id))}
            >
              <div class="entry-line">
                <span class="entry-title">{[e.fields.award, e.fields.issuer].filter(Boolean).join(' · ')}</span>
                <span class="entry-date">{e.fields.date ?? ''}</span>
              </div>
            </div>
          {/if}
        {/each}
      {:else if def?.latexType === 'cvreferences'}
        {#each section.entries as e (e.id)}
          {#if selEntry === e.id}
            <EntryEdit {section} entry={e} />
          {:else}
            <div
              class="entry"
              class:dim={entryDim(section, e)}
              role="button"
              tabindex="0"
              draggable="true"
              data-drag-handle
              data-sortable
              onclick={() => pick(section.id, e.id)}
              onkeydown={(ev) => onKey(ev, () => pick(section.id, e.id))}
            >
              <div class="entry-line">
                <span class="entry-title">{e.fields.name}</span>
                <span class="entry-date">{e.fields.relation ?? ''}</span>
              </div>
            </div>
          {/if}
        {/each}
      {:else}
        {#each section.entries as e (e.id)}
          {#if selEntry === e.id}
            <EntryEdit {section} entry={e} />
          {:else}
            <div
              class="entry"
              class:dim={entryDim(section, e)}
              role="button"
              tabindex="0"
              draggable="true"
              data-drag-handle
              data-sortable
              onclick={() => pick(section.id, e.id)}
              onkeydown={(ev) => onKey(ev, () => pick(section.id, e.id))}
            >
              <div class="entry-line">
                <span class="entry-title">{[entryLead(section.type, e.fields), e.fields.organization].filter(Boolean).join(' · ')}</span>
                <span class="entry-date">{e.fields.date ?? ''}</span>
              </div>
              {#if hasBullets(section.type) && e.items.length}
                <ul>
                  {#each e.items as it (it.id)}
                    <li class:dim={itemDim(section, e, it)}>{#if it.title}<b>{it.title}</b> — {/if}{it.content}{#each it.tags as t}<span class="tag">#{t}</span>{/each}</li>
                  {/each}
                </ul>
              {/if}
            </div>
          {/if}
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
  .doc {
    font-family: var(--serif);
    max-width: 640px;
    margin: 0 auto;
    padding: 40px 46px 54px;
    color: #232220;
  }
  .doc-head {
    cursor: pointer;
    border: 1px solid transparent;
    border-radius: 7px;
    padding: 6px 10px;
    margin: -6px -10px 0;
  }
  .doc-head:hover {
    border-color: #e2e0d8;
    background: #faf9f3;
  }
  .doc-head h1 {
    font-size: 30px;
    font-weight: 700;
    margin: 0 0 4px;
  }
  .doc-head h1.untitled {
    color: #a8a6a0;
  }
  .contact {
    font-size: 13.5px;
    color: #55534e;
    margin: 0;
  }
  .sec {
    margin-top: 28px;
    border-top: 1px solid #d9d7cf;
    padding-top: 15px;
  }
  .sec-head {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 8px;
  }
  .sec-head h2 {
    font-family: var(--sans);
    font-size: 11.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: var(--accent, #3a3934);
    margin: 0;
  }
  .sec-tools {
    margin-left: auto;
    opacity: 0.35;
    transition: opacity 0.12s;
  }
  .grip {
    font-family: var(--sans);
    font-size: 13px;
    line-height: 1;
    color: var(--dim);
    background: none;
    border: 0;
    padding: 2px 4px;
    cursor: grab;
    opacity: 0.3;
    transition: opacity 0.12s;
  }
  .sec:hover .grip {
    opacity: 0.85;
  }
  .grip:hover {
    opacity: 1;
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
    border-radius: 6px;
  }
  .sec:hover .sec-tools {
    opacity: 1;
  }
  .tool {
    font-family: var(--sans);
    font-size: 14px;
    line-height: 1;
    color: var(--dim);
    background: none;
    border: 1px solid transparent;
    border-radius: 5px;
    padding: 2px 7px;
    cursor: pointer;
  }
  .tool:hover {
    border-color: var(--ink);
    color: var(--ink);
  }
  .tool.danger:hover {
    border-color: #9c2b3f;
    color: #9c2b3f;
  }
  .para {
    font-size: 14px;
    line-height: 1.55;
    margin: 0;
  }
  .skill {
    display: grid;
    grid-template-columns: 132px 1fr;
    gap: 12px;
    font-size: 14px;
    margin: 4px 0;
  }
  .skill-cat {
    font-weight: 700;
  }
  .entry-hit {
    cursor: pointer;
    border: 1px solid transparent;
    border-radius: 6px;
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
    border-color: #e2e0d8;
    background: #faf9f3;
  }
  .entry {
    padding: 9px 10px;
    margin: 2px -10px;
    border: 1px solid transparent;
    border-radius: 6px;
    cursor: pointer;
  }
  .entry:hover {
    border-color: #e2e0d8;
    background: #faf9f3;
  }
  .entry:focus-visible,
  .entry-hit:focus-visible,
  .doc-head:focus-visible {
    outline: 2px solid var(--ink);
    outline-offset: 1px;
  }
  .dim {
    opacity: 0.28;
    transition: opacity 0.15s;
  }
  .entry-line {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 14px;
  }
  .entry-title {
    font-size: 15px;
    font-weight: 600;
  }
  .entry-date {
    font-family: var(--mono);
    font-size: 12px;
    color: #55534e;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  ul {
    margin: 6px 0 0;
    padding-left: 20px;
  }
  li {
    font-size: 14px;
    line-height: 1.55;
    margin: 3px 0;
  }
  .tag {
    font-family: var(--mono);
    font-size: 11px;
    color: var(--dim);
    margin-left: 6px;
  }
  .empty {
    font-family: var(--sans);
    font-size: 13px;
    color: #55534e;
    background: none;
    border: 1px dashed var(--dim);
    border-radius: 6px;
    padding: 8px 12px;
    cursor: pointer;
  }
  .add-wrap {
    margin-top: 22px;
  }
  .add-section {
    font-family: var(--sans);
    font-size: 12.5px;
    color: #55534e;
    background: none;
    border: 1px dashed var(--dim);
    border-radius: 6px;
    padding: 7px 12px;
    cursor: pointer;
    width: 100%;
  }
  .picker {
    border: 1px solid var(--ink);
    border-radius: 8px;
    background: var(--paper);
    box-shadow: var(--shadow);
    padding: 8px;
  }
  .pick-cat {
    font-family: var(--sans);
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--dim);
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
    border-radius: 6px;
    padding: 6px 8px;
    cursor: pointer;
    font-family: var(--sans);
  }
  .pick:hover {
    background: var(--chrome-hi);
  }
  .pick-label {
    font-size: 13.5px;
    font-weight: 600;
    color: var(--ink);
  }
  .pick-desc {
    font-size: 11.5px;
    color: #55534e;
  }
  .pick-cancel {
    margin-top: 6px;
    width: 100%;
    font-family: var(--sans);
    font-size: 12px;
    border: 1px solid var(--ink);
    border-radius: 6px;
    background: var(--paper);
    padding: 5px;
    cursor: pointer;
    box-shadow: 1px 1px 0 var(--ink);
  }
</style>
