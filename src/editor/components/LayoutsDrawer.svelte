<script lang="ts">
  import { onMount } from 'svelte';
  import UiButton from './ui/Button.svelte';
  import { editor } from '../lib/store.svelte';
  import type { LayoutInfo } from '../lib/types';
  import StorageUsage from './StorageUsage.svelte';

  onMount(() => {
    void editor.loadLayouts();
  });

  const MAX_ZIP_BYTES = 25 * 1024 * 1024;
  let file = $state<File | null>(null);
  let fileError = $state<string | null>(null);
  const notes = $state<Record<string, string>>({});

  const groups = $derived([
    { title: 'Built in', rows: editor.layouts.filter((l) => l.builtin) },
    { title: 'Yours', rows: editor.layouts.filter((l) => l.own) },
    { title: 'Shared by others', rows: editor.layouts.filter((l) => !l.builtin && !l.own) },
  ]);
  const current = $derived(editor.layouts.find((l) => l.id === editor.defaultLayout) ?? null);
  const usable = (l: LayoutInfo) =>
    l.status === 'active' && (l.builtin || l.own || l.state === 'public');
  const label = (l: LayoutInfo) => (l.versionNo ? `${l.name} v${String(l.versionNo)}` : l.name);

  function pick(e: Event) {
    const f = (e.currentTarget as HTMLInputElement).files?.[0] ?? null;
    editor.layoutCheck = null;
    fileError = null;
    if (f && !f.name.toLowerCase().endsWith('.zip')) fileError = 'Choose a .zip file.';
    else if (f && f.size > MAX_ZIP_BYTES) fileError = 'The zip is larger than 25 MB.';
    file = fileError ? null : f;
  }
</script>

<!-- Signed in only, like the Layout control that opens it. -->
<p class="note">
  The LaTeX template used to compile the PDF. The one you pick is your default; a resume can choose
  its own in Variants.
</p>

{#if current?.updateAvailable}
  <div class="banner">
    A newer version of {current.name} is available.
    <UiButton variant="link" onclick={() => editor.chooseLayout(current.updateAvailable ?? '')}
      >Use it</UiButton
    >
  </div>
{/if}
{#if editor.layoutWarnings.length}
  <div class="warn" role="status">
    <strong>Test compile on your résumés:</strong>
    <ul>
      {#each editor.layoutWarnings as w (w)}<li>{w}</li>{/each}
    </ul>
  </div>
{/if}

{#if editor.layouts.length === 0}
  <p class="empty">No layouts available.</p>
{/if}
{#each groups as g (g.title)}
  {#if g.rows.length}
    <div class="lbl">{g.title}</div>
    <div class="list">
      {#each g.rows as l (l.id)}
        <div class="row" class:on={editor.defaultLayout === l.id}>
          <button
            class="pick"
            disabled={!usable(l)}
            onclick={() => editor.chooseLayout(l.id)}
            aria-pressed={editor.defaultLayout === l.id}
          >
            <span class="dot" class:sel={editor.defaultLayout === l.id}></span>
            <span class="name">{label(l)}</span>
            {#if l.author && !l.own}<span class="by">by {l.author}</span>{/if}
          </button>
          {#if !l.builtin && l.state !== 'public'}<span class="badge">{l.state}</span>{/if}
          {#if l.status !== 'active'}<span class="badge">{l.status}</span>{/if}
          <span class="acts">
            <UiButton variant="link" onclick={() => editor.downloadLayout(l)}>Download</UiButton>
            {#if l.own && l.versionNo == null && l.status === 'active'}
              <UiButton
                variant="link"
                disabled={editor.layoutBusy}
                onclick={() => editor.publishLayout(l.id)}>Publish</UiButton
              >
            {/if}
            {#if l.own && (l.state === 'public' || l.state === 'pending')}
              <UiButton variant="link" onclick={() => editor.unpublishLayout(l.id)}
                >Unpublish</UiButton
              >
            {/if}
            {#if l.own && (l.versionNo == null || l.state === 'pending' || l.state === 'rejected')}
              <UiButton variant="link" onclick={() => editor.deleteLayout(l.id)}>Delete</UiButton>
            {/if}
          </span>
        </div>
      {/each}
    </div>
  {/if}
{/each}

<div class="lbl">Upload a layout</div>
<div class="upload">
  <input
    class="in"
    type="file"
    accept=".zip,application/zip"
    aria-label="Layout zip"
    onchange={pick}
  />
  {#if fileError}<p class="err">{fileError}</p>{/if}
  <div class="btns">
    <UiButton
      variant="mini"
      disabled={!file || editor.layoutBusy}
      onclick={() => file && editor.sendLayoutZip(file, false)}>Check</UiButton
    >
    <UiButton
      variant="mini"
      disabled={!file || editor.layoutBusy || !editor.layoutCheck?.ok}
      onclick={() => file && editor.sendLayoutZip(file, true)}>Install</UiButton
    >
    {#if editor.layoutBusy}<span class="hint">Compiling test documents…</span>{/if}
  </div>
  {#if editor.layoutCheck}
    {@const c = editor.layoutCheck}
    {#if c.installed}
      <p class="ok">Installed {c.installed.name}. Publish it to share it with others.</p>
    {:else if c.ok && c.missing.length === 0}
      <p class="ok">Ready to install.</p>
    {:else}
      {#if c.error}<p class="err">{c.error}</p>{/if}
      {#if c.missing.length}
        <ul class="missing">
          {#each c.missing as m (m)}<li>{m}</li>{/each}
        </ul>
      {/if}
    {/if}
  {/if}
  <p class="hint">
    A zip with a layout.json and its templates. It is test-compiled against sample documents and
    your own résumés before anything is installed.
  </p>
</div>

<StorageUsage show={['layouts']} />

{#if editor.canReviewLayouts}
  <div class="lbl">Waiting for review</div>
  {#if editor.layoutReviews.length === 0}
    <p class="empty">Nothing to review.</p>
  {/if}
  {#each editor.layoutReviews as r (r.id)}
    <div class="review">
      <div class="name">{label(r)} <span class="by">by {r.author}</span></div>
      <p class="hint">
        Slowest compile {r.compileMs ?? '?'} ms.
        {#each r.report?.checks.filter((c) => !c.ok) ?? [] as c (c.name)}{c.name}: {c.detail}.
        {/each}
      </p>
      {#if r.warnings.length}
        <ul class="missing">
          {#each r.warnings as w (w)}<li>{w}</li>{/each}
        </ul>
      {/if}
      <input
        class="in"
        placeholder="Note to the author (optional)"
        aria-label={`Review note for ${r.name}`}
        bind:value={notes[r.id]}
      />
      <div class="btns">
        <UiButton
          variant="mini"
          onclick={() => editor.reviewLayout(r.id, 'approve', notes[r.id] ?? '')}>Approve</UiButton
        >
        <UiButton
          variant="mini"
          onclick={() => editor.reviewLayout(r.id, 'reject', notes[r.id] ?? '')}>Reject</UiButton
        >
      </div>
    </div>
  {/each}
{/if}

<style>
  .note {
    font-size: var(--text-4xs);
    color: var(--ink-3);
    margin: 0 0 16px;
  }

  /* .link comes from the shared button families. */

  .empty {
    font-size: var(--text-3xs);
    color: var(--ink-3);
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .lbl {
    font-size: var(--text-4xs);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--ink-2);
    margin: 16px 0 8px;
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 10px;
    background: var(--paper);
    border: 1px solid var(--ink);
    border-radius: var(--radius);
    padding: 9px 11px;
    font-family: var(--sans);
  }

  .pick {
    display: flex;
    align-items: center;
    gap: 10px;
    text-align: left;
    background: none;
    border: 0;
    padding: 0;
    cursor: pointer;
    font-family: var(--sans);
    color: var(--ink);
  }

  .pick:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .by,
  .hint {
    font-size: var(--text-4xs);
    color: var(--ink-3);
  }

  .acts {
    display: flex;
    gap: 8px;
    margin-left: auto;
  }

  .banner,
  .warn,
  .review,
  .upload {
    font-size: var(--text-3xs);
    border: 1px solid var(--ink);
    border-radius: var(--radius);
    padding: 9px 11px;
    margin-bottom: 10px;
    background: var(--paper);
  }

  .btns {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 8px 0;
  }

  .missing {
    margin: 6px 0;
    padding-left: 18px;
    font-size: var(--text-4xs);
  }

  .ok {
    font-size: var(--text-3xs);
    margin: 6px 0;
  }

  .err {
    font-size: var(--text-3xs);
    color: var(--color-warning);
    margin: 6px 0;
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

  .row.on {
    background: var(--chrome-hi);
  }

  .dot {
    width: 10px;
    height: 10px;
    border-radius: var(--radius-round);
    border: 1px solid var(--ink);
    background: var(--paper);
    flex-shrink: 0;
  }

  .dot.sel {
    background: var(--ink);
  }

  .name {
    font-size: var(--text-3xs);
    font-weight: 600;
  }

  .badge {
    font-size: var(--text-4xs);
    text-transform: uppercase;
    color: var(--ink);
  }
</style>
