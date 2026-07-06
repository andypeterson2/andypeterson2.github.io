<script lang="ts">
  // Editable tag chips: #tag ✕ pills + an inline input (Enter/comma adds,
  // Backspace on an empty input removes the last).
  let {
    tags,
    onAdd,
    onRemove,
  }: { tags: string[]; onAdd: (t: string) => void; onRemove: (t: string) => void } = $props();

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
    font-size: 11px;
    color: #3a3934;
    background: var(--chrome-hi);
    border: 1px solid #cfcec6;
    border-radius: 10px;
    padding: 1px 3px 1px 7px;
  }
  .cx {
    background: none;
    border: 0;
    color: var(--dim);
    cursor: pointer;
    font-size: 13px;
    line-height: 1;
    padding: 0 1px;
  }
  .cx:hover {
    color: #9c2b3f;
  }
  .tag-in {
    font-family: var(--mono);
    font-size: 11.5px;
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
