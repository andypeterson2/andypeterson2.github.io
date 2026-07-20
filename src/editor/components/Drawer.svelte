<script lang="ts">
  // System-6 slide-in dialog: a side panel on desktop, a bottom sheet on mobile.
  import type { Snippet } from 'svelte';
  import { editor } from '../lib/store.svelte';

  let { title, children }: { title: string; children: Snippet } = $props();

  function close() {
    editor.openDrawer = null;
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') close();
  }
</script>

<svelte:window onkeydown={onKey} />

<button class="scrim" aria-label="Close" onclick={close}></button>
<aside class="drawer" role="dialog" aria-label={title}>
  <div class="titlebar">
    <button class="close" aria-label="Close" onclick={close}></button>
    <span class="title">{title}</span>
    <span class="fill"></span>
  </div>
  <div class="body">
    {@render children()}
  </div>
</aside>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    background: rgb(28 27 25 / 28%);
    border: 0;
    padding: 0;
    cursor: pointer;
    z-index: 40;
    animation: fade 0.12s ease;
  }
  .drawer {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: min(400px, 92vw);
    background: var(--paper);
    border-left: 2px solid var(--ink);
    box-shadow: -4px 0 0 rgb(28 27 25 / 50%);
    z-index: 41;
    display: flex;
    flex-direction: column;
    animation: slide 0.16s ease;
  }
  .titlebar {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 24px;
    padding: 0 8px;
    border-bottom: 1px solid var(--ink);
    background-image: repeating-linear-gradient(
      to bottom,
      var(--ink) 0,
      var(--ink) 1px,
      var(--paper) 1px,
      var(--paper) 3px
    );
    flex-shrink: 0;
  }
  .close {
    width: 12px;
    height: 12px;
    background: var(--paper);
    border: 1px solid var(--ink);
    cursor: pointer;
    padding: 0;
  }
  .title {
    font-family: var(--sans);
    font-size: 12.5px;
    font-weight: 700;
    background: var(--paper);
    padding: 0 12px;
    margin: 0 auto;
  }
  .fill {
    width: 12px;
  }
  .body {
    flex: 1;
    overflow: auto;
    padding: 16px;
    font-family: var(--sans);
    color: var(--ink);
  }
  @keyframes fade {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  @keyframes slide {
    from {
      transform: translateX(100%);
    }
    to {
      transform: translateX(0);
    }
  }
  /* 768px matches the editor shell: inside the full-bleed touch layout a right-edge
     side panel looks wrong, so the drawer becomes a bottom sheet across that range. */
  @media (max-width: 768px) {
    .drawer {
      inset: auto 0 0;
      width: 100%;
      max-height: 82vh;
      border-left: 0;
      border-top: 2px solid var(--ink);
      box-shadow: 0 -4px 0 rgb(28 27 25 / 50%);
      animation: slideup 0.16s ease;
    }
    @keyframes slideup {
      from {
        transform: translateY(100%);
      }
      to {
        transform: translateY(0);
      }
    }
  }
</style>
