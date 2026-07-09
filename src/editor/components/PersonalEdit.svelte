<script lang="ts">
  // Header/identity editor — click the document masthead to edit these.
  import { editor } from '../lib/store.svelte';
  import { symbolInput } from '../lib/symbol-input.svelte';
  import SymbolPalette from './SymbolPalette.svelte';
  import UnknownWarning from './UnknownWarning.svelte';

  const FIELDS = [
    { key: 'firstName', label: 'First name' },
    { key: 'lastName', label: 'Last name' },
    { key: 'position', label: 'Headline' },
    { key: 'email', label: 'Email' },
    { key: 'mobile', label: 'Phone' },
    { key: 'address', label: 'Location' },
    { key: 'homepage', label: 'Website' },
    { key: 'github', label: 'GitHub' },
    { key: 'linkedin', label: 'LinkedIn' },
  ] as const;

  const sym = symbolInput();
  const text = $derived(FIELDS.map((f) => editor.person.personal[f.key] ?? '').join('  '));

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') editor.clearSelection();
  }
</script>

<svelte:window onkeydown={onKeydown} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="edit" onfocusin={sym.track}>
  <div class="ehead">
    <span class="etype">Personal details</span>
    <span class="eacts">
      <button
        class="mini sym-toggle"
        class:on={sym.open}
        title="Insert a symbol"
        aria-expanded={sym.open}
        onclick={() => sym.toggle()}>Ω</button
      >
      <button class="mini primary" onclick={() => editor.clearSelection()}>Done</button>
    </span>
  </div>

  {#if sym.open}
    <SymbolPalette onpick={sym.insert} />
  {/if}

  <div class="grid">
    {#each FIELDS as f (f.key)}
      <label class="fld">
        <span class="lbl">{f.label}</span>
        <input
          class="in"
          placeholder={f.label}
          bind:value={editor.person.personal[f.key]}
          oninput={() => editor.savePersonal(f.key)}
        />
      </label>
    {/each}
  </div>

  <UnknownWarning {text} />
</div>

<style>
  .edit {
    border: 1px solid var(--ink);
    border-radius: 8px;
    background: var(--paper);
    box-shadow: var(--shadow);
    padding: 13px 14px;
    margin: 0 -10px;
    font-family: var(--sans);
  }
  .ehead {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
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
    background: var(--ink);
    color: var(--paper);
    cursor: pointer;
    box-shadow: 1px 1px 0 var(--ink);
  }
  .mini.sym-toggle {
    font-family: var(--serif);
    font-size: 13px;
    padding: 3px 9px;
    background: var(--paper);
    color: var(--ink);
  }
  .mini.sym-toggle.on {
    background: var(--ink);
    color: var(--paper);
  }
  .mini:active {
    transform: translate(1px, 1px);
    box-shadow: none;
  }
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 9px 16px;
  }
  .fld {
    display: flex;
    flex-direction: column;
    gap: 4px;
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
  @media (width <= 620px) {
    .grid {
      grid-template-columns: 1fr;
    }
  }
</style>
