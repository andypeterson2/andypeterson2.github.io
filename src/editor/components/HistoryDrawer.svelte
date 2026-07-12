<script lang="ts">
  // Version history (ADR-006 increment 1). Take a named checkpoint of the whole
  // document, see the list, restore one. In the demo the list is for this session
  // only — the demo saves nothing (ADR-001); connected persistence + restore land
  // with the backend increment.
  import { onMount } from 'svelte';
  import { editor } from '../lib/store.svelte';

  let label = $state('');

  onMount(() => {
    void editor.history.load();
  });

  function take() {
    void editor.history.snapshot(label);
    label = '';
  }

  /** A compact "how long ago" — recomputed each render (the drawer is short-lived). */
  function when(ms: number): string {
    const secs = Math.round((Date.now() - ms) / 1000);
    if (secs < 45) return 'just now';
    const mins = Math.round(secs / 60);
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs} hr ago`;
    return new Date(ms).toLocaleDateString();
  }
</script>

<p class="note">
  A checkpoint captures the whole document. Restoring one replaces it and clears undo.
  {#if editor.connected}
    Durable, cross-session history lands with the backend.
  {:else}
    In the demo, history lives for this session only — nothing is saved.
  {/if}
</p>

<div class="make">
  <input
    class="in"
    placeholder="Checkpoint name (optional)"
    aria-label="Checkpoint name"
    bind:value={label}
    onkeydown={(e) => e.key === 'Enter' && take()}
  />
  <button class="snap" onclick={take}>Snapshot now</button>
</div>

{#if editor.history.versions.length === 0}
  <p class="empty">No checkpoints yet.<br />Snapshot the document to begin its history.</p>
{:else}
  <ul class="list" aria-label="Checkpoints, newest first">
    {#each editor.history.versions as v, i (v.id)}
      <li class="row">
        <span class="dot" class:head={i === 0} aria-hidden="true"></span>
        <div class="meta">
          <span class="name" class:untitled={!v.label}>{v.label || 'Untitled checkpoint'}</span>
          <span class="time">{when(v.createdAt)}{i === 0 ? ' · latest' : ''}</span>
        </div>
        <button
          class="restore"
          disabled={editor.history.restoring}
          onclick={() => editor.history.restore(v.id)}>Restore</button
        >
      </li>
    {/each}
  </ul>
{/if}

<style>
  .note {
    font-size: 11.5px;
    line-height: 1.5;
    color: #55534e;
    margin: 0 0 16px;
  }
  .make {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 8px;
    margin-bottom: 18px;
  }
  .in {
    font-family: var(--sans);
    font-size: 14px;
    color: var(--ink);
    background: var(--chrome-hi);
    border: 1px solid var(--ink);
    border-radius: 6px;
    padding: 6px 9px;
    width: 100%;
  }
  .snap {
    font-family: var(--sans);
    font-size: 12.5px;
    font-weight: 700;
    color: var(--paper);
    background: var(--ink);
    border: 1px solid var(--ink);
    border-radius: 6px;
    padding: 6px 12px;
    cursor: pointer;
    white-space: nowrap;
  }
  .snap:active {
    transform: translateY(1px);
  }
  .empty {
    font-size: 12px;
    line-height: 1.6;
    color: #77756e;
    text-align: center;
    margin: 26px 0;
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
  }
  .row {
    display: grid;
    grid-template-columns: 14px 1fr auto;
    align-items: center;
    gap: 10px;
    padding: 9px 0;
    border-bottom: 1px solid var(--faint, #e4e2db);
  }
  .row:last-child {
    border-bottom: 0;
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    border: 1px solid var(--ink);
    background: var(--paper);
    justify-self: center;
  }
  .dot.head {
    background: var(--ink);
  }
  .meta {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }
  .name {
    font-size: 13px;
    font-weight: 600;
    color: var(--ink);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .name.untitled {
    font-weight: 400;
    color: #77756e;
  }
  .time {
    font-size: 10.5px;
    color: #8f8d86;
    font-variant-numeric: tabular-nums;
  }
  .restore {
    font-family: var(--sans);
    font-size: 11.5px;
    font-weight: 700;
    color: var(--ink);
    background: var(--paper);
    border: 1px solid var(--ink);
    border-radius: 6px;
    padding: 4px 11px;
    cursor: pointer;
  }
  .restore:hover:not(:disabled) {
    background: var(--chrome-hi);
  }
  .restore:disabled {
    opacity: 0.4;
    cursor: default;
  }
</style>
