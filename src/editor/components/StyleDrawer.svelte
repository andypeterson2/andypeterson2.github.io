<script lang="ts">
  import { onMount } from 'svelte';
  import { editor } from '../lib/store.svelte';
  import { ACCENT_COLORS } from '../lib/accent';

  onMount(() => {
    void editor.loadStyle();
  });

  function pickAccent(key: string) {
    editor.style.accentColor = key;
    editor.saveStyle('accentColor');
  }
  function applyCustom() {
    if (/^#[0-9a-fA-F]{6}$/.test(editor.style.customHex.trim())) {
      editor.style.accentColor = 'custom';
      editor.saveStyle('accentColor');
      editor.saveStyle('customHex');
    }
  }
</script>

<!-- Controls stay live offline: changing the accent re-themes the document in place
     (a demo can try styles); they just don't persist until sign-in. So only the note
     changes when disconnected — the controls are always shown. -->
{#if editor.connected}
  <p class="note">Applies to the compiled PDF, across every profile.</p>
{:else}
  <p class="note">
    Try styles here — the accent re-themes the document live.
    <button class="link" onclick={() => editor.signIn()}>Sign in</button> to save them to your PDF.
  </p>
{/if}

<div class="group">
  <div class="lbl">Accent color</div>
  <div class="swatches">
    {#each ACCENT_COLORS as c (c.key)}
      <button
        class="swatch"
        class:on={editor.style.accentColor === c.key}
        style:background={c.hex}
        title={c.label}
        aria-label={c.label}
        onclick={() => pickAccent(c.key)}
      ></button>
    {/each}
  </div>
  <label class="custom">
    <span>Custom</span>
    <input class="in" placeholder="#RRGGBB" bind:value={editor.style.customHex} oninput={applyCustom} />
  </label>
</div>

<div class="group">
  <div class="lbl">Page size</div>
  <select class="in" bind:value={editor.style.pageSize} onchange={() => editor.saveStyle('pageSize')}>
    <option value="letterpaper">US Letter</option>
    <option value="a4paper">A4</option>
  </select>
</div>

<div class="group">
  <div class="lbl">Base font size</div>
  <select class="in" bind:value={editor.style.fontSize} onchange={() => editor.saveStyle('fontSize')}>
    <option value="10pt">10 pt</option>
    <option value="11pt">11 pt</option>
    <option value="12pt">12 pt</option>
  </select>
</div>

<style>
  .note {
    font-size: var(--text-4xs);
    color: var(--ink-3);
    margin: 0 0 16px;
  }
  .link {
    font: inherit;
    color: var(--link);
    background: none;
    border: 0;
    padding: 0;
    cursor: pointer;
    text-decoration: underline;
  }
  .group {
    margin-bottom: 18px;
  }
  .lbl {
    font-size: var(--text-4xs);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--ink-2);
    margin-bottom: 8px;
  }
  .swatches {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 7px;
  }
  .swatch {
    aspect-ratio: 1;
    border: 1px solid var(--ink);
    border-radius: var(--radius);
    cursor: pointer;
    padding: 0;
  }
  .swatch.on {
    outline: 2px solid var(--ink);
    outline-offset: 2px;
  }
  .custom {
    display: grid;
    grid-template-columns: 56px 1fr;
    align-items: center;
    gap: 10px;
    margin-top: 10px;
  }
  .custom span {
    font-size: var(--text-4xs);
    color: var(--ink-3);
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
</style>
