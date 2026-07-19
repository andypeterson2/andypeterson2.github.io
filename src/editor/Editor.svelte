<script lang="ts">
  import { onMount } from 'svelte';
  import './lib/styles.css';
  import { editor } from './lib/store.svelte';
  import { tour } from './lib/tour.svelte';
  import { tourIntent } from './lib/tour';
  import Tour from './components/Tour.svelte';
  import MenuBar from './components/MenuBar.svelte';
  import type { MenuDef } from './lib/menus';
  import type { Personal } from './lib/types';
  import Document from './components/Document.svelte';
  import LetterEditor from './components/LetterEditor.svelte';
  import Drawer from './components/Drawer.svelte';
  import StyleDrawer from './components/StyleDrawer.svelte';
  import LayoutsDrawer from './components/LayoutsDrawer.svelte';
  import TagsDrawer from './components/TagsDrawer.svelte';
  import VariantDrawer from './components/VariantDrawer.svelte';
  import ProfilesDrawer from './components/ProfilesDrawer.svelte';
  import HistoryDrawer from './components/HistoryDrawer.svelte';

  // The owner's identity (name + public contacts) resolved from siteConfig on the
  // server and handed down by the Astro page. Overlaid onto the demo person so a
  // visitor sees the real CV, while committed source stays free of PII (the demo
  // seed carries none — see demo.ts). Applied synchronously so the first paint is
  // already the owner, not blank fields.
  let { identity }: { identity?: Partial<Personal> } = $props();
  if (identity) editor.hydrateDemoIdentity(identity);

  const person = $derived(editor.person);
  const fullName = $derived(`${person.personal.firstName ?? ''} ${person.personal.lastName ?? ''}`.trim());

  // Flips true once mounted → the stage gets `data-hydrated`, a deterministic
  // signal that event handlers are live (tests wait for it instead of racing).
  let hydrated = $state(false);

  // Demo is the default — and the only mode almost every visitor can reach, since
  // the backend is Access-gated. It is not a failure, so it isn't drawn like one.
  const demoMode = $derived(!editor.connected && !editor.connecting && !editor.signingIn);
  // The invite (with the guided tour) appears once, on load. Dismissing it is final —
  // the status bar is a sign-in button, not a way to bring it back.
  let inviteOpen = $state(true);

  // Starting the tour dismisses the invitation first: on mobile the invite is a
  // popup window that would otherwise sit over the narrator, and on desktop the
  // strip has served its purpose. The status chip reopens the invite afterwards.
  function startTour() {
    inviteOpen = false;
    tour.start();
  }

  /** Open a drawer from the menu (they are mutually exclusive — one at a time). */
  const drawerItem = (label: string, drawer: NonNullable<typeof editor.openDrawer>) => ({
    label: `${label}…`, // the ellipsis convention: this opens a panel
    onSelect: () => (editor.openDrawer = drawer),
  });

  // Reset demo lives here, where a System-6 user looks for Revert — not on a strip
  // they can dismiss. View mirrors the toolbar: the preview pane (a toggle, so it
  // carries a ✓) and the panels. Edit still has no commands, so it renders disabled
  // rather than as live-looking text that does nothing.
  const menus: MenuDef[] = $derived([
    {
      title: 'File',
      items: [
        {
          label: '⤓ Export as JSON…',
          disabled: editor.noProfiles,
          onSelect: () => void editor.exportJson(),
        },
        {
          label: '↺ Reset demo',
          separatorBefore: true,
          // A no-op when connected: there is real data to protect (store.resetDemo).
          disabled: editor.connected,
          onSelect: () => editor.resetDemo(),
        },
      ],
    },
    {
      title: 'Edit',
      items: [
        {
          // The label names what will be undone, so the command is never a surprise.
          label: editor.undo.canUndo ? `↶ Undo ${editor.undo.undoLabel}` : '↶ Undo',
          disabled: !editor.undo.canUndo,
          accel: '⌘Z',
          keys: 'Meta+Z Control+Z',
          onSelect: () => void editor.undo.undo(),
        },
        {
          label: editor.undo.canRedo ? `↷ Redo ${editor.undo.redoLabel}` : '↷ Redo',
          disabled: !editor.undo.canRedo,
          accel: '⇧⌘Z',
          keys: 'Meta+Shift+Z Control+Shift+Z',
          onSelect: () => void editor.undo.redo(),
        },
      ],
    },
    {
      title: 'View',
      items: [
        {
          label: '◱ Preview',
          checked: editor.preview.open,
          onSelect: () => editor.preview.toggle(),
        },
        { ...drawerItem('Variants', 'variant'), separatorBefore: true },
        drawerItem('Tags', 'tags'),
        drawerItem('Layout', 'layouts'),
        drawerItem('Style', 'style'),
        { ...drawerItem('History', 'history'), separatorBefore: true },
        { ...drawerItem('Profiles', 'profiles'), separatorBefore: true },
      ],
    },
    {
      // The demo's invite strip carries the tour, but that strip is gone once you
      // sign in — so a signed-in owner reaches it here (it drives their own CV,
      // sandboxed: nothing is saved). Demo visitors can use either entry point.
      title: 'Help',
      items: [
        {
          label: '▶ Guided tour',
          disabled: tour.state !== 'idle',
          onSelect: () => startTour(),
        },
      ],
    },
  ]);

  // Auto-probe the live backend once mounted (client-only). Signed-in owner →
  // real CV; anyone else → stays on the local demo + a sign-in offer.
  // `?tour=1` lets a forwarded link open straight into the narrative — the only
  // way the tour ever autoplays. It runs once we know which mode we're in: the
  // demo for a visitor, or the owner's own CV (sandboxed) for a signed-in owner.
  onMount(() => {
    hydrated = true;
    void editor.connect().then(() => {
      if (new URLSearchParams(location.search).get('tour') === '1') startTour();
    });
  });

  // A tour is staged for the mode it began in (demo vs. the owner's live CV). If
  // the session flips mid-tour — a sign-in popup lands while a demo tour plays —
  // the document changes under it, so end rather than drive stale steps against it.
  $effect(() => {
    if (tour.state !== 'idle' && editor.connected !== tour.liveAtStart) tour.end();
  });

  const inTourChrome = (t: EventTarget | null) => t instanceof Element && !!t.closest('[data-tour]');
  const isEditable = (t: EventTarget | null) =>
    t instanceof HTMLElement && (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName));

  /**
   * ⌘Z / ⇧⌘Z — but never inside a text field. There the browser's own undo is
   * better (it moves the caret with the text), and it still persists: the `input`
   * event it fires routes through saveEntry, which records it like any other edit.
   */
  function onGlobalKey(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !isEditable(e.target)) {
      e.preventDefault();
      if (tour.active) tour.takeover(); // a keystroke means the visitor is driving
      void (e.shiftKey ? editor.undo.redo() : editor.undo.undo());
      return;
    }
    onTourKey(e);
  }

  /** Esc ends, Space pauses/resumes, anything else means the visitor is driving. */
  function onTourKey(e: KeyboardEvent) {
    if (!tour.active) return;
    const intent = tourIntent({
      type: 'keydown',
      key: e.key,
      insideTour: inTourChrome(e.target),
      editable: isEditable(e.target),
    });
    if (intent === 'ignore') return;
    if (intent === 'end') tour.end();
    else if (intent === 'toggle') {
      e.preventDefault(); // Space would otherwise scroll the document out from under them
      tour.toggle();
    } else tour.takeover();
  }
  /** A click or a scroll anywhere but the tour's own chrome hands back the wheel. */
  function onTourPointer(e: Event) {
    if (tour.active && !inTourChrome(e.target)) tour.takeover();
  }
</script>

<svelte:window onkeydown={onGlobalKey} onpointerdown={onTourPointer} onwheel={onTourPointer} />

<div class="stage" data-hydrated={hydrated || undefined}>
  <div class="sr-only" aria-live="polite" aria-atomic="true">{editor.announce}</div>
  <div class="menubar">
    <span class="mark" aria-hidden="true">{demoMode ? '◇' : '◆'}</span><strong>CV&nbsp;Editor</strong>
    <MenuBar {menus} />
    <span class="right">
      <button
        class="conn"
        class:cta={demoMode}
        onclick={() => (demoMode ? editor.signIn() : editor.connect())}
        disabled={editor.connecting || editor.signingIn}
        title={demoMode ? 'Sign in with Google to save changes' : 'Connection status'}
      >
        <span
          class="dot"
          class:live={editor.connected}
          class:busy={editor.connecting || editor.signingIn}
          aria-hidden="true"
        ></span><span class="conn-label">{editor.signingIn
          ? 'signing in…'
          : editor.connecting
            ? 'connecting…'
            : editor.connected
              ? 'connected'
              : 'Sign in with Google to save changes'}</span>
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
    <!-- On phones this whole block presents as a centered pop-up window: the scrim
         and the System-6 titlebar below are shown only there. On desktop it stays
         the inline invitation strip and both are display:none. -->
    <button class="invite-scrim" aria-label="Dismiss" onclick={() => (inviteOpen = false)}></button>
    <div class="invite" id="demo-invite" role="status">
      <div class="invite-tbar">
        <button
          class="invite-close"
          aria-label="Dismiss"
          onclick={() => (inviteOpen = false)}
        ></button>
        <span class="invite-ttl">CV Editor</span>
        <span class="invite-fill"></span>
      </div>
      <span class="txt"
        >This is the real editor, running live in your browser. Edit anything — drag, tag, switch
        variants, export. <b>Nothing is saved until you sign in.</b></span
      >
      <button
        class="btn tour-start"
        disabled={tour.state !== 'idle'}
        title="Watch the editor drive itself — touch anything to take over"
        onclick={startTour}>▶ Guided tour</button
      >
      {#if editor.connectError === 'offline'}
        <button class="link" onclick={() => editor.connect()}>Retry</button>
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
          data-tour-spot="variants"
          onclick={() => (editor.openDrawer = 'variant')}>{editor.variantLabel} ▾</button
        ></span
      >
      <button
        class="btn icon settings-btn"
        class:on={editor.openDrawer === 'variant'}
        title="Variant settings"
        onclick={() => (editor.openDrawer = 'variant')}>⚙</button
      >
      <span class="sp"></span>
      <!-- The panel/action buttons. `display:contents` on desktop keeps them flat in
           the toolbar flow (the .sp above pushes them right); on mobile the group
           becomes a full-width even grid so they line up instead of wrapping ragged. -->
      <div class="actions">
        <button class="btn" class:on={editor.openDrawer === 'tags'} onclick={() => (editor.openDrawer = 'tags')}>Tags</button>
        <button class="btn" class:on={editor.openDrawer === 'layouts'} onclick={() => (editor.openDrawer = 'layouts')}>Layout</button>
        <button class="btn" class:on={editor.openDrawer === 'style'} onclick={() => (editor.openDrawer = 'style')}>Style</button>
        <button class="btn" class:on={editor.preview.open} onclick={() => editor.preview.toggle()}>◱ Preview</button>
        <button
          class="btn"
          title="Export this résumé as JSON"
          data-tour-spot="export"
          disabled={editor.noProfiles}
          onclick={() => editor.exportJson()}>⤓ Export</button
        >
      </div>
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
  {:else if editor.openDrawer === 'history'}
    <Drawer title="History"><HistoryDrawer /></Drawer>
  {/if}

  <Tour />

  <!-- The toast and the tour share the bottom-center slot; the tour wins. (In demo
       mode nothing saves, so nothing can fail — this only matters if the two ever meet.) -->
  {#if editor.saveError && !tour.active}
    <div class="save-toast floating-panel" role="alert" aria-live="assertive">
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
  .right { margin-left: auto; display: flex; align-items: center; gap: 14px; font-weight: 400; }
  /* Hollow = unset = nothing is being written. The System-6 idiom, and the reason
     demo no longer borrows the colour we reserve for real errors. */
  .dot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; background: var(--paper); border: 1px solid var(--ink); vertical-align: -1px; margin-right: 5px; }
  .dot.live { background: var(--state-live); }
  .dot.busy { background: var(--state-busy); }
  .conn { font: inherit; display: inline-flex; align-items: center; background: none; border: 0; padding: 0; color: inherit; cursor: pointer; }
  .conn:disabled { cursor: default; }
  /* Sign-in CTA: drop the status dot and read as an obvious link. */
  .conn.cta .dot { display: none; }
  .conn.cta .conn-label { font-weight: 700; text-decoration: underline; }

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
  /* Pop-up-window chrome for the invite — inert on desktop (the invite is an inline
     strip there); the mobile block below turns it on. */
  .invite-scrim, .invite-tbar { display: none; }
  .workspace { max-width: 1320px; margin: 0 auto; padding: 18px 22px 0; }
  .toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 16px; }
  /* Transparent to layout on desktop — the buttons sit flat in the toolbar flex. */
  .actions { display: contents; }
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

  /* Save-error toast. Paper/border/shadow/mono + the bottom-center anchor all come
     from the shared .floating-panel primitive (lib/styles.css); only the row layout
     is the toast's own. */
  .save-toast { display: flex; align-items: center; gap: 10px; max-width: min(92vw, 460px); padding: 8px 10px 8px 12px; }
  .save-toast .st-icon { color: var(--state-error); font-size: 14px; line-height: 1; }
  .save-toast .st-msg { flex: 1; line-height: 1.35; }
  .save-toast .st-btn { font-family: var(--mono); font-size: 12px; border: 1px solid var(--ink); background: var(--chrome-hi); padding: 2px 8px; cursor: pointer; }
  .save-toast .st-btn:hover { background: var(--ink); color: var(--paper); }
  .save-toast .st-x { padding: 2px 6px; }
  @media (prefers-reduced-motion: no-preference) {
    .save-toast { animation: toast-in 160ms ease-out; }
    @keyframes toast-in { from { opacity: 0; transform: translate(-50%, 8px); } to { opacity: 1; transform: translate(-50%, 0); } }
  }

  /* ── Mobile ── A fixed shell: a persistent top bar (the floating site-nav on the
     left — from BaseLayout — and the editor ☰ Menu on the right), the résumé filling
     the middle as the ONLY scroll region, and the connection status pinned across the
     bottom. The three regions cover the viewport edge-to-edge, so no background ever
     shows between them. No title. */
  @media (max-width: 640px) {
    .stage {
      --top-h: 58px;
      --bot-h: 44px;
      min-height: 0;
      padding-bottom: 0;
    }

    /* Top bar — the editor ☰ Menu, pushed to the far right so it clears the floating
       site-nav at the top-left. This one menu is every command (File/Edit/View/Help). */
    .menubar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: var(--top-h);
      gap: 8px;
      padding: 0 12px;
      margin: 0;
      justify-content: flex-end;
      align-items: center;
      z-index: 5;
    }
    .mark,
    .menubar strong {
      display: none; /* no wordmark, no title */
    }
    .toolbar {
      display: none; /* its buttons all moved into the ☰ menu */
    }

    /* Status bar — pinned across the bottom (tap to reopen the invite / tour). */
    .right {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      height: var(--bot-h);
      margin: 0;
      justify-content: center;
      align-items: center;
      gap: 6px;
      background: var(--paper);
      border-top: 1px solid var(--ink);
      font-size: 12.5px;
      z-index: 5;
    }
    .conn-label {
      display: inline;
    }
    /* Redundant with the bottom status bar. */
    .statusbar {
      display: none;
    }

    /* Guided-tour invite → centered System-6 pop-up window over a dismiss scrim. */
    .invite-scrim {
      display: block;
      position: fixed;
      inset: 0;
      z-index: 60;
      background: rgb(28 27 25 / 30%);
      border: 0;
      padding: 0;
      cursor: pointer;
    }
    .invite {
      position: fixed;
      z-index: 61;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: min(90vw, 360px);
      flex-direction: column;
      align-items: stretch;
      gap: 12px;
      padding: 14px;
      box-shadow: var(--shadow-float);
    }
    .invite-tbar {
      display: flex;
      align-items: center;
      gap: 8px;
      height: 22px;
      margin: -14px -14px 2px; /* bleed the titlebar to the window edges */
      padding: 0 8px;
      border-bottom: 1px solid var(--ink);
      background-image: repeating-linear-gradient(
        to bottom,
        var(--ink) 0,
        var(--ink) 1px,
        var(--paper) 1px,
        var(--paper) 3px
      );
    }
    .invite-close {
      width: 12px;
      height: 12px;
      background: var(--paper);
      border: 1px solid var(--ink);
      padding: 0;
      cursor: pointer;
      flex: none;
    }
    .invite-ttl {
      font-size: 12px;
      font-weight: 700;
      background: var(--paper);
      padding: 0 10px;
      margin: 0 auto;
    }
    .invite-fill {
      width: 12px;
    }
    .invite .mk {
      align-self: flex-start;
    }
    .invite .txt {
      flex: none;
    }
    .invite .btn.tour-start {
      width: 100%;
      padding: 10px;
      font-size: 13px;
    }
    .invite .link {
      align-self: center;
    }
    .invite .x {
      display: none; /* the titlebar close box replaces it */
    }

    /* Résumé: fixed between the two bars, edge-to-edge; only its body scrolls, so the
       three fixed regions together cover the whole viewport (no grey gaps). system.css's
       global `.window` also adds margin:16px + min-width:320px — override those too. */
    .window {
      position: fixed;
      top: var(--top-h);
      right: 0;
      bottom: var(--bot-h);
      left: 0;
      display: flex;
      flex-direction: column;
      margin: 0;
      min-width: 0;
      border-left: 0;
      border-right: 0;
      border-top: 0;
      box-shadow: none;
    }
    .titlebar {
      flex: none;
    }
    .wbody,
    .wbody.split {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
    }
    .doc-scroll {
      flex: 1;
      min-height: 0;
      max-height: none;
      overflow-y: auto;
      overflow-x: hidden;
    }
    .preview {
      flex: 1;
      min-height: 0;
      border-left: 0;
      border-top: 1px solid var(--ink);
    }
  }
</style>
