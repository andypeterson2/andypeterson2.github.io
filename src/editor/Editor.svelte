<script lang="ts">
  import { onMount } from 'svelte';
  import './lib/styles.css';
  import { editor } from './lib/store.svelte';
  import Document from './components/Document.svelte';
  import Drawer from './components/Drawer.svelte';
  import StyleDrawer from './components/StyleDrawer.svelte';
  import LayoutsDrawer from './components/LayoutsDrawer.svelte';
  import TagsDrawer from './components/TagsDrawer.svelte';
  import VariantDrawer from './components/VariantDrawer.svelte';
  import ProfilesDrawer from './components/ProfilesDrawer.svelte';

  const person = $derived(editor.person);
  const fullName = $derived(`${person.personal.firstName ?? ''} ${person.personal.lastName ?? ''}`.trim());

  // Auto-probe the live backend once mounted (client-only). Signed-in owner →
  // real CV; anyone else → stays on the local demo + a sign-in offer.
  onMount(() => {
    editor.connect();
  });
</script>

<div class="stage">
  <div class="sr-only" aria-live="polite" aria-atomic="true">{editor.announce}</div>
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
        <button
          class="popup profile-btn"
          title="Profiles"
          onclick={() => (editor.openDrawer = 'profiles')}>{editor.profileLabel} ▾</button
        ></span
      >
      <span class="field"
        >Variant
        <button
          class="popup variant-btn"
          class:lens={editor.activeVariantId !== null}
          title="Variants + the lens"
          onclick={() => (editor.openDrawer = 'variant')}>{editor.variantLabel} ▾</button
        ></span
      >
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
      <div class="titlebar"><span class="close"></span><span class="title">{fullName || editor.profileLabel} — {editor.variantLabel}</span><span class="fill"></span></div>
      <div class="wbody" class:split={editor.previewOpen}>
        <div class="doc-scroll"><Document /></div>
        {#if editor.previewOpen}
          <div class="preview">
            <div class="pv-bar">
              <span>{editor.variantLabel}.pdf</span>
              <span class="pv-tools">
                <button
                  class="pv-btn"
                  disabled={!editor.previewCompilable || editor.previewState === 'compiling'}
                  onclick={() => editor.compilePreview()}
                  >⟳ {editor.previewState === 'ready' ? 'Recompile' : 'Compile'}</button
                >
                {#if editor.previewUrl}
                  <a class="pv-btn" href={editor.previewUrl} download={`${editor.variantLabel}.pdf`}
                    >⤓ PDF</a
                  >
                {/if}
              </span>
            </div>
            <div class="pv-body">
              {#if !editor.connected}
                <div class="pv-note">Sign in and connect to compile a live PDF.</div>
              {:else if !editor.activeVariant}
                <div class="pv-note">
                  Pick a <button class="pv-link" onclick={() => (editor.openDrawer = 'variant')}
                    >variant</button
                  > to compile its PDF.<br /><small
                    >Master is the editing view — variants are the deliverables.</small
                  >
                </div>
              {:else if editor.previewState === 'compiling'}
                <div class="pv-note">
                  Compiling {editor.variantLabel}…<br /><small>running xelatex — a few seconds</small>
                </div>
              {:else if editor.previewState === 'error'}
                <div class="pv-log"><pre>{editor.previewLog}</pre></div>
              {:else if editor.previewUrl}
                <iframe class="pv-frame" title="Compiled PDF preview" src={editor.previewUrl}></iframe>
              {:else}
                <div class="pv-note">Compile to preview {editor.variantLabel}.</div>
              {/if}
            </div>
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
              : 'demo'} · {editor.variantLabel}</span
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
    <Drawer title="Tags"><TagsDrawer /></Drawer>
  {:else if editor.openDrawer === 'variant'}
    <Drawer title="Variants"><VariantDrawer /></Drawer>
  {:else if editor.openDrawer === 'profiles'}
    <Drawer title="Profiles"><ProfilesDrawer /></Drawer>
  {/if}
</div>

<style>
  .stage { min-height: 100vh; padding-bottom: 34px; }
  .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
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
  button.popup { font-family: var(--sans); color: var(--ink); cursor: pointer; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  button.popup:active { transform: translate(1px, 1px); box-shadow: 1px 1px 0 var(--ink); }
  .popup.lens { background: var(--ink); color: var(--paper); }
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
  .pv-bar { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 6px 12px; border-bottom: 1px solid var(--ink); background: var(--chrome-hi); font-size: 12px; font-weight: 700; }
  .pv-tools { display: flex; align-items: center; gap: 6px; font-family: var(--mono); font-size: 11px; font-weight: 400; }
  .pv-btn { font-family: var(--sans); font-size: 11.5px; font-weight: 600; color: var(--ink); background: var(--paper); border: 1px solid var(--ink); border-radius: 6px; padding: 3px 9px; cursor: pointer; text-decoration: none; box-shadow: 1px 1px 0 var(--ink); }
  .pv-btn:active { transform: translate(1px, 1px); box-shadow: none; }
  .pv-btn:disabled { opacity: 0.4; cursor: default; box-shadow: none; }
  .pv-body { flex: 1; display: flex; min-height: 0; background: var(--chrome); }
  .pv-note { margin: auto; padding: 30px; font-family: var(--mono); font-size: 12px; color: #55534e; text-align: center; line-height: 1.7; }
  .pv-link { font: inherit; color: #2b6cb0; background: none; border: 0; padding: 0; cursor: pointer; text-decoration: underline; }
  .pv-frame { flex: 1; width: 100%; border: 0; background: #fff; }
  .pv-log { flex: 1; overflow: auto; background: #1c1b19; }
  .pv-log pre { margin: 0; padding: 14px; font-family: var(--mono); font-size: 11px; line-height: 1.5; color: #e8e6df; white-space: pre-wrap; word-break: break-word; }
  .statusbar { display: flex; justify-content: space-between; border-top: 1px solid var(--ink); background: var(--chrome-hi); padding: 5px 12px; font-family: var(--mono); font-size: 11px; color: #3a3934; }
  .sb-r { color: #57554f; }
</style>
