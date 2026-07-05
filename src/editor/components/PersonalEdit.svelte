<script lang="ts">
  // Header/identity editor — click the document masthead to edit these.
  import { editor } from '../lib/store.svelte';

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

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') editor.clearSelection();
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="edit">
  <div class="ehead">
    <span class="etype">Personal details</span>
    <button class="mini primary" onclick={() => editor.clearSelection()}>Done</button>
  </div>
  <div class="grid">
    {#each FIELDS as f (f.key)}
      <label class="fld">
        <span class="lbl">{f.label}</span>
        <input
          class="in"
          bind:value={editor.person.personal[f.key]}
          oninput={() => editor.edited()}
        />
      </label>
    {/each}
  </div>
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
