<script lang="ts">
  import { onMount } from 'svelte';
  import UiButton from './ui/Button.svelte';
  import { editor } from '../lib/store.svelte';
  import type { LayoutInfo } from '../lib/types';
  import StorageUsage from './StorageUsage.svelte';

  onMount(() => {
    void editor.loadLayouts();
  });

  // The repo form: link a new layout, or relink `relinking` to another repo.
  const form = $state({
    repo: '',
    path: '',
    track: 'release' as 'release' | 'branch',
    branch: '',
  });
  let relinking = $state<string | null>(null);
  const formReady = $derived(
    /^\S+\/\S+$/.test(form.repo.trim().replace(/^https?:\/\/(www\.)?github\.com\//, '')),
  );
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

  function startRelink(l: LayoutInfo) {
    relinking = l.id;
    editor.layoutCheck = null;
    form.repo = l.source?.repo ?? '';
    form.path = l.source?.path ?? '';
    form.track = l.source?.track ?? 'release';
    form.branch = l.source?.branch ?? '';
  }
  function cancelRelink() {
    relinking = null;
    editor.layoutCheck = null;
  }
  const ago = (iso: string | null | undefined) => {
    if (!iso) return 'not checked yet';
    const mins = Math.round((Date.now() - Date.parse(iso)) / 60000);
    if (mins < 1) return 'checked just now';
    if (mins < 60) return `checked ${String(mins)} min ago`;
    const hours = Math.round(mins / 60);
    return hours < 48
      ? `checked ${String(hours)} h ago`
      : `checked ${String(Math.round(hours / 24))} days ago`;
  };
  const followLabel = (l: LayoutInfo) =>
    l.source?.track === 'branch' ? `branch ${l.source.branch ?? 'default'}` : 'latest release';
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
          {#if l.source && l.versionNo == null}
            <span class="src">
              <a
                href={`https://github.com/${l.source.repo}`}
                target="_blank"
                rel="noopener noreferrer"
                >github.com/{l.source.repo}{l.source.path ? `/${l.source.path}` : ''}</a
              >
              · {followLabel(l)} · {ago(l.source.lastCheckedAt)}
              {#if editor.layoutSyncNote[l.id]}· {editor.layoutSyncNote[l.id]}{/if}
            </span>
            {#if l.own && l.source.lastError}<span class="err">{l.source.lastError}</span>{/if}
          {:else if l.own && !l.builtin && l.versionNo == null}
            <span class="src">Uploaded, not linked to a repository</span>
          {/if}
          {#if l.status !== 'active'}<span class="badge">{l.status}</span>{/if}
          <span class="acts">
            <UiButton variant="link" onclick={() => editor.downloadLayout(l)}>Download</UiButton>
            {#if l.source && l.versionNo == null && (l.own || l.state === 'public')}
              <UiButton variant="link" onclick={() => editor.syncLayout(l.id)}>Check now</UiButton>
            {/if}
            {#if l.own && l.versionNo == null}
              <UiButton variant="link" onclick={() => startRelink(l)}
                >{l.source ? 'Change repo' : 'Link'}</UiButton
              >
            {/if}
            {#if l.own && l.source && l.versionNo == null}
              <UiButton variant="link" onclick={() => editor.unlinkLayout(l.id)}>Unlink</UiButton>
            {/if}
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

{#if editor.layouts.some((l) => l.own && l.source)}
  <div class="btns">
    <UiButton variant="mini" disabled={editor.layoutBusy} onclick={() => editor.syncLayouts()}
      >Check all for updates</UiButton
    >
  </div>
{/if}

<div class="lbl">{relinking ? `Change the repo of ${relinking}` : 'Add a layout from GitHub'}</div>
<div class="upload">
  <label class="field"
    ><span>Repository</span>
    <input class="in" placeholder="owner/repo" bind:value={form.repo} /></label
  >
  <label class="field"
    ><span>Folder</span>
    <input class="in" placeholder="(repository root)" bind:value={form.path} /></label
  >
  <label class="field"
    ><span>Follow</span>
    <select class="in" bind:value={form.track}>
      <option value="release">Latest release</option>
      <option value="branch">A branch</option>
    </select></label
  >
  {#if form.track === 'branch'}
    <label class="field"
      ><span>Branch</span>
      <input class="in" placeholder="(default branch)" bind:value={form.branch} /></label
    >
  {/if}
  <div class="btns">
    <UiButton
      variant="mini"
      disabled={!formReady || editor.layoutBusy}
      onclick={() => editor.sendLayoutRepo(form, false)}>Check</UiButton
    >
    <UiButton
      variant="mini"
      disabled={!formReady || editor.layoutBusy}
      onclick={() => editor.sendLayoutRepo(form, true, relinking)}
      >{relinking ? 'Change repo' : 'Link'}</UiButton
    >
    {#if relinking}<UiButton variant="link" onclick={cancelRelink}>Cancel</UiButton>{/if}
    {#if editor.layoutBusy}<span class="hint">Downloading and compiling test documents…</span>{/if}
  </div>
  {#if editor.layoutCheck}
    {@const c = editor.layoutCheck}
    {#if c.installed}
      <p class="ok">
        Linked {c.installed.name}. It is checked for updates daily; publish it to share it with
        others.
      </p>
    {:else if c.ok && c.missing.length === 0}
      <p class="ok">Passes every check.</p>
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
    Layouts come from public GitHub repositories: a layout.json and its templates, at the root or in
    a folder. Each new release (or commit, if you follow a branch) is test-compiled against sample
    documents and your own résumés before it replaces the last good one.
  </p>
</div>

<StorageUsage show={['layouts']} />

{#if editor.canReviewLayouts}
  {@const trusted = [
    ...new Map(
      editor.layouts.filter((l) => !l.own && l.source?.trusted).map((l) => [l.family, l]),
    ).values(),
  ]}
  {#if trusted.length}
    <div class="lbl">Trusted layouts</div>
    <p class="hint">New versions of these go public on their own when they pass every check.</p>
    {#each trusted as l (l.family)}
      <div class="row">
        <span class="name">{l.name}</span>
        <span class="by">by {l.author} · github.com/{l.source?.repo}</span>
        <span class="acts">
          <UiButton variant="link" onclick={() => editor.trustLayout(l.id, false)}
            >Stop trusting</UiButton
          >
        </span>
      </div>
    {/each}
  {/if}
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
      {#if r.source}
        <p class="hint">
          From github.com/{r.source.repo}. Approving trusts it: later versions that pass every check
          go public without review.
        </p>
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

  .src {
    flex-basis: 100%;
    font-size: var(--text-4xs);
    color: var(--ink-3);
  }

  .src a {
    color: inherit;
  }

  .field {
    display: grid;
    grid-template-columns: 80px 1fr;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
    font-size: var(--text-4xs);
    color: var(--ink-2);
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

  .row .err {
    flex-basis: 100%;
    margin: 0;
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
