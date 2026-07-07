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
    font-size: 12px;
  }
  .count {
    font-size: 10px;
    opacity: 0.65;
  }
  .clear {
    margin-top: 16px;
    font-family: var(--sans);
    font-size: 12px;
    border: 1px solid var(--ink);
    border-radius: 6px;
    background: var(--paper);
    padding: 6px 12px;
    cursor: pointer;
    box-shadow: 1px 1px 0 var(--ink);
  }
</style>
