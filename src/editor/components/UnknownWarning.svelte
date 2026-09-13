<script lang="ts">
  // A quiet notice when the host's joined editable text holds a \command that isn't
  // on the allowlist (it will print literally), from the escape transform's table.
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
    border-top: 1px solid var(--paper-3);
    font-family: var(--sans);
    font-size: var(--text-4xs);
    line-height: 1.45;
    color: var(--color-text-muted);
  }

  .warn .wg {
    color: var(--state-busy);
    font-size: var(--text-3xs);
  }

  .warn b {
    font-family: var(--serif);
    font-weight: 700;
    color: var(--ink);
  }
</style>
