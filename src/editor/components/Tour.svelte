<script lang="ts">
  // The tour's narrator: a miniature System-6 window, not a coach-mark. No scrim,
  // no spotlight cut-out, never modal — the app underneath stays fully usable,
  // because the moment you touch it the tour yields (see Editor.svelte's handlers).
  //
  // `data-tour` marks this subtree as the tour's own chrome: events inside it are
  // controls, not interruptions.
  import { tour } from '../lib/tour.svelte';
  import { editor } from '../lib/store.svelte';

  const done = $derived(tour.state === 'done');
  const paused = $derived(tour.state === 'paused');

  function resetAndClose() {
    editor.resetDemo();
    tour.end();
  }
</script>

{#if tour.state !== 'idle'}
  <section class="tour floating-panel" data-tour role="region" aria-label="Guided tour">
    <div class="tbar">
      <button class="tclose" aria-label="End tour" onclick={() => tour.end()}></button>
      <span class="ttl">{done ? 'Tour complete' : 'Guided tour'}</span>
      <span class="tfill"></span>
    </div>
    <div class="tbody">
      {#if done}
        <p class="cap">That was the tour. The demo is yours now — nothing you do is saved.</p>
        <div class="row">
          <span class="count">{tour.total} of {tour.total}</span>
          <span class="gap"></span>
          <button class="tbtn" onclick={resetAndClose}>↺ Reset demo</button>
          <button class="tbtn" onclick={() => tour.end()}>Close</button>
        </div>
      {:else}
        <p class="cap">{tour.caption}</p>
        {#if paused}
          <p class="wheel">Paused — you have the wheel.</p>
        {/if}
        <div class="row">
          <span class="count">{tour.index + 1} of {tour.total}</span>
          <span class="gap"></span>
          {#if paused}
            <button class="tbtn" onclick={() => tour.resume()}>▶ Resume</button>
          {:else if !tour.manual}
            <button class="tbtn" onclick={() => tour.takeover()}>⏸ Pause</button>
          {/if}
          {#if paused || tour.manual}
            <button class="tbtn" onclick={() => tour.next()}>Next ▸</button>
          {/if}
          <button class="tbtn" onclick={() => tour.end()}>✕ End</button>
        </div>
      {/if}
    </div>
  </section>
{/if}

<style>
  /* Position, paper, border, hard shadow and mono chrome all come from the shared
     .floating-panel primitive (lib/styles.css) — the same one the save toast uses. */
  .tour {
    width: min(92vw, 430px);
  }
  .tbar {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 21px;
    padding: 0 6px;
    border-bottom: 1px solid var(--ink);
    background-image: repeating-linear-gradient(
      to bottom,
      var(--ink) 0,
      var(--ink) 1px,
      var(--paper) 1px,
      var(--paper) 3px
    );
  }
  .tclose {
    width: 11px;
    height: 11px;
    background: var(--paper);
    border: 1px solid var(--ink);
    padding: 0;
    cursor: pointer;
    flex: none;
  }
  .ttl {
    font-family: var(--sans);
    font-size: 11.5px;
    font-weight: 700;
    background: var(--paper);
    padding: 0 10px;
    margin: 0 auto;
  }
  .tfill {
    width: 11px;
  }
  .tbody {
    padding: 10px 12px 11px;
  }
  .cap {
    font-family: var(--sans);
    font-size: 13px;
    line-height: 1.45;
    margin: 0;
    text-wrap: balance;
  }
  .wheel {
    font-family: var(--mono);
    font-size: 11.5px;
    color: #57554f;
    margin: 6px 0 0;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 10px;
  }
  .count {
    font-family: var(--mono);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    color: var(--dim);
  }
  .gap {
    flex: 1;
  }
  .tbtn {
    font-family: var(--mono);
    font-size: 12px;
    color: var(--ink);
    background: var(--chrome-hi);
    border: 1px solid var(--ink);
    padding: 2px 8px;
    cursor: pointer;
  }
  .tbtn:hover {
    background: var(--ink);
    color: var(--paper);
  }
  .tbtn:focus-visible,
  .tclose:focus-visible {
    outline: 2px solid var(--ink);
    outline-offset: 1px;
  }
</style>
