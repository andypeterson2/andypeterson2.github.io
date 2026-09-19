<script lang="ts">
  // The tour's narrator: a miniature System-6 window. No scrim,
  // never modal — the app stays usable, and touching it makes the tour yield.
  // `data-tour` marks this subtree as the tour's own chrome: events inside it are
  // controls the reader drives.

  import UiButton from './ui/Button.svelte';
  import { onMount } from 'svelte';
  import { tour } from '../lib/tour.svelte';
  import { editor } from '../lib/store.svelte';
  import { prefersReducedMotion } from '../lib/tour';

  // Phones, and phones held sideways (short but wider than 768): the touch layout.
  // The editor shell's compact @media query must use these same bounds.
  const COMPACT_QUERY = '(max-width: 768px), (max-height: 500px)';

  const done = $derived(tour.state === 'done');
  const paused = $derived(tour.state === 'paused');
  // Signed-in owner: the tour drove their real CV (sandboxed) and has restored it.
  // Demo: nothing is saved, and "Reset demo" is the visitor's fresh start.
  const live = $derived(editor.connected);

  function resetAndClose() {
    editor.requestResetDemo();
    tour.end();
  }

  // The spotlight frame: a rAF loop tracks the current step's target rect and a CSS
  // transition glides the box; pointer-events:none keeps the real element touchable.
  let box = $state<{ x: number; y: number; w: number; h: number } | null>(null);
  const PAD = 6;

  // On phones any fixed narrator edge covers some target (bottom sheet or toolbar),
  // so it sits opposite the current spotlight; desktop keeps the bottom anchor.
  let mobile = $state(false);
  onMount(() => {
    const mq = matchMedia(COMPACT_QUERY);
    const sync = () => (mobile = mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  });
  // Focus moves to the narrator when the tour starts (End and Pause are the next Tab
  // stops); the caption is a live region, so each step is read as it arrives.
  let panel: HTMLElement | undefined = $state();
  $effect(() => {
    panel?.focus({ preventScroll: true });
  });

  const narratorTop = $derived(
    mobile && box ? box.y + box.h / 2 > window.innerHeight * 0.55 : false,
  );

  /**
   * The region the spotlight is allowed to occupy: the viewport, intersected with
   * every clipping ancestor of the target (a scroll container like .doc-scroll, a
   * fixed window). Clamping the frame to this keeps it on the *visible* part of the
   * target and off the fixed chrome — a tall section scrolled inside .doc-scroll no
   * longer paints a frame that runs off-screen or across the top/bottom bars.
   */
  function clipBoundsFor(el: Element) {
    let left = 0;
    let top = 0;
    let right = window.innerWidth;
    let bottom = window.innerHeight;
    for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
      const s = getComputedStyle(node);
      if (s.overflow === 'visible' && s.overflowX === 'visible' && s.overflowY === 'visible')
        continue;
      const r = node.getBoundingClientRect();
      left = Math.max(left, r.left);
      top = Math.max(top, r.top);
      right = Math.min(right, r.right);
      bottom = Math.min(bottom, r.bottom);
    }
    return { left, top, right, bottom };
  }

  $effect(() => {
    if (!tour.active) {
      box = null;
      return;
    }
    let alive = true;
    let scrolledKey = '';
    const reduced = prefersReducedMotion();
    const tick = () => {
      if (!alive) return;
      // At/below 768px a step can override its target (the desktop one may be hidden in
      // the ☰ menu); read `mobile` fresh each frame so rotation re-resolves it too.
      const sel = mobile && tour.spotMobile ? tour.spotMobile : tour.spot;
      const el = sel ? document.querySelector(sel) : null;
      if (el) {
        const r = el.getBoundingClientRect();
        // Clamp the padded rect to the visible region so the frame never spills over
        // the fixed chrome; a zero-size (hidden) target draws nothing.
        const c = clipBoundsFor(el);
        const x1 = Math.max(r.left - PAD, c.left);
        const y1 = Math.max(r.top - PAD, c.top);
        const x2 = Math.min(r.right + PAD, c.right);
        const y2 = Math.min(r.bottom + PAD, c.bottom);
        box =
          r.width > 0 && r.height > 0 && x2 > x1 && y2 > y1
            ? { x: x1, y: y1, w: x2 - x1, h: y2 - y1 }
            : null;
        const key = `${sel}#${tour.index}`; // glide to each step's target once
        if (scrolledKey !== key) {
          scrolledKey = key;
          el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
        }
      } else {
        box = null; // the step hasn't materialised its target yet
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return () => {
      alive = false;
    };
  });
</script>

{#if box}
  <div
    class="spotlight"
    style:--spot={editor.accentHex}
    style:transform="translate({box.x}px, {box.y}px)"
    style:width="{box.w}px"
    style:height="{box.h}px"
    aria-hidden="true"
  ></div>
{/if}

{#if tour.state !== 'idle'}
  <section
    class="tour floating-panel"
    class:at-top={narratorTop}
    data-tour
    aria-label="Guided tour"
    tabindex="-1"
    bind:this={panel}
  >
    <div class="tbar">
      <button class="tclose" aria-label="End tour" onclick={() => tour.end()}></button>
      <span class="ttl">{done ? 'Tour complete' : 'Guided tour'}</span>
      <span class="tfill"></span>
    </div>
    <div class="tbody">
      <div class="said" aria-live="polite">
        {#if done}
          {#if live}
            <p class="cap">
              That's the tour. You're back on your own CV — the tour changed nothing, and nothing
              was saved.
            </p>
          {:else}
            <p class="cap">That was the tour. The demo is yours now — nothing you do is saved.</p>
          {/if}
        {:else}
          <p class="cap">{tour.caption}</p>
          {#if paused}
            <p class="wheel">Paused — you have the wheel.</p>
          {/if}
        {/if}
      </div>
      {#if done}
        <div class="row">
          <span class="count">{tour.total} of {tour.total}</span>
          <span class="gap"></span>
          {#if !live}
            <UiButton variant="tour" onclick={resetAndClose}>↺ Reset demo</UiButton>
          {/if}
          <UiButton variant="tour" onclick={() => tour.end()}>Close</UiButton>
        </div>
      {:else}
        <div class="row">
          <span class="count">{tour.index + 1} of {tour.total}</span>
          <span class="gap"></span>
          {#if paused}
            <UiButton variant="tour" onclick={() => tour.resume()}>▶ Resume</UiButton>
          {:else if !tour.manual}
            <UiButton variant="tour" onclick={() => tour.takeover()}>⏸ Pause</UiButton>
          {/if}
          {#if paused || tour.manual}
            <UiButton variant="tour" onclick={() => tour.next()}>Next ▸</UiButton>
          {/if}
          <UiButton variant="tour" onclick={() => tour.end()}>✕ End</UiButton>
        </div>
      {/if}
    </div>
  </section>
{/if}

<style>
  /* Position, paper, border, hard shadow and mono chrome all come from the shared
     .floating-panel primitive — the same one the save toast uses. */
  .tour {
    width: min(92vw, 430px);
  }

  /* Dynamic anchor (mobile only — see narratorTop): the narrator jumps to the top
     edge when the current spotlight sits low, so it never covers what it frames. */
  .tour.at-top {
    top: 8px;
    bottom: auto;
  }

  .tbar {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 21px;
    padding: 0 6px;
    border-bottom: 1px solid var(--ink);
    background-image: repeating-linear-gradient(
      to bottom,
      var(--ink) 0,
      var(--ink) 1px,
      var(--paper) 1px,
      var(--paper) 3px
    );
  }

  .tclose {
    width: 11px;
    height: 11px;
    background: var(--paper);
    border: 1px solid var(--ink);
    padding: 0;
    cursor: pointer;
    flex: none;
  }

  .ttl {
    font-family: var(--sans);
    font-size: var(--text-4xs);
    font-weight: 700;
    background: var(--paper);
    padding: 0 10px;
    margin: 0 auto;
  }

  .tfill {
    width: 11px;
  }

  .tbody {
    padding: 10px 12px 11px;
  }

  .cap {
    font-family: var(--sans);
    font-size: var(--text-3xs);
    line-height: 1.45;
    margin: 0;
    text-wrap: balance;
  }

  .wheel {
    font-family: var(--mono);
    font-size: var(--text-4xs);
    color: var(--ink-3);
    margin: 6px 0 0;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 10px;
  }

  .count {
    font-family: var(--mono);
    font-size: var(--text-4xs);
    font-variant-numeric: tabular-nums;
    color: var(--dim-text);
  }

  .gap {
    flex: 1;
  }

  /* .tbtn (the tour family, focus ring included) is styled globally as .ui.tbtn. */

  .tclose:focus-visible {
    outline: 2px solid var(--ink);
    outline-offset: 1px;
  }

  /* the "look here" spotlight — an accent frame that glides to each step's target */
  .spotlight {
    position: fixed;
    top: 0;
    left: 0;
    z-index: var(--z-overlay); /* above the drawers (41), below the narrator (100) */
    pointer-events: none;
    border: 2px solid var(--spot, var(--ink));
    border-radius: var(--radius-sm);
    will-change: transform, width, height;
    box-shadow:
      0 0 0 3px color-mix(in srgb, var(--spot, var(--ink)) 24%, transparent),
      0 3px 16px rgb(28 27 25 / 20%);
    transition:
      transform 0.32s cubic-bezier(0.22, 0.68, 0.24, 1),
      width 0.32s cubic-bezier(0.22, 0.68, 0.24, 1),
      height 0.32s cubic-bezier(0.22, 0.68, 0.24, 1);
    animation: spot-pulse 1.9s ease-in-out infinite;
  }

  @keyframes spot-pulse {
    0%,
    100% {
      box-shadow:
        0 0 0 3px color-mix(in srgb, var(--spot, var(--ink)) 24%, transparent),
        0 3px 16px rgb(28 27 25 / 20%);
    }

    50% {
      box-shadow:
        0 0 0 7px color-mix(in srgb, var(--spot, var(--ink)) 9%, transparent),
        0 3px 16px rgb(28 27 25 / 20%);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .spotlight {
      transition: none;
      animation: none;
    }
  }
</style>
