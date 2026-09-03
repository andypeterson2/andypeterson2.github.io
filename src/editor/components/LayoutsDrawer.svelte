<script lang="ts">
  import UiButton from './ui/Button.svelte';
  import { onMount } from 'svelte';
  import { editor } from '../lib/store.svelte';

  onMount(() => {
    void editor.loadLayouts();
  });
</script>

{#if !editor.connected}
  <p class="note">
    Layouts live on the server.
    <UiButton variant="link" onclick={() => editor.signIn()}>Sign in</UiButton> to choose the LaTeX template
    your PDF compiles with.
  </p>
{:else if editor.layouts.length === 0}
  <p class="note">The LaTeX template used to compile the PDF.</p>
  <p class="empty">No layouts available.</p>
{:else}
  <p class="note">The LaTeX template used to compile the PDF.</p>
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
    font-size: var(--text-4xs);
    color: var(--ink-3);
    margin: 0 0 16px;
  }

  /* .link comes from the lib/styles.css button families. */

  .empty {
    font-size: var(--text-3xs);
    color: var(--ink-3);
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
    border-radius: var(--radius);
    padding: 9px 11px;
    cursor: pointer;
    font-family: var(--sans);
    box-shadow: var(--shadow-sm);
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
    border-radius: var(--radius-round);
    border: 1px solid var(--ink);
    background: var(--paper);
    flex-shrink: 0;
  }

  .dot.sel {
    background: var(--ink);
  }

  .name {
    font-size: var(--text-3xs);
    font-weight: 600;
  }

  .badge {
    margin-left: auto;
    font-size: var(--text-4xs);
    text-transform: uppercase;
    color: var(--accent);
  }
</style>
