<script lang="ts">
  // Editable tag chips: #tag ✕ pills + an inline input (Enter/comma adds,
  // Backspace on an empty input removes the last), then any suggested tags as
  // ghost chips: click one to add it, or its ✕ to dismiss it.
  let {
    tags,
    onAdd,
    onRemove,
    suggestions = [],
    onAccept,
    onDismiss,
  }: {
    tags: string[];
    onAdd: (t: string) => void;
    onRemove: (t: string) => void;
    suggestions?: { tag: string }[];
    onAccept?: (t: string) => void;
    onDismiss?: (t: string) => void;
  } = $props();

  let input = $state('');

  function commit() {
    const t = input.trim().replace(/^#/, '');
    if (t) {
      onAdd(t);
      input = '';
    }
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Backspace' && !input && tags.length) {
      onRemove(tags[tags.length - 1]);
    }
  }
</script>

<div class="chips">
  {#each tags as t (t)}
    <span class="chip"
      >#{t}<button class="cx" type="button" aria-label={`Remove ${t}`} onclick={() => onRemove(t)}
        >×</button
      ></span
    >
  {/each}
  <input class="tag-in" placeholder="+ tag" bind:value={input} onkeydown={onKey} onblur={commit} />
  {#each suggestions as s (s.tag)}
    <span class="sug"
      ><button
        class="sug-add"
        type="button"
        title="Suggested tag: click to add"
        aria-label={`Add suggested tag ${s.tag}`}
        onclick={() => onAccept?.(s.tag)}>+#{s.tag}</button
      ><button
        class="cx"
        type="button"
        aria-label={`Dismiss suggestion ${s.tag}`}
        onclick={() => onDismiss?.(s.tag)}>×</button
      ></span
    >
  {/each}
</div>

<style>
  .chips {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 5px;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    font-family: var(--mono);
    font-size: var(--text-4xs);
    color: var(--ink-2);
    background: var(--chrome-hi);
    border: 1px solid var(--paper-4);
    border-radius: var(--radius-lg);
    padding: 1px 3px 1px 7px;
  }

  .cx {
    background: none;
    border: 0;
    color: var(--dim-text);
    cursor: pointer;
    font-size: var(--text-3xs);
    line-height: 1;
    padding: 0 1px;
  }

  .cx:hover {
    color: var(--accent);
  }

  .sug {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    border: 1px dashed var(--paper-4);
    border-radius: var(--radius-lg);
    padding: 1px 3px 1px 5px;
  }

  .sug-add {
    font-family: var(--mono);
    font-size: var(--text-4xs);
    color: var(--dim-text);
    background: none;
    border: 0;
    cursor: pointer;
    padding: 0;
  }

  .sug-add:hover,
  .sug-add:focus-visible {
    color: var(--ink);
  }

  .tag-in {
    font-family: var(--mono);
    font-size: var(--text-4xs);
    color: var(--ink);
    background: none;
    border: 0;
    border-bottom: 1px dashed transparent;
    padding: 2px;
    min-width: 56px;
    flex: 1;
    outline: none;
  }

  .tag-in:focus {
    border-bottom-color: var(--dim);
  }
</style>
