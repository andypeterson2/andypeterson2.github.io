<script lang="ts">
  import { editor } from '../lib/store.svelte';
  import UiButton from './ui/Button.svelte';
  import type { PersonMeta } from '../lib/api';

  const activeMeta = $derived(editor.persons.find((p) => p.id === editor.activePersonId) ?? null);

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
    Profiles live on the server. <UiButton variant="link" onclick={() => editor.signIn()}
      >Sign in</UiButton
    > to create, switch, and manage them.
  </p>
{:else}
  <p class="note">
    Each profile is a separate resume — its own sections, variants, and personal info. The name here
    is just its label in this switcher; the name on the CV is set in the document header.
  </p>

  <div class="picker">
    {#each editor.persons as p (p.id)}
      <UiButton
        variant="opt"
        active={editor.activePersonId === p.id}
        onclick={() => editor.selectPerson(p.id)}
      >
        <span class="radio"></span>
        <span class="opt-name">{p.name}</span>
      </UiButton>
    {/each}
  </div>

  <UiButton variant="new" class="new-profile" onclick={() => editor.addPerson()}
    >＋ New profile</UiButton
  >

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
      <UiButton variant="del" onclick={() => confirmDelete(meta)}>Delete profile</UiButton>
    </div>
  {/if}
{/if}

<style>
  .note {
    font-size: var(--text-4xs);
    line-height: 1.55;
    color: var(--ink-3);
    margin: 0 0 16px;
  }

  /* .link / .opt / .new / .del come from the lib/styles.css button families. */

  .picker {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .radio {
    width: 11px;
    height: 11px;
    border-radius: var(--radius-round);
    border: 1.5px solid currentcolor;
    flex: none;
  }

  :global(.ui.opt.on) .radio {
    border-color: var(--paper);
    box-shadow: var(--shadow-ring);
  }

  .opt-name {
    font-size: var(--text-3xs);
    font-weight: 700;
  }

  .picker ~ :global(.ui.new.new-profile) {
    margin-top: 10px;
  }

  .edit {
    margin-top: 18px;
    padding-top: 16px;
    border-top: 1px solid var(--paper-4);
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
    font-size: var(--text-4xs);
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--ink-2);
  }

  .in {
    font-family: var(--sans);
    font-size: var(--text-2xs);
    color: var(--ink);
    background: var(--chrome-hi);
    border: 1px solid var(--ink);
    border-radius: var(--radius);
    padding: 6px 9px;
    width: 100%;
  }
</style>
