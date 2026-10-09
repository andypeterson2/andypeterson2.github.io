<script lang="ts">
  import { onMount } from 'svelte';
  import './lib/styles.css';
  import { editor } from './lib/store.svelte';
  import UiButton from './components/ui/Button.svelte';
  import type { Personal } from './lib/types';
  import Document from './components/Document.svelte';
  import LetterEditor from './components/LetterEditor.svelte';
  import Drawer from './components/Drawer.svelte';
  import SymbolPalette from './components/SymbolPalette.svelte';
  import { symbols } from './lib/symbol-input.svelte';

  /** The export menu: "Export" alone never said in what. */
  let exportOpen = $state(false);
  import StyleDrawer from './components/StyleDrawer.svelte';
  import LayoutsDrawer from './components/LayoutsDrawer.svelte';
  import TagsDrawer from './components/TagsDrawer.svelte';
  import VariantDrawer from './components/VariantDrawer.svelte';
  import ProfilesDrawer from './components/ProfilesDrawer.svelte';
  import HistoryDrawer from './components/HistoryDrawer.svelte';
  import PdfView from './components/PdfView.svelte';
  import { modal } from './lib/modal';

  // The owner's identity from siteConfig, overlaid onto the demo person so visitors
  // see the real CV while committed source carries no PII.
  let { identity }: { identity?: Partial<Personal> } = $props();
  // A static prop, read at init (not in an $effect) so the overlay beats first paint.
  // svelte-ignore state_referenced_locally
  if (identity) editor.hydrateDemoIdentity(identity);

  // Flips true once mounted → the stage gets `data-hydrated`, a deterministic
  // signal that event handlers are live (tests wait for it instead of racing).
  let hydrated = $state(false);

  // Demo is the default — and the only mode almost every visitor can reach, since
  // the backend is Access-gated. It is not a failure, so it isn't drawn like one.
  const demoMode = $derived(!editor.connected && !editor.connecting && !editor.signingIn);
  // Signed in, but the backend didn't load their resumes (cold start, outage). Not the
  // same as signed out: offering "Sign in" again would just loop.
  const signedInOffline = $derived(demoMode && editor.identity !== null);
  // The published PDF stands in for a compile this session cannot run.
  const showPublished = $derived(!editor.connected && editor.preview.publishedState === 'ready');
  // The carried-over-edits offer is a modal pop-up over a scrim: `use:modal` makes
  // the page behind inert and puts focus on the answer.

  // Auto-probe the live backend once mounted (client-only). Signed-in owner →
  // real CV; anyone else → stays on the local demo + a sign-in offer.
  onMount(() => {
    hydrated = true;
    void editor.connect();
    // The sign-in lives in the site menubar, which knows nothing about unsaved
    // demo edits: this is where they are stashed before it navigates away.
    const onSignIn = (e: Event) => {
      if (!editor.prepareSignIn()) e.preventDefault();
    };
    document.addEventListener('site:signin', onSignIn);
    return () => document.removeEventListener('site:signin', onSignIn);
  });

  const isEditable = (t: EventTarget | null) =>
    t instanceof HTMLElement &&
    (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName));

  /**
   * ⌘Z / ⇧⌘Z — but never inside a text field. There the browser's own undo is
   * better (it moves the caret with the text), and it still persists: the `input`
   * event it fires routes through saveEntry, which records it like any other edit.
   */
  function onGlobalKey(e: KeyboardEvent) {
    if (e.key === 'Escape' && (exportOpen || symbols.open)) {
      exportOpen = false;
      symbols.close();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !isEditable(e.target)) {
      e.preventDefault();
      void (e.shiftKey ? editor.undo.redo() : editor.undo.undo());
    }
  }
</script>

<svelte:window onkeydown={onGlobalKey} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="stage" data-hydrated={hydrated || undefined} onfocusin={symbols.track}>
  <div class="sr-only" aria-live="polite" aria-atomic="true">{editor.announce}</div>
  {#if editor.signingIn}
    <div class="invite busy" role="status">
      <span class="mk" aria-hidden="true">◆</span>
      <span class="txt"
        >Redirecting to Google sign-in… you'll come back here, and your edits come with you.</span
      >
    </div>
  {:else if editor.pendingDraft}
    <!-- Demo edits carried across sign-in: offer them as a resume of their own. -->
    <div class="invite-layer" use:modal={'#draft-primary'}>
      <div class="invite-scrim" aria-hidden="true"></div>
      <div class="invite" role="dialog" aria-modal="true" aria-labelledby="draft-title">
        <div class="titlebar invite-tbar">
          <span class="title" id="draft-title">Your demo edits</span>
          <span class="fill"></span>
        </div>
        <span class="txt"
          >You edited the demo before signing in. Bring those edits into your account as a new
          resume? Your name and email replace the sample's contact details.</span
        >
        <UiButton
          variant="toolbar"
          class="invite-cta"
          tone="primary"
          id="draft-primary"
          disabled={editor.importingDraft}
          onclick={() => void editor.importDraft()}
          >{editor.importingDraft ? 'Bringing them in…' : 'Bring them in'}</UiButton
        >
        <button
          class="link"
          aria-disabled={editor.importingDraft}
          title={editor.importingDraft ? 'Bringing your edits in — one moment' : undefined}
          onclick={() => !editor.importingDraft && editor.discardDraft()}
          >Start fresh instead</button
        >
      </div>
    </div>
  {/if}

  <div class="workspace">
    <div class="workspace-body">
      <div class="toolbar-window">
        <!-- Exempt from the reflow sweep: on a phone this row scrolls sideways inside
             its own clip, so its buttons reach past the viewport while the page does
             not (WCAG 1.4.10 asks that the page not scroll, and it doesn't). -->
        <div class="toolbar" data-reflow-exempt>
          <span class="field"
            >Resume
            <button
              class="popup profile-btn"
              title={editor.connected
                ? 'Switch resume'
                : 'Your resumes live in your account — sign in to switch between them'}
              aria-disabled={!editor.connected}
              onclick={() => editor.connected && (editor.openDrawer = 'profiles')}
              >{editor.profileLabel} ▾</button
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
          {#if !demoMode || signedInOffline}
            <!-- The retry for a session whose resumes didn't load. Signing in is the
                 site menubar's, so a signed-out demo shows nothing here. -->
            <button
              class="conn"
              aria-disabled={editor.connecting || editor.signingIn}
              onclick={() => !(editor.connecting || editor.signingIn) && editor.connect()}
              title={signedInOffline
                ? "Signed in, but your saved resumes didn't load — try again"
                : 'Connection status'}
            >
              <span
                class="dot"
                class:live={editor.connected}
                class:busy={editor.connecting || editor.signingIn}
                aria-hidden="true"
              ></span><span class="conn-label"
                >{editor.signingIn
                  ? 'signing in…'
                  : editor.connecting
                    ? 'connecting…'
                    : editor.connected
                      ? 'connected'
                      : "Couldn't load your resumes — retry"}</span
              >
            </button>
          {/if}
          <UiButton
            variant="toolbar"
            active={editor.openDrawer === 'history'}
            aria-expanded={editor.openDrawer === 'history'}
            onclick={() => (editor.openDrawer = 'history')}>History</UiButton
          >
          <UiButton
            variant="toolbar"
            active={exportOpen}
            aria-expanded={exportOpen}
            title="Take this resume away in a chosen format"
            disabled={editor.noProfiles}
            onclick={() => (exportOpen = !exportOpen)}>⤓ Export</UiButton
          >
          <!-- Which tier is in play, and whether the work is kept: two separate
               notices, because they answer two different questions. They report rather
               than act, so they sit at the far end of the row. -->
          <span class="tb-gap"></span>
          <span class="note" class:live={editor.connected}
            >{editor.connected ? 'live' : 'demo'}</span
          >
          <span class="note" role="status"
            >{editor.connected
              ? editor.saveState === 'saving'
                ? 'saving…'
                : editor.saveState === 'error'
                  ? '⚠ save failed'
                  : '✓ saved'
              : 'not saved'}</span
          >
        </div>

        <!-- Below the line, the commands sit over what they act on: the document's
             own on the left, the PDF's on the right, splitting where the panes do. -->
        <div class="tb-split">
          <div class="tb-doc">
            <UiButton
              variant="toolbar"
              title={editor.undo.canUndo ? `Undo ${editor.undo.undoLabel}` : 'Nothing to undo'}
              aria-label={editor.undo.canUndo ? `Undo ${editor.undo.undoLabel}` : 'Undo'}
              disabled={!editor.undo.canUndo}
              onclick={() => void editor.undo.undo()}>↶ Undo</UiButton
            >
            <UiButton
              variant="toolbar"
              title={editor.undo.canRedo ? `Redo ${editor.undo.redoLabel}` : 'Nothing to redo'}
              aria-label={editor.undo.canRedo ? `Redo ${editor.undo.redoLabel}` : 'Redo'}
              disabled={!editor.undo.canRedo}
              onclick={() => void editor.undo.redo()}>↷ Redo</UiButton
            >
            <UiButton
              variant="toolbar"
              title={editor.connected
                ? 'The demo sample is only shown while signed out'
                : 'Empty the demo, to start from nothing'}
              disabled={editor.connected}
              onclick={() => editor.clearDemo()}>⌫ Clear</UiButton
            >
            <span class="tbar-sep" aria-hidden="true"></span>
            <UiButton
              variant="toolbar"
              active={editor.openDrawer === 'tags'}
              aria-expanded={editor.openDrawer === 'tags'}
              onclick={() => (editor.openDrawer = 'tags')}>Tags</UiButton
            >
            <UiButton
              variant="toolbar"
              active={editor.openDrawer === 'style'}
              aria-expanded={editor.openDrawer === 'style'}
              onclick={() => (editor.openDrawer = 'style')}>Style</UiButton
            >
            <UiButton
              variant="toolbar"
              active={symbols.open}
              title="Insert a symbol"
              aria-expanded={symbols.open}
              onclick={() => symbols.toggle()}>Ω Symbols</UiButton
            >
          </div>

          <div class="tb-pdf">
            <UiButton
              variant="toolbar"
              active={editor.openDrawer === 'layouts'}
              aria-expanded={editor.openDrawer === 'layouts'}
              title={editor.connected
                ? 'Choose the LaTeX template'
                : 'Choosing a template needs an account — sign in to pick one'}
              disabled={!editor.connected}
              onclick={() => (editor.openDrawer = 'layouts')}>Layout</UiButton
            >
            <UiButton
              variant="toolbar"
              pressed={editor.preview.open}
              onclick={() => editor.preview.toggle()}>◱ Preview</UiButton
            >
            <UiButton
              variant="toolbar"
              title={editor.preview.compilable
                ? 'Compile this resume to a PDF'
                : 'Compiling to PDF needs an account — sign in to compile'}
              disabled={!editor.preview.compilable || editor.preview.state === 'compiling'}
              onclick={() => editor.preview.openAndCompile()}
              >⟳ {editor.preview.state === 'compiling' ? 'Compiling…' : 'Compile'}</UiButton
            >
          </div>
        </div>
      </div>

      <div class="doc-window">
        <div class="wbody" class:split={editor.preview.open}>
          <div class="doc-scroll">
            {#if editor.noProfiles}
              <div class="no-profiles">
                <p class="np-title">No resumes yet</p>
                <p class="np-sub">Create your first resume to start editing.</p>
                <button class="np-btn" onclick={() => editor.addPerson()}
                  >＋ Create your first resume</button
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
                <span>
                  {#if editor.preview.url}{editor.pdfName}{:else if showPublished}The site's
                    published resume — not your edits{:else}No PDF yet{/if}
                </span>
                <span class="pv-tools">
                  {#if editor.preview.url}
                    <a class="pv-btn" href={editor.preview.url} download={editor.pdfName}>⤓ PDF</a>
                  {:else if showPublished}
                    <!-- Straight from the gateway, so the browser saves it under the dated
                       name the server sends. -->
                    <a
                      class="pv-btn"
                      href={editor.preview.publishedHref}
                      target="_blank"
                      rel="noopener noreferrer">⤓ PDF</a
                    >
                  {/if}
                </span>
              </div>
              <div class="pv-body">
                {#if showPublished}
                  <!-- No compiler here, so the pane shows the PDF the site already publishes.
                     Once someone has edited the document beside it, the two differ, and the
                     strip says so where the eye is rather than only in the bar. -->
                  {#if editor.dirty}
                    <p class="pv-strip">Your edits aren't in this PDF — sign in to compile them.</p>
                  {/if}
                  <PdfView blob={editor.preview.published} />
                {:else if !editor.connected}
                  <div class="pv-note">
                    {#if editor.preview.publishedState === 'loading'}
                      Loading the published resume…
                    {:else if editor.identity}
                      Couldn't reach the compiler — retry from the toolbar.
                    {:else}
                      Sign in to compile this resume to a PDF.
                    {/if}
                  </div>
                {:else if !editor.preview.compilable}
                  <div class="pv-note">Choose a resume to compile its PDF.</div>
                {:else if editor.preview.state === 'compiling'}
                  <div class="pv-note">
                    Compiling {editor.variantLabel}…<br /><small
                      >running xelatex — a few seconds</small
                    >
                  </div>
                {:else if editor.preview.state === 'error'}
                  <div class="pv-log"><pre>{editor.preview.log}</pre></div>
                {:else if editor.preview.url}
                  <!-- Rendered page-by-page onto width-fitted canvases (PdfView), instead of handed
                     to Chrome's built-in iframe viewer — which ignored the fit fragment and
                     left the page small at the top. PdfView reads the Blob directly (no
                     fetch of the blob: URL, which connect-src blocks). Download link remains. -->
                  <PdfView blob={editor.preview.blob} />
                {:else}
                  <div class="pv-note">Compile to preview {editor.variantLabel}.</div>
                {/if}
              </div>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>

  {#if exportOpen}
    <div class="modal-layer" use:modal={'.ex-opt'}>
      <button
        class="modal-scrim"
        aria-hidden="true"
        tabindex="-1"
        onclick={() => (exportOpen = false)}
      ></button>
      <div class="sym-window export-window" role="dialog" aria-modal="true" aria-label="Export">
        <div class="titlebar">
          <button class="close" aria-label="Close export" onclick={() => (exportOpen = false)}
          ></button>
          <span class="title">Export</span>
          <span class="fill"></span>
        </div>
        <div class="ex-body">
          <p class="ex-note">Take this resume away in whichever form you need it.</p>
          <button
            class="s6-btn ex-opt"
            aria-disabled={!editor.preview.url}
            title={editor.preview.url
              ? 'Save the compiled PDF'
              : 'There is no PDF yet — press Compile first'}
            onclick={() => {
              if (!editor.preview.url) return;
              editor.downloadPdf();
              exportOpen = false;
            }}
          >
            <span class="ex-name">PDF</span>
            <span class="ex-what">The compiled document, as it prints</span>
          </button>
          <button
            class="s6-btn ex-opt"
            title="Save the whole document as JSON"
            onclick={() => {
              void editor.exportJson();
              exportOpen = false;
            }}
          >
            <span class="ex-name">JSON</span>
            <span class="ex-what">Every section, variant and tag — re-imports losslessly</span>
          </button>
          <button
            class="s6-btn ex-opt"
            title="Save the work history as paste-ready blocks"
            onclick={() => {
              void editor.exportLinkedin();
              exportOpen = false;
            }}
          >
            <span class="ex-name">LinkedIn JSON</span>
            <span class="ex-what"
              >Work history as paste-ready blocks, for LinkedIn, Indeed or Handshake</span
            >
          </button>
        </div>
      </div>
    </div>
  {/if}

  {#if symbols.open}
    <div class="modal-layer">
      <!-- Not inert behind it: a glyph lands in the field the caret left, and an
           inert page would take that field's focus with it. -->
      <button class="modal-scrim" aria-hidden="true" tabindex="-1" onclick={() => symbols.close()}
      ></button>
      <div class="sym-window window" role="dialog" aria-label="Insert a symbol">
        <div class="titlebar">
          <button class="close" aria-label="Close symbols" onclick={() => symbols.close()}></button>
          <span class="title">Symbols</span>
          <span class="fill"></span>
        </div>
        <div class="sym-body"><SymbolPalette onpick={symbols.insert} /></div>
      </div>
    </div>
  {/if}

  {#if editor.openDrawer === 'style'}
    <Drawer title="Style"><StyleDrawer /></Drawer>
  {:else if editor.openDrawer === 'layouts'}
    <Drawer title="Layouts"><LayoutsDrawer /></Drawer>
  {:else if editor.openDrawer === 'tags'}
    <Drawer title="Tags"><TagsDrawer /></Drawer>
  {:else if editor.openDrawer === 'variant'}
    <Drawer title="Variants"><VariantDrawer /></Drawer>
  {:else if editor.openDrawer === 'profiles'}
    <Drawer title="Resumes"><ProfilesDrawer /></Drawer>
  {:else if editor.openDrawer === 'history'}
    <Drawer title="History"><HistoryDrawer /></Drawer>
  {/if}

  {#if editor.saveError}
    <div class="save-toast floating-panel" role="alert" aria-live="assertive">
      <span class="st-icon" aria-hidden="true">⚠</span>
      <span class="st-msg">{editor.saveError}</span>
      {#if editor.canRetry}
        <UiButton variant="toast" class="st-retry" onclick={() => editor.retrySave()}
          >Retry</UiButton
        >
      {/if}
      <UiButton
        variant="toast"
        class="st-x"
        aria-label="Dismiss error"
        onclick={() => editor.dismissError()}>✕</UiButton
      >
    </div>
  {/if}
</div>

<style>
  /* Exactly as tall as the pane it is slotted into, so the pane never scrolls and
     the document below the toolbar carries the editor's one scrollbar — which then
     starts under the toolbar rather than running up alongside it. */
  .stage {
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;

    /* The editor's chrome text is set in the mono face. */
    font-family: var(--font-mono);
  }

  /* Hollow = unset = nothing is being written: the System-6 idiom, so demo never
     borrows the colour reserved for real errors. */
  .dot {
    display: inline-block;
    width: 9px;
    height: 9px;
    border-radius: var(--radius-round);
    background: var(--paper);
    border: 1px solid var(--ink);
    vertical-align: -1px;
    margin-right: 5px;
  }

  .dot.live {
    background: var(--state-live);
  }

  .dot.busy {
    background: var(--state-busy);
  }

  /* The connection state, beside the notices it qualifies. */
  .conn {
    font-family: var(--mono);
    font-size: var(--text-4xs);
    color: var(--ink-2);
    display: inline-flex;
    align-items: center;
    background: none;
    border: 0;
    padding: 0;
    cursor: pointer;
  }

  .conn:disabled {
    cursor: default;
  }

  /* The carried-over-edits offer — a centered System-6 pop-up window over a scrim. */
  .invite-scrim {
    position: fixed;
    inset: 0;
    z-index: var(--z-overlay);
    background: var(--scrim-soft);
    border: 0;
    padding: 0;
    cursor: pointer;
  }

  .invite {
    position: fixed;
    z-index: var(--z-overlay);
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
    width: min(92vw, 400px);
    padding: 14px;
    background: var(--chrome-hi);
    color: var(--ink);
    border: 1px solid var(--ink);
    box-shadow: var(--shadow-float);
    font-size: var(--text-3xs);
    line-height: 1.4;
  }

  /* The invite reuses the shared window titlebar (.titlebar / .title / .close / .fill)
     so it stays consistent with every other editor window and can't drift again. It
     only adds the bleed to the popup's padded edges, and keeps its close box a real
     (functional) button rather than the decorative span the windows use. */
  .invite-tbar {
    margin: -14px -14px 2px;
  }

  .invite-close {
    padding: 0;
    cursor: pointer;
    flex: none;
  }

  .invite .mk {
    font-size: var(--text-2xs);
    flex: none;
    align-self: flex-start;
    line-height: 1.4;
  }

  .invite .txt {
    min-width: 0;
  }

  .invite .txt b {
    font-weight: 700;
  }

  .invite :global(.ui.btn) {
    font-size: var(--text-3xs);
    padding: 4px 10px;
  }

  .invite :global(.ui.btn.invite-cta) {
    width: 100%;
    padding: 10px;
    font-size: var(--text-3xs);
  }

  .invite .link {
    align-self: center;
    background: none;
    border: 0;
    padding: 0;
    font: inherit;
    color: var(--ink-2);
    text-decoration: underline;
    cursor: pointer;
    white-space: nowrap;
  }

  .invite .link:hover {
    color: var(--ink);
  }

  .invite .x {
    display: none;
  } /* the titlebar close box replaces it */
  .invite.busy {
    color: var(--ink-2);
  }

  /* No frame of its own: the page's own .site-window is the window. */
  .workspace {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    width: 100%;
  }

  /* No inset of its own: the toolbar and the document run the full width of the
     page, as the menubar above them does. Each supplies its own padding. */
  .workspace-body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  /* Centred over the page it covers, with the work dimmed behind it. */
  .modal-layer {
    position: fixed;
    inset: 0;
    z-index: var(--z-overlay);
    display: grid;
    place-items: center;
    padding: 24px;
  }

  .modal-scrim {
    position: fixed;
    inset: 0;
    background: var(--scrim-soft);
    border: 0;
    padding: 0;
    cursor: pointer;
  }

  /* The caret keeps its place in the field behind, so a glyph lands where it was. */
  .sym-window {
    position: relative;
    width: min(34rem, calc(100vw - 48px));
    max-height: calc(100vh - 48px);
    display: flex;
    flex-direction: column;
    background: var(--paper);
    border: 2px solid var(--ink);
    border-right-width: 4px;
    border-bottom-width: 4px;
  }

  .sym-body {
    overflow: auto;
  }

  .export-window {
    width: min(24rem, calc(100vw - 48px));
  }

  .ex-body {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
  }

  .ex-note {
    margin: 0;
    font-family: var(--mono);
    font-size: var(--text-4xs);
    color: var(--ink-2);
  }

  /* One row per format: what it is, then what it gives you. The shared .s6-btn
     carries everything else, out-of-reach included. */
  .ex-opt {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    text-align: left;
    padding: 8px 10px;

    /* The shared button is square-cornered; everything in this editor is not. */
    border-radius: var(--radius);
  }

  .ex-name {
    font-family: var(--font-ui);
    font-size: var(--text-3xs);
  }

  .ex-what {
    font-family: var(--mono);
    font-size: var(--text-4xs);
  }

  /* Sits above the scroller, so the document's scrollbar begins below this. */
  .toolbar-window {
    flex: none;
    background: var(--paper);
    border-bottom: 1px solid var(--ink);
  }

  /* The document fills the remaining height; its .wbody panes scroll inside it. */
  .doc-window {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  /* Row one: which resume is open and whether its work is kept. */
  .toolbar {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    padding: 10px 14px;
    border-bottom: 1px solid var(--paper-3);
  }

  /* Rows two and three, on the seam the panes below them use, so each group of
     commands sits over the pane it acts on. */
  .tb-split {
    display: grid;
    grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
  }

  .tb-doc,
  .tb-pdf {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    padding: 8px 14px;
  }

  .tb-pdf {
    border-left: 1px solid var(--paper-3);
  }

  /* Transparent to layout on desktop — the buttons sit flat in the toolbar flex. */
  .actions {
    display: contents;
  }

  .field {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-size: var(--text-4xs);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--ink-2);
  }

  /* Every control on the toolbar stands the same height, so a row of them reads as
     one strip rather than a ragged line. */
  .toolbar :global(.ui.btn),
  .tb-doc :global(.ui.btn),
  .tb-pdf :global(.ui.btn),
  .popup {
    height: 28px;
    display: inline-flex;
    align-items: center;

    /* A fixed line box, so a taller glyph (the undo arrows, the preview mark) does
       not push its own button a pixel above the rest of the row. */
    line-height: 1;
    padding-block: 0;
  }

  .popup {
    font-size: var(--text-3xs);
    font-weight: 700;
    text-transform: none;
    letter-spacing: 0;
    background: var(--paper);
    border: 1px solid var(--ink);
    border-radius: var(--radius);
    padding: 4px 10px;
  }

  button.popup {
    font-family: var(--sans);
    color: var(--ink);
    cursor: pointer;
    max-width: 220px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  button.popup:active {
    transform: translate(1px, 1px);
  }

  .popup.lens {
    background: var(--ink);
    color: var(--paper);
  }

  /* .btn (the toolbar family) is styled globally as .ui.btn. */

  .sp {
    flex: 1;
  }

  /* Hairline between the shape group (Tags/Layout/Style) and the output group
     (Preview/Export). --ink-5 is the palette's designated hairline ink. */
  .tbar-sep {
    align-self: stretch;
    width: 1px;
    margin: 2px;
    background: var(--ink-5);
  }

  /* min-height (not a fixed height) so the bar grows with its title: nested windows
     carry --text-base (the 28px content-card size), the outer frame --text-lg (36px,
     the "Home" size). The .title patch's own vertical padding drives that growth. */
  .titlebar {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 22px;
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

  .close {
    width: 11px;
    height: 11px;
    background: var(--paper);
    border: 1px solid var(--ink);
  }

  .title {
    font-family: var(--font-ui);
    font-size: var(--text-base);
    font-weight: 700;
    line-height: 1.1;
    background: var(--paper);
    padding: 12px;
    margin: 0 auto;
  }

  .app-title {
    font-size: var(--text-lg);
  }

  .fill {
    width: 11px;
  }

  .wbody {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr);
  }

  .wbody.split {
    grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
  }

  /* The editor's one scrollbar, below the toolbar rather than beside it. */
  .doc-scroll {
    min-height: 0;
    overflow: auto;
    background: var(--paper);
  }

  .no-profiles {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: min(60vh, 520px);
    padding: 40px 24px;
    text-align: center;
  }

  .np-title {
    font-family: var(--serif);
    font-size: var(--text-base);
    font-weight: 700;
    color: var(--ink-2);
    margin: 0;
  }

  .np-sub {
    font-size: var(--text-3xs);
    color: var(--ink-3);
    margin: 0 0 10px;
  }

  .np-btn {
    font-family: var(--sans);
    font-size: var(--text-3xs);
    font-weight: 600;
    color: var(--ink);
    background: var(--paper);
    border: 1px solid var(--ink);
    border-radius: var(--radius-md);
    padding: 8px 16px;
    cursor: pointer;
  }

  .np-btn:active {
    transform: translate(1px, 1px);
  }

  /* Cap the preview column to the same height as the document column (.doc-scroll)
     so a tall PDF scrolls INSIDE the pane (pv-pages) instead of growing the whole
     shell past the viewport — which left dead space below the pages ("doesn't reach
     the bottom"). min-height:0 lets the inner pv-pages actually shrink + scroll. */
  .preview {
    display: flex;
    flex-direction: column;
    min-height: 0;
    border-left: 1px solid var(--ink);
    background: var(--chrome);
  }

  .pv-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 6px 12px;
    border-bottom: 1px solid var(--ink);
    background: var(--chrome-hi);
    font-size: var(--text-3xs);
    font-weight: 700;
  }

  .pv-tools {
    display: flex;
    align-items: center;
    gap: 6px;
    font-family: var(--mono);
    font-size: var(--text-4xs);
    font-weight: 400;
  }

  .pv-btn {
    font-family: var(--sans);
    font-size: var(--text-4xs);
    font-weight: 600;
    color: var(--ink);
    background: var(--paper);
    border: 1px solid var(--ink);
    border-radius: var(--radius);
    padding: 3px 9px;
    cursor: pointer;
    text-decoration: none;
  }

  .pv-btn:active {
    transform: translate(1px, 1px);
    box-shadow: none;
  }

  .pv-btn:disabled {
    opacity: 0.4;
    cursor: default;
    box-shadow: none;
  }

  .pv-body {
    flex: 1;
    display: flex;

    /* A column, so the strip above the pages is a band across the pane and the
       pages keep the full width to render into. */
    flex-direction: column;
    min-height: 0;
    background: var(--chrome);
  }

  .pv-note {
    margin: auto;
    padding: 30px;
    font-family: var(--mono);
    font-size: var(--text-3xs);
    color: var(--ink-3);
    text-align: center;
    line-height: 1.7;
  }

  /* Sits above the pages, in the pane's own ink, so it reads as part of the viewer
     rather than as an error. */
  .pv-strip {
    flex: none;
    margin: 0;
    padding: 6px 10px;
    border-bottom: 1px solid var(--ink);
    background: var(--chrome-hi);
    font-family: var(--mono);
    font-size: var(--text-4xs);
    color: var(--ink);
    text-align: center;
  }

  .pv-log {
    flex: 1;
    overflow: auto;
    background: var(--ink);
  }

  .pv-log pre {
    margin: 0;
    padding: 14px;
    font-family: var(--doc-mono); /* a compile log stays monospaced */
    font-size: var(--text-4xs);
    line-height: 1.5;
    color: var(--paper-3);
    white-space: pre-wrap;
    word-break: break-word;
  }

  /* The tier and the save state, each its own notice on the toolbar. Mono and
     muted: they report, they are not pressed. */

  /* Out of reach, said the same way the button families say it. */
  .popup[aria-disabled='true'],
  .conn[aria-disabled='true'],
  .link[aria-disabled='true'] {
    cursor: default;
    background: var(--dither-light);
    color: var(--ink);
    text-shadow:
      1px 0 0 var(--paper),
      -1px 0 0 var(--paper),
      0 1px 0 var(--paper),
      0 -1px 0 var(--paper),
      1px 1px 0 var(--paper),
      -1px -1px 0 var(--paper),
      1px -1px 0 var(--paper),
      -1px 1px 0 var(--paper);
  }

  /* Pushes whatever follows it to the right end of the row. */
  .tb-gap {
    flex: 1;
  }

  .note {
    font-family: var(--mono);
    font-size: var(--text-4xs);
    color: var(--ink-2);
    white-space: nowrap;
  }

  .note.live {
    color: var(--ink);
    font-weight: 700;
  }

  /* Save-error toast. Paper/border/shadow/mono + the bottom-center anchor all come
     from the shared .floating-panel primitive; only the row layout
     is the toast's own. */
  .save-toast {
    display: flex;
    align-items: center;
    gap: 10px;
    max-width: min(92vw, 460px);
    padding: 8px 10px 8px 12px;
  }

  .save-toast .st-icon {
    color: var(--ink);
    font-size: var(--text-2xs);
    line-height: 1;
  }

  .save-toast .st-msg {
    flex: 1;
    line-height: 1.35;
  }

  /* .st-btn / .st-x (the toast family) are styled globally as .ui.st-btn. */

  @media (prefers-reduced-motion: no-preference) {
    .save-toast {
      animation: toast-in var(--dur) ease-out;
    }

    @keyframes toast-in {
      from {
        opacity: 0;
        transform: translate(-50%, 8px);
      }

      to {
        opacity: 1;
        transform: translate(-50%, 0);
      }
    }
  }

  /* ── Mobile / tablet ── A fixed shell: the toolbar across the top, the resume as
     the only scroll region, and the status pinned at the bottom, edge-to-edge with no
     title. 768px matches the site's floating-nav breakpoint so the nav never lands on
     the desktop toolbar; short landscape phones get this layout too. The compact JS
     media query must use the same bounds. */
  @media (width <= 768px), (height <= 500px) {
    .stage {
      --top-h: 58px;

      min-height: 0;
      padding-bottom: 0;
    }

    /* Top bar — the toolbar itself, scrolled sideways rather than folded into a
       menu. Its left inset clears the floating site-nav's 44px button at top-left. */
    .toolbar-window {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: var(--top-h);
      margin: 0;
      padding: 0;
      background: var(--paper);
      z-index: var(--z-sticky);
    }

    .toolbar {
      height: 100%;
      flex-wrap: nowrap;
      overflow-x: auto;
      overscroll-behavior-x: contain;
      padding: 0 12px 0 64px;
    }

    /* Each command keeps its own width while the row scrolls past them. */
    .toolbar :global(.ui.btn),
    .toolbar .popup {
      flex: none;
    }

    /* Resume: fixed below the toolbar, edge-to-edge; only its body scrolls, so the
       two fixed regions together cover the whole viewport (no grey gaps). */
    .doc-window {
      position: fixed;
      inset: var(--top-h) 0 0 0;
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

    .workspace {
      max-width: none;
      margin: 0;
      border: 0;
      box-shadow: none;
      background: none;
    }

    .workspace-body {
      padding: 0;
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
      overflow: hidden auto;
    }

    .preview {
      flex: 1;
      min-height: 0;
      max-height: none;
      border-left: 0;
      border-top: 1px solid var(--ink);
    }
  }
</style>
