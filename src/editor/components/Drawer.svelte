<script lang="ts">
  // System-6 slide-in dialog: a side panel on desktop, a bottom sheet on mobile.
  // Modal while it's open (H13): the page behind goes inert, focus starts on the
  // close box, and closing puts focus back on whatever opened it.
  import type { Snippet } from 'svelte';
  import { editor } from '../lib/store.svelte';
  import { tour } from '../lib/tour.svelte';
  import { holdModal } from '../lib/modal';

  let { title, children }: { title: string; children: Snippet } = $props();

  let layer: HTMLDivElement | undefined = $state();
  let closeBtn: HTMLButtonElement | undefined = $state();

  // Not while the tour is showing a drawer: the narrator (Pause, End) must stay
  // live. If the visitor takes over mid-tour, the drawer becomes modal then.
  $effect(() => {
    if (!layer || tour.state !== 'idle') return;
    return holdModal(layer, closeBtn);
  });

  function close() {
    editor.openDrawer = null;
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') close();
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="drawer-layer" bind:this={layer}>
  <!-- The scrim is for pointers; keyboards have Escape and the close box. -->
  <button class="scrim" aria-hidden="true" tabindex="-1" onclick={close}></button>
  <!-- div, not <aside>: a non-interactive landmark element can't carry the interactive
       role="dialog" (Svelte a11y). A generic div takes the dialog role cleanly. -->
  <div class="drawer" role="dialog" aria-modal="true" aria-label={title}>
    <div class="titlebar">
      <button class="close" aria-label="Close" onclick={close} bind:this={closeBtn}></button>
      <span class="title">{title}</span>
      <span class="fill"></span>
    </div>
    <div class="body">
      {@render children()}
    </div>
  </div>
</div>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    background: var(--scrim-soft);
    border: 0;
    padding: 0;
    cursor: pointer;
    z-index: var(--z-drawer);
    animation: fade var(--dur-fast) ease;
  }

  .drawer {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: min(400px, 92vw);
    background: var(--paper);
    border-left: 2px solid var(--ink);
    box-shadow: var(--shadow-drawer);
    z-index: var(--z-drawer);
    display: flex;
    flex-direction: column;
    animation: slide var(--dur) ease;
  }

  /* Mirrors the window titlebar in Editor.svelte so a drawer reads as the same kind of
     System-6 window as the toolbar / document / invite: the 28px Chicago title, 11px
     close/fill, and min-height so the bar grows with it. */
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
    flex-shrink: 0;
  }

  .close {
    width: 11px;
    height: 11px;
    background: var(--paper);
    border: 1px solid var(--ink);
    cursor: pointer;
    padding: 0;
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

  .fill {
    width: 11px;
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
  @media (width <= 768px) {
    /* The sheet's close box is its only visible close: at least 24px on phones (M28). */
    .close {
      width: 24px;
      height: 24px;
    }

    .drawer {
      inset: auto 0 0;
      width: 100%;
      max-height: 82vh;
      border-left: 0;
      border-top: 2px solid var(--ink);
      box-shadow: var(--shadow-drawer-top);
      animation: slideup var(--dur) ease;
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
