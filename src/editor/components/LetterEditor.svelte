<script lang="ts">
  // Cover-letter editor — replaces the CV document when a coverletter variant is
  // active. Both the header (recipient/salutation/closing, editor.letters.header)
  // and the body paragraphs (editor.letters.sections) are per-variant.
  import { editor } from '../lib/store.svelte';
  import { sortable, reorderKeydown } from '../lib/sortable';

  const cl = $derived(editor.letters.header);
  const sender = $derived(
    `${editor.person.personal.firstName ?? ''} ${editor.person.personal.lastName ?? ''}`.trim(),
  );

  function paraKey(ev: KeyboardEvent, index: number) {
    reorderKeydown(ev, index, editor.letters.sections.length, (f, t) =>
      editor.letters.reorderParagraphs(f, t),
    );
  }
</script>

<article class="letter">
  <header class="lh">
    <h1 class:untitled={!sender}>{sender || 'Your name'}</h1>
    <div class="fields">
      <label class="fld">
        <span class="lbl">Recipient</span>
        <input
          class="in"
          placeholder="Hiring Manager, Company"
          bind:value={cl.recipientName}
          oninput={() => editor.letters.saveHeader('recipientName')}
        />
      </label>
      <label class="fld">
        <span class="lbl">Address</span>
        <textarea
          class="in addr"
          rows="2"
          placeholder="Company address"
          bind:value={cl.recipientAddress}
          oninput={() => editor.letters.saveHeader('recipientAddress')}
        ></textarea>
      </label>
      <label class="fld">
        <span class="lbl">Salutation</span>
        <input
          class="in"
          placeholder="Dear Hiring Manager,"
          bind:value={cl.opening}
          oninput={() => editor.letters.saveHeader('opening')}
        />
      </label>
    </div>
  </header>

  <div class="paras" use:sortable={{ onReorder: (f, t) => editor.letters.reorderParagraphs(f, t) }}>
    {#each editor.letters.sections as s, i (s.id)}
      <div class="para" data-sortable>
        <button
          class="grip"
          data-drag-handle
          draggable="true"
          title="Drag, or press Alt+↑/↓ to reorder"
          aria-label="Reorder paragraph"
          aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
          onkeydown={(ev) => paraKey(ev, i)}>⠿</button
        >
        <div class="para-ins">
          <input
            class="in lead"
            placeholder="lead-in (optional)"
            bind:value={s.title}
            oninput={() => editor.letters.saveParagraph(s)}
          />
          <textarea
            class="in body"
            rows="4"
            placeholder="Write this paragraph…"
            bind:value={s.body}
            oninput={() => editor.letters.saveParagraph(s)}
          ></textarea>
        </div>
        <button
          class="del"
          title="Delete paragraph"
          aria-label="Delete paragraph"
          onclick={() => editor.letters.deleteParagraph(s.id)}>×</button
        >
      </div>
    {/each}
    {#if editor.letters.sections.length === 0}
      <p class="empty">No paragraphs yet.</p>
    {/if}
    <button class="add" onclick={() => editor.letters.addParagraph()}>＋ Add paragraph</button>
  </div>

  <footer class="lf">
    <label class="fld">
      <span class="lbl">Closing</span>
      <input
        class="in"
        placeholder="Sincerely,"
        bind:value={cl.closing}
        oninput={() => editor.letters.saveHeader('closing')}
      />
    </label>
    <p class="signoff">{sender || 'Your name'}</p>
  </footer>
</article>

<style>
  .letter {
    font-family: var(--serif);
    max-width: 640px;
    margin: 0 auto;
    padding: 40px 46px 54px;
    color: #232220;
  }
  .lh h1 {
    font-size: 30px;
    font-weight: 700;
    margin: 0 0 16px;
  }
  .lh h1.untitled {
    color: #a8a6a0;
  }
  .fields {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-bottom: 20px;
    border-bottom: 1px solid #d9d7cf;
  }
  .fld {
    display: grid;
    grid-template-columns: 96px 1fr;
    align-items: start;
    gap: 12px;
  }
  .lbl {
    font-family: var(--sans);
    font-size: 10.5px;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: #4a4944;
    padding-top: 8px;
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
  .addr {
    font-family: var(--sans);
    resize: vertical;
  }
  .paras {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 20px 0;
  }
  .para {
    display: flex;
    gap: 8px;
    align-items: flex-start;
  }
  .grip {
    font-family: var(--sans);
    font-size: 13px;
    line-height: 1.6;
    color: var(--dim);
    background: none;
    border: 0;
    padding: 4px 2px;
    cursor: grab;
    opacity: 0.4;
  }
  .grip:hover {
    opacity: 1;
  }
  .grip:active {
    cursor: grabbing;
  }
  .para-ins {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .lead {
    font-size: 13.5px;
    font-weight: 600;
  }
  .body {
    font-family: var(--serif);
    font-size: 15px;
    line-height: 1.55;
    resize: vertical;
  }
  .del {
    font-family: var(--sans);
    font-size: 15px;
    line-height: 1;
    color: var(--dim);
    background: none;
    border: 1px solid transparent;
    border-radius: 5px;
    padding: 4px 8px;
    cursor: pointer;
  }
  .del:hover {
    border-color: #9c2b3f;
    color: #9c2b3f;
  }
  .empty {
    font-family: var(--sans);
    font-size: 13px;
    color: #8a887f;
    margin: 0;
  }
  .add {
    align-self: flex-start;
    font-family: var(--sans);
    font-size: 13px;
    color: #55534e;
    background: none;
    border: 1px dashed var(--dim);
    border-radius: 6px;
    padding: 8px 12px;
    cursor: pointer;
  }
  .lf {
    padding-top: 20px;
    border-top: 1px solid #d9d7cf;
  }
  .signoff {
    font-size: 15px;
    margin: 14px 0 0;
  }
  :global([data-dragging]) {
    opacity: 0.4;
  }
  :global([data-over]) {
    outline: 2px dashed var(--dim);
    outline-offset: 2px;
    border-radius: 6px;
  }
</style>
