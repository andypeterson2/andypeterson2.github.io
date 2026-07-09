<script lang="ts">
  // The "what you can't do" half of increment 2: a quiet inline notice when the
  // given text holds a \command that isn't on the allowlist — it'll print
  // literally. Reads the same symbols.ts table as the escape transform, so it can
  // never disagree with what compiles. The host passes its joined editable text.
  import { unknownCommands } from '../lib/symbols';

  let { text }: { text: string } = $props();
  const unknowns = $derived(unknownCommands(text));
</script>

{#if unknowns.length}
  <p class="warn" role="status">
    <span class="wg" aria-hidden="true">⚠</span>
    <span
      >{unknowns.join(', ')}
      {unknowns.length === 1
        ? "isn't a recognized symbol — it"
        : "aren't recognized symbols — they"}
      will print literally. Pick from <b>Ω</b> for live ones.</span
    >
  </p>
{/if}

<style>
  .warn {
    display: flex;
    align-items: baseline;
    gap: 7px;
    margin: 12px 0 0;
    padding-top: 10px;
    border-top: 1px solid #e2e0d8;
    font-family: var(--sans);
    font-size: 11.5px;
    line-height: 1.45;
    color: #6b6960;
  }
  .warn .wg {
    color: var(--state-busy);
    font-size: 12px;
  }
  .warn b {
    font-family: var(--serif);
    font-weight: 700;
    color: var(--ink);
  }
</style>
