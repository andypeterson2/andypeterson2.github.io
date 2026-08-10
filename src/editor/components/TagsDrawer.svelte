<script lang="ts">
  import { editor } from '../lib/store.svelte';

  function toggle(tag: string) {
    editor.tags.highlight = editor.tags.highlight === tag ? null : tag;
  }
</script>

<p class="note">Tags on entries and bullets. Click one to spotlight where it's used.</p>

{#if editor.tags.vocab.length === 0}
  <p class="empty">No tags yet — add them on entries and bullets while editing.</p>
{:else}
  <div class="list">
    {#each editor.tags.vocab as { tag, count } (tag)}
      <button class="row" class:on={editor.tags.highlight === tag} onclick={() => toggle(tag)}>
        <span class="tag">#{tag}</span>
        <span class="count">{count}</span>
      </button>
    {/each}
  </div>
  {#if editor.tags.highlight}
    <button class="clear" onclick={() => (editor.tags.highlight = null)}>Clear spotlight</button>
  {/if}
{/if}

<style>
  .note {
    font-size: var(--text-4xs);
    color: var(--ink-3);
    margin: 0 0 16px;
  }
  .empty {
    font-size: var(--text-3xs);
    color: var(--ink-3);
  }
  .list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .row {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: var(--paper);
    border: 1px solid var(--ink);
    border-radius: 12px;
    padding: 4px 10px;
    cursor: pointer;
    font-family: var(--mono);
    box-shadow: 1px 1px 0 var(--ink);
  }
  .row.on {
    background: var(--ink);
    color: var(--paper);
  }
  .row:active {
    transform: translate(1px, 1px);
    box-shadow: none;
  }
  .tag {
    font-size: var(--text-3xs);
  }
  .count {
    font-size: var(--text-4xs);
    opacity: 0.65;
  }
  .clear {
    margin-top: 16px;
    font-family: var(--sans);
    font-size: var(--text-3xs);
    border: 1px solid var(--ink);
    border-radius: 6px;
    background: var(--paper);
    padding: 6px 12px;
    cursor: pointer;
    box-shadow: 1px 1px 0 var(--ink);
  }
</style>
