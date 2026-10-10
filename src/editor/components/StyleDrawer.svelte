<script lang="ts">
  import UiButton from './ui/Button.svelte';
  import { onMount } from 'svelte';
  import { editor } from '../lib/store.svelte';
  import { ACCENT_COLORS } from '../lib/accent';
  import { humanize } from '../lib/undo';
  import type { SettingValue } from '../lib/types';

  onMount(() => {
    void editor.loadStyle();
  });

  const str = (key: string) => editor.styleSetting(key);
  // Follows the active scope's value; typing overrides it until the next change.
  let customHex = $derived(str('style.customHex'));

  function pickAccent(key: string) {
    editor.setSetting('style.accentColor', key);
  }
  function applyCustom() {
    if (/^#[0-9a-fA-F]{6}$/.test(customHex.trim())) {
      editor.setSetting('style.customHex', customHex.trim());
      editor.setSetting('style.accentColor', 'custom');
    }
  }

  /** A length as number + unit, from a stored {num, unit} or a string such as "-3.6mm". */
  function length(v: SettingValue | undefined): { num: string; unit: string } {
    if (v && typeof v === 'object') return { num: String(v.num), unit: v.unit };
    const m = /^\s*(-?[\d.]+)\s*([a-z]+)\s*$/.exec(v ?? '');
    return m ? { num: m[1], unit: m[2] } : { num: '', unit: 'pt' };
  }
  function setLength(key: string, num: string, unit: string) {
    const n = Number(num);
    if (num.trim() === '' || !Number.isFinite(n)) return;
    editor.setSetting(key, { num: n, unit });
  }

  const groups = $derived(
    editor.renderCatalog
      ? [
          { title: 'Spacing', prefix: 'spacing', keys: Object.keys(editor.renderCatalog.spacing) },
          { title: 'Font sizes', prefix: 'fonts', keys: Object.keys(editor.renderCatalog.fonts) },
        ]
      : [],
  );
</script>

<!-- Controls stay live offline: changing the accent re-themes the document in place
     (a demo can try styles); they just don't persist until sign-in. So only the note
     changes when disconnected — the controls are always shown. -->
{#if editor.connected}
  {#if editor.activeVariant}
    <div class="scope" role="radiogroup" aria-label="Apply style changes to">
      <button
        role="radio"
        aria-checked={editor.settingsScope === 'variant'}
        class:on={editor.settingsScope === 'variant'}
        onclick={() => (editor.settingsScope = 'variant')}>This resume</button
      >
      <button
        role="radio"
        aria-checked={editor.settingsScope === 'account'}
        class:on={editor.settingsScope === 'account'}
        onclick={() => (editor.settingsScope = 'account')}>All resumes</button
      >
    </div>
  {/if}
  <p class="note">
    {#if editor.writeScope === 'variant'}
      Applies to “{editor.variantLabel}” only. Anything not set here follows All resumes.
    {:else}
      Applies to the compiled PDF, across every resume that doesn’t set its own.
    {/if}
  </p>
{:else}
  <p class="note">
    Try styles here — the accent re-themes the document live.
    <UiButton variant="link" onclick={() => editor.signIn()}>Sign in</UiButton> to save them to your PDF.
  </p>
{/if}

<div class="group">
  <div class="lbl">Accent color</div>
  <div class="swatches">
    {#each ACCENT_COLORS as c (c.key)}
      <button
        class="swatch"
        class:on={str('style.accentColor') === c.key}
        style:background={c.hex}
        title={c.label}
        aria-label={c.label}
        onclick={() => pickAccent(c.key)}
      ></button>
    {/each}
  </div>
  <label class="custom">
    <span>Custom</span>
    <input class="in" placeholder="#RRGGBB" bind:value={customHex} oninput={applyCustom} />
  </label>
</div>

<div class="group">
  <label class="lbl" for="style-page-size">Page size</label>
  <select
    id="style-page-size"
    class="in"
    value={str('style.pageSize')}
    onchange={(e) => editor.setSetting('style.pageSize', e.currentTarget.value)}
  >
    <option value="letterpaper">US Letter</option>
    <option value="a4paper">A4</option>
  </select>
</div>

<div class="group">
  <label class="lbl" for="style-font-size">Base font size</label>
  <select
    id="style-font-size"
    class="in"
    value={str('style.fontSize')}
    onchange={(e) => editor.setSetting('style.fontSize', e.currentTarget.value)}
  >
    <option value="10pt">10 pt</option>
    <option value="11pt">11 pt</option>
    <option value="12pt">12 pt</option>
  </select>
</div>

{#if editor.connected}
  {#each groups as g (g.prefix)}
    <div class="group">
      <div class="lbl">{g.title}</div>
      {#each g.keys as field (field)}
        {@const key = `${g.prefix}.${field}`}
        {@const cur = length(editor.settingValue(key))}
        <div class="len">
          <label for={`set-${key}`}>{humanize(field)}</label>
          <input
            id={`set-${key}`}
            class="in num"
            type="number"
            step="0.1"
            value={cur.num}
            onchange={(e) => setLength(key, e.currentTarget.value, cur.unit)}
          />
          <select
            class="in unit"
            aria-label={`${humanize(field)} unit`}
            value={cur.unit}
            onchange={(e) => setLength(key, cur.num, e.currentTarget.value)}
          >
            {#each editor.renderCatalog?.units ?? [] as u (u)}
              <option value={u}>{u}</option>
            {/each}
          </select>
          {#if editor.isSettingSet(key)}
            <UiButton variant="link" onclick={() => editor.setSetting(key, null)}>reset</UiButton>
          {:else}
            <span></span>
          {/if}
        </div>
      {/each}
    </div>
  {/each}
{/if}

<style>
  .note {
    font-size: var(--text-4xs);
    color: var(--ink-3);
    margin: 0 0 16px;
  }

  /* .link comes from the shared button families. */

  .group {
    margin-bottom: 18px;
  }

  .lbl {
    display: block;
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

  .scope {
    display: grid;
    grid-template-columns: 1fr 1fr;
    border: 1px solid var(--ink);
    border-radius: var(--radius);
    overflow: hidden;
    margin-bottom: 10px;
  }

  .scope button {
    font-family: var(--sans);
    font-size: var(--text-2xs);
    background: var(--chrome-hi);
    color: var(--ink);
    border: 0;
    padding: 6px 9px;
    cursor: pointer;
  }

  .scope button.on {
    background: var(--ink);
    color: var(--chrome-hi);
  }

  .len {
    display: grid;
    grid-template-columns: 1fr 72px 60px 40px;
    align-items: center;
    gap: 6px;
    margin-bottom: 6px;
  }

  .len label {
    font-size: var(--text-4xs);
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
</style>
