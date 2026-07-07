<script lang="ts">
  import { editor } from '../lib/store.svelte';
  import type { PersonMeta } from '../lib/api';

  const activeMeta = $derived(
    editor.persons.find((p) => p.id === editor.activePersonId) ?? null,
  );

  function confirmDelete(p: PersonMeta) {
    if (
      window.confirm(`Delete the profile "${p.name}" and everything in it? This cannot be undone.`)
    ) {
      void editor.deletePerson(p.id);
    }
  }
</script>

{#if !editor.connected}
  <p class="note">
    Profiles live on the server. <button class="link" onclick={() => editor.signIn()}>Sign in</button
    > to create, switch, and manage them.
  </p>
{:else}
  <p class="note">
    Each profile is a separate résumé — its own sections, variants, and personal info. The name here
    is just its label in this switcher; the name on the CV is set in the document header.
  </p>

  <div class="picker">
    {#each editor.persons as p (p.id)}
      <button
        class="opt"
        class:on={editor.activePersonId === p.id}
        onclick={() => editor.selectPerson(p.id)}
      >
        <span class="radio"></span>
        <span class="opt-name">{p.name}</span>
      </button>
    {/each}
  </div>

  <button class="new" onclick={() => editor.addPerson()}>＋ New profile</button>

  {#if activeMeta}
    {@const meta = activeMeta}
    <div class="edit">
      <label class="rename">
        <span class="rlbl">Name</span>
        <input
          class="in"
          value={meta.name}
          onchange={(e) => editor.renamePerson(meta.id, e.currentTarget.value)}
        />
      </label>
      <button class="del" onclick={() => confirmDelete(meta)}>Delete profile</button>
    </div>
  {/if}
{/if}

<style>
  .note {
    font-size: 11.5px;
    line-height: 1.55;
    color: #55534e;
    margin: 0 0 16px;
  }
  .link {
    font: inherit;
    color: #2b6cb0;
    background: none;
    border: 0;
    padding: 0;
    cursor: pointer;
    text-decoration: underline;
  }
  .picker {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .opt {
    display: flex;
    align-items: center;
    gap: 9px;
    width: 100%;
    text-align: left;
    background: var(--paper);
    border: 1px solid var(--ink);
    border-radius: 8px;
    padding: 8px 11px;
    cursor: pointer;
    box-shadow: 1px 1px 0 var(--ink);
    font-family: var(--sans);
  }
  .opt.on {
    background: var(--ink);
    color: var(--paper);
  }
  .opt:active {
    transform: translate(1px, 1px);
    box-shadow: none;
  }
  .radio {
    width: 11px;
    height: 11px;
    border-radius: 50%;
    border: 1.5px solid currentColor;
    flex: none;
  }
  .opt.on .radio {
    border-color: var(--paper);
    box-shadow: inset 0 0 0 2px var(--ink);
  }
  .opt-name {
    font-size: 13px;
    font-weight: 700;
  }
  .new {
    margin-top: 10px;
    width: 100%;
    font-family: var(--sans);
    font-size: 12.5px;
    color: #55534e;
    background: none;
    border: 1px dashed var(--dim);
    border-radius: 6px;
    padding: 7px 12px;
    cursor: pointer;
  }
  .edit {
    margin-top: 18px;
    padding-top: 16px;
    border-top: 1px solid #d9d7cf;
    display: flex;
    flex-direction: column;
    gap: 13px;
  }
  .rename {
    display: grid;
    grid-template-columns: 62px 1fr;
    align-items: center;
    gap: 10px;
  }
  .rlbl {
    font-size: 10.5px;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: #4a4944;
  }
  .in {
    font-family: var(--sans);
    font-size: 15px;
    color: var(--ink);
    background: var(--chrome-hi);
    border: 1px solid var(--ink);
    border-radius: 6px;
    padding: 6px 9px;
    width: 100%;
  }
  .del {
    align-self: flex-start;
    font-family: var(--sans);
    font-size: 12px;
    color: #9c2b3f;
    background: var(--paper);
    border: 1px solid #9c2b3f;
    border-radius: 6px;
    padding: 5px 12px;
    cursor: pointer;
    box-shadow: 1px 1px 0 #9c2b3f;
  }
  .del:active {
    transform: translate(1px, 1px);
    box-shadow: none;
  }
</style>
