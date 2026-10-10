<script lang="ts">
  // The account's storage against its limits: a bar for bytes, then the counts.
  import { onMount } from 'svelte';
  import { editor } from '../lib/store.svelte';

  let { show = ['profiles', 'layouts'] }: { show?: ('profiles' | 'layouts')[] } = $props();

  onMount(() => {
    void editor.loadUsage();
  });

  const fmt = (b: number) =>
    b < 1024 * 1024
      ? `${String(Math.max(1, Math.round(b / 1024)))} KB`
      : `${(b / 1048576).toFixed(1)} MB`;
  const u = $derived(editor.usage);
  const share = $derived(u ? Math.min(1, u.bytes.used / u.bytes.limit) : 0);
</script>

{#if u && !u.unlimited}
  <div class="usage" aria-label="Storage used by this account">
    <div class="line">
      <span>Storage</span>
      <span class="num">{fmt(u.bytes.used)} of {fmt(u.bytes.limit)}</span>
    </div>
    <div
      class="bar"
      role="progressbar"
      aria-valuemin="0"
      aria-valuemax="100"
      aria-valuenow={Math.round(share * 100)}
    >
      <span class="fill" class:full={share >= 0.9} style:width={`${String(share * 100)}%`}></span>
    </div>
    <div class="line sub">
      <span>Resumes {fmt(u.bytes.content)} · layouts {fmt(u.bytes.layouts)}</span>
    </div>
    {#if show.includes('profiles')}
      <div class="line sub">
        <span>Resumes</span><span class="num">{u.profiles.used} of {u.profiles.limit}</span>
      </div>
    {/if}
    {#if show.includes('layouts')}
      <div class="line sub">
        <span>Uploaded layouts</span><span class="num">{u.layouts.used} of {u.layouts.limit}</span>
      </div>
    {/if}
    {#if share >= 0.9}
      <p class="warn">
        Nearly full. Delete saved versions, resumes or layouts you no longer need to keep saving.
      </p>
    {/if}
  </div>
{/if}

<style>
  .usage {
    border: 1px solid var(--ink);
    border-radius: var(--radius);
    padding: 9px 11px;
    margin-top: 16px;
    background: var(--paper);
    font-size: var(--text-3xs);
  }

  .line {
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }

  .sub {
    font-size: var(--text-4xs);
    color: var(--ink-3);
    margin-top: 4px;
  }

  .num {
    font-variant-numeric: tabular-nums;
  }

  .bar {
    display: block;
    height: 8px;
    border: 1px solid var(--ink);
    border-radius: var(--radius);
    margin: 6px 0 2px;
    overflow: hidden;
  }

  .fill {
    display: block;
    height: 100%;
    background: var(--ink);
  }

  .fill.full {
    background: var(--color-warning);
  }

  .warn {
    font-size: var(--text-4xs);
    color: var(--color-warning);
    margin: 6px 0 0;
  }
</style>
