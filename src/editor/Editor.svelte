<script lang="ts">
  import { onMount } from 'svelte';
  import './lib/styles.css';
  import { editor } from './lib/store.svelte';
  import Document from './components/Document.svelte';
  import LetterEditor from './components/LetterEditor.svelte';
  import Drawer from './components/Drawer.svelte';
  import StyleDrawer from './components/StyleDrawer.svelte';
  import LayoutsDrawer from './components/LayoutsDrawer.svelte';
  import TagsDrawer from './components/TagsDrawer.svelte';
  import VariantDrawer from './components/VariantDrawer.svelte';
  import ProfilesDrawer from './components/ProfilesDrawer.svelte';

  const person = $derived(editor.person);
  const fullName = $derived(`${person.personal.firstName ?? ''} ${person.personal.lastName ?? ''}`.trim());

  // Flips true once mounted → the stage gets `data-hydrated`, a deterministic
  // signal that event handlers are live (tests wait for it instead of racing).
  let hydrated = $state(false);

  // Demo is the default — and the only mode almost every visitor can reach, since
  // the backend is Access-gated. It is not a failure, so it isn't drawn like one.
  const demoMode = $derived(!editor.connected && !editor.connecting && !editor.signingIn);
  // The invitation strip. Dismissing collapses it to the ◇ chip, which reopens it,
  // so "Reset demo" is never more than one click away.
  let inviteOpen = $state(true);

  // Auto-probe the live backend once mounted (client-only). Signed-in owner →
  // real CV; anyone else → stays on the local demo + a sign-in offer.
  onMount(() => {
    hydrated = true;
    editor.connect();
  });
</script>

<div class="stage" data-hydrated={hydrated || undefined}>
  <div class="sr-only" aria-live="polite" aria-atomic="true">{editor.announce}</div>
  <div class="menubar">
    <span class="mark" aria-hidden="true">{demoMode ? '◇' : '◆'}</span><strong>CV&nbsp;Editor</strong>
    <span class="menu">File</span><span class="menu">Edit</span><span class="menu">View</span>
    <span class="right">
      <button
        class="conn"
        onclick={() => (demoMode ? (inviteOpen = !inviteOpen) : editor.connect())}
        disabled={editor.connecting || editor.signingIn}
        title={demoMode ? 'About demo mode' : 'Connection status'}
        aria-expanded={demoMode ? inviteOpen : undefined}
        aria-controls={demoMode ? 'demo-invite' : undefined}
      >
        <span
          class="dot"
          class:live={editor.connected}
          class:busy={editor.connecting || editor.signingIn}
          aria-hidden="true"
        ></span>{editor.signingIn
          ? 'signing in…'
          : editor.connecting
            ? 'connecting…'
            : editor.connected
              ? 'connected'
              : 'Demo — nothing saved'}
      </button>
    </span>
  </div>

  {#if editor.signingIn}
    <div class="invite busy" role="status">
      <span class="mk" aria-hidden="true">◆</span>
      <span class="txt"
        >Signing in… finish the Google login in the new tab — the editor connects automatically.</span
      >
    </div>
  {:else if demoMode && inviteOpen}
    <div class="invite" id="demo-invite" role="status">
      <span class="mk" aria-hidden="true">◇</span>
      <span class="txt"
        >This is the real editor, running live in your browser. Edit anything — drag, tag, compile a
        PDF. <b>Nothing is saved.</b></span
      >
      <button class="btn reset" onclick={() => editor.resetDemo()}>↺ Reset demo</button>
      {#if editor.connectError === 'offline'}
        <button class="link" onclick={() => editor.connect()}>Retry</button>
      {:else}
        <button class="link" onclick={() => editor.signIn()}>Sign in with Google</button>
      {/if}
      <button class="x" aria-label="Dismiss" onclick={() => (inviteOpen = false)}>✕</button>
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
      <button class="btn" class:on={editor.preview.open} onclick={() => editor.preview.toggle()}>◱ Preview</button>
      <button
        class="btn"
        title="Export this résumé as JSON"
        disabled={editor.noProfiles}
        onclick={() => editor.exportJson()}>⤓ Export</button
      >
    </div>

    <div class="window">
      <div class="titlebar"><span class="close"></span><span class="title">{fullName || editor.profileLabel} — {editor.variantLabel}</span><span class="fill"></span></div>
      <div class="wbody" class:split={editor.preview.open}>
        <div class="doc-scroll">
          {#if editor.noProfiles}
            <div class="no-profiles">
              <p class="np-title">No profiles yet</p>
              <p class="np-sub">Create your first résumé profile to start editing.</p>
              <button class="np-btn" onclick={() => editor.addPerson()}
                >＋ Create your first profile</button
              >
            </div>
          {:else if editor.letterMode}
            <LetterEditor />
          {:else}
            <Document />
          {/if}
        </div>
        {#if editor.preview.open}
          <div class="preview">
            <div class="pv-bar">
              <span>{editor.variantLabel}.pdf</span>
              <span class="pv-tools">
                <button
                  class="pv-btn"
                  disabled={!editor.preview.compilable || editor.preview.state === 'compiling'}
                  onclick={() => editor.preview.compile()}
                  >⟳ {editor.preview.state === 'ready' ? 'Recompile' : 'Compile'}</button
                >
                {#if editor.preview.url}
                  <a class="pv-btn" href={editor.preview.url} download={`${editor.variantLabel}.pdf`}
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
                    >Main is the editing view — variants are the deliverables.</small
                  >
                </div>
              {:else if editor.preview.state === 'compiling'}
                <div class="pv-note">
                  Compiling {editor.variantLabel}…<br /><small>running xelatex — a few seconds</small>
                </div>
              {:else if editor.preview.state === 'error'}
                <div class="pv-log"><pre>{editor.preview.log}</pre></div>
              {:else if editor.preview.url}
                <iframe class="pv-frame" title="Compiled PDF preview" src={editor.preview.url}></iframe>
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
            : 'demo · nothing saved'} · {editor.variantLabel}</span
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

  {#if editor.saveError}
    <div class="save-toast" role="alert" aria-live="assertive">
      <span class="st-icon" aria-hidden="true">⚠</span>
      <span class="st-msg">{editor.saveError}</span>
      {#if editor.canRetry}
        <button class="st-btn st-retry" onclick={() => editor.retrySave()}>Retry</button>
      {/if}
      <button class="st-btn st-x" aria-label="Dismiss save error" onclick={() => editor.dismissError()}
        >✕</button
      >
    </div>
  {/if}
</div>

<style>
  .stage { min-height: 100vh; padding-bottom: 34px; }
  .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
  .menubar { display: flex; align-items: center; gap: 20px; height: 26px; padding: 0 12px; background: var(--paper); border-bottom: 1px solid var(--ink); font-size: 13px; font-weight: 700; position: sticky; top: 0; z-index: 5; }
  .mark { font-size: 15px; }
  .menu { font-weight: 400; }
  .right { margin-left: auto; display: flex; align-items: center; gap: 14px; font-weight: 400; }
  /* Hollow = unset = nothing is being written. The System-6 idiom, and the reason
     demo no longer borrows the colour we reserve for real errors. */
  .dot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; background: var(--paper); border: 1px solid var(--ink); vertical-align: -1px; margin-right: 5px; }
  .dot.live { background: var(--state-live); }
  .dot.busy { background: var(--state-busy); }
  .conn { font: inherit; display: inline-flex; align-items: center; background: none; border: 0; padding: 0; color: inherit; cursor: pointer; }
  .conn:disabled { cursor: default; }

  /* The demo invitation — chrome, never an alarm. Replaces the inverted-ink
     sign-in bar, which advertised a dead end to everyone but the owner. */
  .invite { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 8px 12px; background: var(--chrome-hi); color: var(--ink); border-bottom: 1px solid var(--ink); font-size: 12.5px; line-height: 1.4; }
  /* pin the glyph to the first line so it doesn't float when the copy wraps */
  .invite .mk { font-size: 14px; flex: none; align-self: flex-start; line-height: 1.4; }
  .invite .txt { flex: 1 1 260px; min-width: 0; }
  .invite .txt b { font-weight: 700; }
  .invite .btn { font-size: 12px; padding: 4px 10px; }
  .invite .link { background: none; border: 0; padding: 0; font: inherit; color: #45433d; text-decoration: underline; cursor: pointer; white-space: nowrap; }
  .invite .link:hover { color: var(--ink); }
  .invite .x { background: none; border: 1px solid transparent; border-radius: 5px; color: var(--dim); font-family: var(--mono); font-size: 12px; line-height: 1; padding: 3px 6px; cursor: pointer; flex: none; }
  .invite .x:hover { color: var(--ink); border-color: var(--ink); }
  .invite.busy { color: #45433d; }
  .workspace { max-width: 1320px; margin: 0 auto; padding: 18px 22px 0; }
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
  .btn:disabled { opacity: 0.4; cursor: default; box-shadow: none; }
  .sp { flex: 1; }
  .window { background: var(--paper); border: 1px solid var(--ink); box-shadow: 4px 4px 0 rgba(28, 27, 25, 0.55); }
  .titlebar { display: flex; align-items: center; gap: 8px; height: 22px; padding: 0 8px; border-bottom: 1px solid var(--ink); background-image: repeating-linear-gradient(to bottom, var(--ink) 0, var(--ink) 1px, var(--paper) 1px, var(--paper) 3px); }
  .close { width: 11px; height: 11px; background: var(--paper); border: 1px solid var(--ink); }
  .title { font-size: 12.5px; font-weight: 700; background: var(--paper); padding: 0 12px; margin: 0 auto; }
  .fill { width: 11px; }
  .wbody { display: grid; grid-template-columns: minmax(0, 1fr); }
  .wbody.split { grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); }
  .doc-scroll { max-height: min(82vh, 960px); overflow: auto; background: var(--paper); }
  .no-profiles { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; min-height: min(60vh, 520px); padding: 40px 24px; text-align: center; }
  .np-title { font-family: var(--serif); font-size: 22px; font-weight: 700; color: #3a3934; margin: 0; }
  .np-sub { font-size: 13.5px; color: #55534e; margin: 0 0 10px; }
  .np-btn { font-family: var(--sans); font-size: 13px; font-weight: 600; color: var(--ink); background: var(--paper); border: 1px solid var(--ink); border-radius: 8px; padding: 8px 16px; cursor: pointer; box-shadow: var(--shadow); }
  .np-btn:active { transform: translate(1px, 1px); box-shadow: 1px 1px 0 var(--ink); }
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

  /* Save-error toast — a System-6 alert box that floats above the statusbar. */
  .save-toast { position: fixed; bottom: 46px; left: 50%; transform: translateX(-50%); z-index: 100; display: flex; align-items: center; gap: 10px; max-width: min(92vw, 460px); padding: 8px 10px 8px 12px; background: var(--paper); border: 1px solid var(--ink); box-shadow: 3px 3px 0 rgba(0, 0, 0, 0.35); font-family: var(--mono); font-size: 12px; color: var(--ink); }
  .save-toast .st-icon { color: var(--state-error); font-size: 14px; line-height: 1; }
  .save-toast .st-msg { flex: 1; line-height: 1.35; }
  .save-toast .st-btn { font-family: var(--mono); font-size: 12px; border: 1px solid var(--ink); background: var(--chrome-hi); padding: 2px 8px; cursor: pointer; }
  .save-toast .st-btn:hover { background: var(--ink); color: var(--paper); }
  .save-toast .st-x { padding: 2px 6px; }
  @media (prefers-reduced-motion: no-preference) {
    .save-toast { animation: toast-in 160ms ease-out; }
    @keyframes toast-in { from { opacity: 0; transform: translate(-50%, 8px); } to { opacity: 1; transform: translate(-50%, 0); } }
  }
</style>
