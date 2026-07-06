<script lang="ts">
  import { onMount } from 'svelte';
  import './lib/styles.css';
  import { editor } from './lib/store.svelte';
  import Document from './components/Document.svelte';
  import Drawer from './components/Drawer.svelte';
  import StyleDrawer from './components/StyleDrawer.svelte';
  import LayoutsDrawer from './components/LayoutsDrawer.svelte';

  const person = $derived(editor.person);
  const fullName = $derived(`${person.personal.firstName ?? ''} ${person.personal.lastName ?? ''}`.trim());

  // Auto-probe the live backend once mounted (client-only). Signed-in owner →
  // real CV; anyone else → stays on the local demo + a sign-in offer.
  onMount(() => {
    editor.connect();
  });
</script>

<div class="stage">
  <div class="menubar">
    <span class="mark">◆</span><strong>CV&nbsp;Editor</strong>
    <span class="menu">File</span><span class="menu">Edit</span><span class="menu">View</span>
    <span class="right">
      <button
        class="conn"
        onclick={() => editor.connect()}
        disabled={editor.connecting || editor.signingIn}
        title="Connect to the live backend"
      >
        <span class="dot" class:live={editor.connected} class:busy={editor.connecting || editor.signingIn}
        ></span>{editor.signingIn
          ? 'signing in…'
          : editor.connecting
            ? 'connecting…'
            : editor.connected
              ? 'connected'
              : 'demo'}
      </button>
    </span>
  </div>

  {#if editor.signingIn}
    <div class="signin">
      <span>Signing in… finish the Google login in the new tab — the editor connects automatically.</span>
    </div>
  {:else if editor.connectError === 'signin' && !editor.connected}
    <div class="signin">
      <span
        >Local demo — <button class="link" onclick={() => editor.signIn()}>Sign in with Google</button
        > to connect to the live editor.</span
      >
      <button class="dismiss" aria-label="Dismiss" onclick={() => (editor.connectError = null)}
        >×</button
      >
    </div>
  {/if}

  <div class="workspace">
    <div class="toolbar">
      <span class="field"
        >Profile
        {#if editor.persons.length > 1}
          <select
            class="popup sel"
            value={editor.activePersonId}
            onchange={(e) => editor.selectPerson(Number(e.currentTarget.value))}
          >
            {#each editor.persons as p (p.id)}<option value={p.id}>{p.name}</option>{/each}
          </select>
        {:else}
          <span class="popup">{fullName} ▾</span>
        {/if}
      </span>
      <span class="field">Variant <span class="popup">{editor.variant} ▾</span></span>
      <button
        class="btn icon"
        class:on={editor.openDrawer === 'variant'}
        title="Variant settings"
        onclick={() => (editor.openDrawer = 'variant')}>⚙</button
      >
      <span class="sp"></span>
      <button class="btn" class:on={editor.openDrawer === 'tags'} onclick={() => (editor.openDrawer = 'tags')}>Tags</button>
      <button class="btn" class:on={editor.openDrawer === 'layouts'} onclick={() => (editor.openDrawer = 'layouts')}>Layout</button>
      <button class="btn" class:on={editor.openDrawer === 'style'} onclick={() => (editor.openDrawer = 'style')}>Style</button>
      <button class="btn" class:on={editor.previewOpen} onclick={() => editor.togglePreview()}>◱ Preview</button>
    </div>

    <div class="window">
      <div class="titlebar"><span class="close"></span><span class="title">{fullName} — {editor.variant}</span><span class="fill"></span></div>
      <div class="wbody" class:split={editor.previewOpen}>
        <div class="doc-scroll"><Document /></div>
        {#if editor.previewOpen}
          <div class="preview">
            <div class="pv-bar"><span>{editor.variant}.pdf</span><span class="pv-tools">⟳ Compile · ⤓ PDF · ☰ Log</span></div>
            <div class="pv-body"><div class="pv-note">Compiled&nbsp;PDF&nbsp;preview<br /><small>wired to <code>GET /variants/:id/pdf</code> in a later increment</small></div></div>
          </div>
        {/if}
      </div>
      <div class="statusbar">
        <span
          >{editor.connected
            ? editor.saveState === 'saving'
              ? 'saving…'
              : editor.saveState === 'error'
                ? '⚠ save failed'
                : '✓ saved'
            : editor.dirty
              ? 'demo · unsaved (local)'
              : 'demo'} · {editor.variant}</span
        >
        <span class="sb-r">⌘K · ⤒ jump to</span>
      </div>
    </div>
  </div>

  {#if editor.openDrawer === 'style'}
    <Drawer title="Style"><StyleDrawer /></Drawer>
  {:else if editor.openDrawer === 'layouts'}
    <Drawer title="Layouts"><LayoutsDrawer /></Drawer>
  {:else if editor.openDrawer === 'tags'}
    <Drawer title="Tags"
      ><p class="soon">Tag management — add/remove tags on entries + the catalog — is the next drawer.</p></Drawer
    >
  {:else if editor.openDrawer === 'variant'}
    <Drawer title="Variant"
      ><p class="soon">Variants + the variant lens (dim excluded content in place) are coming next.</p></Drawer
    >
  {/if}
</div>

<style>
  .stage { min-height: 100vh; padding-bottom: 34px; }
  .soon { font-size: 13px; line-height: 1.6; color: #55534e; margin: 0; }
  .menubar { display: flex; align-items: center; gap: 20px; height: 26px; padding: 0 12px; background: var(--paper); border-bottom: 1px solid var(--ink); font-size: 13px; font-weight: 700; position: sticky; top: 0; z-index: 5; }
  .mark { font-size: 15px; }
  .menu { font-weight: 400; }
  .right { margin-left: auto; display: flex; align-items: center; gap: 14px; font-weight: 400; }
  .dot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; background: #c0392b; border: 1px solid var(--ink); vertical-align: -1px; margin-right: 5px; }
  .dot.live { background: var(--live); }
  .dot.busy { background: #d9a520; }
  .conn { font: inherit; display: inline-flex; align-items: center; background: none; border: 0; padding: 0; color: inherit; cursor: pointer; }
  .conn:disabled { cursor: default; }
  .signin { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 6px 12px; background: var(--ink); color: var(--paper); font-size: 12.5px; }
  .signin a,
  .signin .link { color: #9ec7ff; font-weight: 700; background: none; border: 0; padding: 0; font: inherit; cursor: pointer; text-decoration: underline; }
  .dismiss { background: none; border: 0; color: var(--paper); font-size: 15px; line-height: 1; cursor: pointer; padding: 0 4px; }
  .workspace { max-width: 1040px; margin: 0 auto; padding: 26px 22px 0; }
  .toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 16px; }
  .field { display: inline-flex; align-items: center; gap: 7px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #4a4944; }
  .popup { font-size: 13px; font-weight: 700; text-transform: none; letter-spacing: 0; background: var(--paper); border: 1px solid var(--ink); border-radius: 7px; padding: 4px 10px; box-shadow: var(--shadow); }
  .sel { cursor: pointer; max-width: 190px; color: var(--ink); }
  .btn { font-size: 12.5px; font-weight: 600; color: var(--ink); background: var(--paper); border: 1px solid var(--ink); border-radius: 8px; padding: 5px 12px; box-shadow: var(--shadow); cursor: pointer; }
  .btn.icon { padding: 5px 9px; font-size: 14px; }
  .btn.on { background: var(--ink); color: var(--paper); }
  .btn:active { transform: translate(1px, 1px); box-shadow: 1px 1px 0 var(--ink); }
  .sp { flex: 1; }
  .window { background: var(--paper); border: 1px solid var(--ink); box-shadow: 4px 4px 0 rgba(28, 27, 25, 0.55); }
  .titlebar { display: flex; align-items: center; gap: 8px; height: 22px; padding: 0 8px; border-bottom: 1px solid var(--ink); background-image: repeating-linear-gradient(to bottom, var(--ink) 0, var(--ink) 1px, var(--paper) 1px, var(--paper) 3px); }
  .close { width: 11px; height: 11px; background: var(--paper); border: 1px solid var(--ink); }
  .title { font-size: 12.5px; font-weight: 700; background: var(--paper); padding: 0 12px; margin: 0 auto; }
  .fill { width: 11px; }
  .wbody { display: grid; grid-template-columns: minmax(0, 1fr); }
  .wbody.split { grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); }
  .doc-scroll { max-height: min(70vh, 640px); overflow: auto; background: var(--paper); }
  .preview { display: flex; flex-direction: column; border-left: 1px solid var(--ink); background: var(--chrome); }
  .pv-bar { display: flex; justify-content: space-between; padding: 7px 12px; border-bottom: 1px solid var(--ink); background: var(--chrome-hi); font-size: 12px; font-weight: 700; }
  .pv-tools { font-family: var(--mono); font-size: 11px; font-weight: 400; }
  .pv-body { flex: 1; display: flex; align-items: center; justify-content: center; padding: 30px; }
  .pv-note { font-family: var(--mono); font-size: 12px; color: #55534e; text-align: center; line-height: 1.7; }
  .statusbar { display: flex; justify-content: space-between; border-top: 1px solid var(--ink); background: var(--chrome-hi); padding: 5px 12px; font-family: var(--mono); font-size: 11px; color: #3a3934; }
  .sb-r { color: #57554f; }
</style>
