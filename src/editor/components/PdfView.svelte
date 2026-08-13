<script lang="ts">
  // Renders a compiled PDF onto width-fitted canvases stacked in a scrollable column
  // — instead of an <iframe> that hands the blob to Chrome's built-in viewer, which
  // ignores the #view=FitH / #zoom=page-width fragment inside an iframe (the page
  // rendered small at the top with dead space below).
  //
  // Two things make this work under the site's strict CSP:
  //  1. We take the compiled Blob and read it with `.arrayBuffer()` — we never
  //     fetch() the blob: URL, which `connect-src` (no blob:) would block.
  //  2. pdf.js v4 is PURE JS (no .wasm), and isEvalSupported:false makes it use its
  //     JS PostScript interpreter — so it needs neither 'unsafe-eval' nor
  //     'wasm-unsafe-eval'. (v5/v6 fall back to a quickjs-eval WASM that the CSP
  //     blocks; v4 is the CSP-clean line.) pdf.js is dynamically imported so its
  //     ~300KB stays out of the initial island bundle; its worker ships as a
  //     same-origin ?url asset (worker-src 'self').
  import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

  let { blob }: { blob: Blob | null } = $props();

  let host = $state<HTMLDivElement>();
  let status = $state<'loading' | 'ready' | 'error'>('loading');
  // Bumped on every (re)render so a stale in-flight render bails instead of
  // appending pages after a newer compile has already started.
  let token = 0;
  let lastWidth = 0;

  async function render(b: Blob, el: HTMLDivElement) {
    const mine = ++token;
    status = 'loading';
    try {
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      const data = await b.arrayBuffer();
      if (mine !== token) return;
      const doc = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
      if (mine !== token) return;

      const width = el.clientWidth || 600;
      lastWidth = width;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const frag = document.createDocumentFragment();
      for (let p = 1; p <= doc.numPages; p += 1) {
        const page = await doc.getPage(p);
        if (mine !== token) return;
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: (width / base.width) * dpr });
        const canvas = document.createElement('canvas');
        canvas.className = 'pv-page';
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('no 2d context');
        await page.render({ canvasContext: ctx, viewport }).promise;
        if (mine !== token) return;
        frag.appendChild(canvas);
      }
      el.replaceChildren(frag);
      status = 'ready';
    } catch {
      if (mine === token) {
        el.replaceChildren();
        status = 'error';
      }
    }
  }

  // (Re)render whenever a new PDF is compiled.
  $effect(() => {
    const b = blob;
    const el = host;
    if (b && el) void render(b, el);
  });

  // Re-render at the new width when the pane resizes past a threshold, so the pages
  // stay crisp and keep filling the width (debounced; small jitters are ignored).
  $effect(() => {
    const el = host;
    if (!el) return;
    lastWidth = el.clientWidth;
    let t: ReturnType<typeof setTimeout>;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      if (Math.abs(w - lastWidth) < 24) return;
      lastWidth = w;
      clearTimeout(t);
      t = setTimeout(() => {
        if (blob && host) void render(blob, host);
      }, 150);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      clearTimeout(t);
    };
  });
</script>

<div class="pv-pages" bind:this={host} aria-busy={status === 'loading'}></div>
{#if status === 'error'}
  <div class="pv-note">Couldn’t render the PDF here — use the download link above.</div>
{/if}

<style>
  .pv-pages {
    flex: 1;
    min-height: 0;
    overflow: auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background: var(--chrome);
  }
  /* Each rendered page fills the pane width (capped so it doesn't balloon on a wide
     monitor), keeps its aspect via height:auto, and reads as paper on the chrome. */
  .pv-pages :global(canvas.pv-page) {
    width: 100%;
    max-width: 850px;
    height: auto;
    background: var(--paper);
    box-shadow: var(--shadow);
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
</style>
