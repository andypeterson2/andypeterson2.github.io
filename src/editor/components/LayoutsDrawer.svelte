<script lang="ts">
  import { onMount } from 'svelte';
  import { editor } from '../lib/store.svelte';

  onMount(() => {
    void editor.loadLayouts();
  });
</script>

<p class="note">The LaTeX template used to compile the PDF.</p>

{#if editor.layouts.length === 0}
  <p class="empty">No layouts available.</p>
{:else}
  <div class="list">
    {#each editor.layouts as l (l.id)}
      <button
        class="row"
        class:on={editor.defaultLayout === l.id}
        disabled={l.status !== 'active'}
        onclick={() => editor.chooseLayout(l.id)}
      >
        <span class="dot" class:sel={editor.defaultLayout === l.id}></span>
        <span class="name">{l.name}</span>
        {#if l.status !== 'active'}<span class="badge">{l.status}</span>{/if}
      </button>
    {/each}
  </div>
{/if}

<style>
  .note {
    font-size: 11.5px;
    color: #55534e;
    margin: 0 0 16px;
  }
  .empty {
    font-size: 13px;
    color: #55534e;
  }
  .list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 10px;
    text-align: left;
    background: var(--paper);
    border: 1px solid var(--ink);
    border-radius: 7px;
    padding: 9px 11px;
    cursor: pointer;
    font-family: var(--sans);
    box-shadow: 1px 1px 0 var(--ink);
  }
  .row.on {
    background: var(--chrome-hi);
  }
  .row:disabled {
    opacity: 0.5;
    cursor: default;
    box-shadow: none;
  }
  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 1px solid var(--ink);
    background: var(--paper);
    flex-shrink: 0;
  }
  .dot.sel {
    background: var(--ink);
  }
  .name {
    font-size: 13.5px;
    font-weight: 600;
  }
  .badge {
    margin-left: auto;
    font-size: 10px;
    text-transform: uppercase;
    color: #9c2b3f;
  }
</style>
