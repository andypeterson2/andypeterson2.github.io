<script lang="ts">
  // The "what you can use" surface: the permitted-symbol allowlist (symbols.ts)
  // rendered as clickable glyph chips, grouped by category. Presentational only —
  // it emits the chosen glyph and lets the host insert it at the field's caret.
  // The same table drives the escape transform, so the palette can never disagree
  // with what actually renders.
  import { SYMBOL_CATEGORIES } from '../lib/symbols';

  let { onpick }: { onpick: (glyph: string) => void } = $props();
</script>

<div class="palette" role="group" aria-label="Insert a symbol">
  <p class="hint">
    Type these directly, or <code>\command</code> (both become the symbol). Everything else prints
    literally.
  </p>
  {#each SYMBOL_CATEGORIES as cat (cat.name)}
    <div class="cat">
      <span class="cat-name">{cat.name}</span>
      <div class="chips">
        {#each cat.symbols as s (s.cmd)}
          <button
            class="sym"
            type="button"
            title={`${s.cmd} · ${s.label}`}
            aria-label={`Insert ${s.label}`}
            onclick={() => onpick(s.glyph)}>{s.glyph}</button
          >
        {/each}
      </div>
    </div>
  {/each}
</div>

<style>
  .palette {
    border: 1px solid var(--ink);
    border-radius: 7px;
    background: var(--chrome-hi);
    padding: 9px 11px 11px;
    margin: 0 0 11px;
    max-height: 216px;
    overflow-y: auto;
  }
  .hint {
    font-size: 11px;
    line-height: 1.45;
    color: #55534e;
    margin: 0 0 9px;
  }
  .hint code {
    font-family: var(--mono);
    font-size: 0.92em;
    background: var(--paper);
    border: 1px solid var(--faint, #d9d7cf);
    padding: 0 3px;
  }
  .cat {
    display: grid;
    grid-template-columns: 74px 1fr;
    align-items: start;
    gap: 10px;
    padding: 5px 0;
    border-top: 1px solid #e2e0d8;
  }
  .cat:first-of-type {
    border-top: 0;
  }
  .cat-name {
    font-family: var(--mono);
    font-size: 9.5px;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--dim);
    padding-top: 5px;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .sym {
    min-width: 26px;
    height: 26px;
    padding: 0 5px;
    font-family: var(--serif);
    font-size: 15px;
    line-height: 1;
    color: var(--ink);
    background: var(--paper);
    border: 1px solid var(--ink);
    border-radius: 5px;
    cursor: pointer;
    box-shadow: 1px 1px 0 var(--ink);
  }
  .sym:hover {
    background: var(--ink);
    color: var(--paper);
  }
  .sym:active {
    transform: translate(1px, 1px);
    box-shadow: none;
  }
  .sym:focus-visible {
    outline: 2px solid var(--ink);
    outline-offset: 1px;
  }
</style>
