<script lang="ts">
  // The tour's narrator: a miniature System-6 window, not a coach-mark. No scrim,
  // no spotlight cut-out, never modal — the app underneath stays fully usable,
  // because the moment you touch it the tour yields (see Editor.svelte's handlers).
  //
  // `data-tour` marks this subtree as the tour's own chrome: events inside it are
  // controls, not interruptions.
  import { onMount } from 'svelte';
  import { tour } from '../lib/tour.svelte';
  import { editor } from '../lib/store.svelte';
  import { prefersReducedMotion } from '../lib/tour';

  const done = $derived(tour.state === 'done');
  const paused = $derived(tour.state === 'paused');
  // Signed-in owner: the tour drove their real CV (sandboxed) and has restored it.
  // Demo: nothing is saved, and "Reset demo" is the visitor's fresh start.
  const live = $derived(editor.connected);

  function resetAndClose() {
    editor.resetDemo();
    tour.end();
  }

  // The spotlight: while the tour is active, glide the page to the current step's
  // target and frame it. A rAF loop tracks the element's viewport rect so the frame
  // follows it through scrolls, typing, and drawers opening; the box's CSS transition
  // turns each rect change into a smooth glide (pointer-events:none, so it never
  // blocks the app — touching the real element still yields the tour). Absent target
  // or reduced motion is handled gracefully.
  let box = $state<{ x: number; y: number; w: number; h: number } | null>(null);
  const PAD = 6;

  // On phones a fixed narrator edge can't win: anchored at the bottom it covers the
  // variant drawer's bottom sheet (step 5); anchored at the top it covers the
  // toolbar targets it points at (variant, export). So place it opposite the current
  // spotlight — top when the framed target sits in the lower part of the screen,
  // bottom otherwise. Desktop keeps the shared bottom anchor.
  let mobile = $state(false);
  onMount(() => {
    const mq = matchMedia('(max-width: 640px)');
    const sync = () => (mobile = mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
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
      const sel = tour.spot;
      const el = sel ? document.querySelector(sel) : null;
      if (el) {
        const r = el.getBoundingClientRect();
        // Clamp the padded target rect to the region where it can actually be seen,
        // so the frame never spills off-screen or over the fixed chrome; a zero-size
        // (hidden / not-yet-rendered) target draws nothing.
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
    style="--spot: {editor.accentHex}; transform: translate({box.x}px, {box.y}px); width: {box.w}px; height: {box.h}px;"
    aria-hidden="true"
  ></div>
{/if}

{#if tour.state !== 'idle'}
  <section
    class="tour floating-panel"
    class:at-top={narratorTop}
    data-tour
    role="region"
    aria-label="Guided tour"
  >
    <div class="tbar">
      <button class="tclose" aria-label="End tour" onclick={() => tour.end()}></button>
      <span class="ttl">{done ? 'Tour complete' : 'Guided tour'}</span>
      <span class="tfill"></span>
    </div>
    <div class="tbody">
      {#if done}
        {#if live}
          <p class="cap">
            That's the tour. You're back on your own CV — the tour changed nothing, and nothing was
            saved.
          </p>
          <div class="row">
            <span class="count">{tour.total} of {tour.total}</span>
            <span class="gap"></span>
            <button class="tbtn" onclick={() => tour.end()}>Close</button>
          </div>
        {:else}
          <p class="cap">That was the tour. The demo is yours now — nothing you do is saved.</p>
          <div class="row">
            <span class="count">{tour.total} of {tour.total}</span>
            <span class="gap"></span>
            <button class="tbtn" onclick={resetAndClose}>↺ Reset demo</button>
            <button class="tbtn" onclick={() => tour.end()}>Close</button>
          </div>
        {/if}
      {:else}
        <p class="cap">{tour.caption}</p>
        {#if paused}
          <p class="wheel">Paused — you have the wheel.</p>
        {/if}
        <div class="row">
          <span class="count">{tour.index + 1} of {tour.total}</span>
          <span class="gap"></span>
          {#if paused}
            <button class="tbtn" onclick={() => tour.resume()}>▶ Resume</button>
          {:else if !tour.manual}
            <button class="tbtn" onclick={() => tour.takeover()}>⏸ Pause</button>
          {/if}
          {#if paused || tour.manual}
            <button class="tbtn" onclick={() => tour.next()}>Next ▸</button>
          {/if}
          <button class="tbtn" onclick={() => tour.end()}>✕ End</button>
        </div>
      {/if}
    </div>
  </section>
{/if}

<style>
  /* Position, paper, border, hard shadow and mono chrome all come from the shared
     .floating-panel primitive (lib/styles.css) — the same one the save toast uses. */
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
    font-size: 11.5px;
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
    font-size: 13px;
    line-height: 1.45;
    margin: 0;
    text-wrap: balance;
  }
  .wheel {
    font-family: var(--mono);
    font-size: 11.5px;
    color: #57554f;
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
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    color: var(--dim);
  }
  .gap {
    flex: 1;
  }
  .tbtn {
    font-family: var(--mono);
    font-size: 12px;
    color: var(--ink);
    background: var(--chrome-hi);
    border: 1px solid var(--ink);
    padding: 2px 8px;
    cursor: pointer;
  }
  .tbtn:hover {
    background: var(--ink);
    color: var(--paper);
  }
  .tbtn:focus-visible,
  .tclose:focus-visible {
    outline: 2px solid var(--ink);
    outline-offset: 1px;
  }

  /* the "look here" spotlight — an accent frame that glides to each step's target */
  .spotlight {
    position: fixed;
    top: 0;
    left: 0;
    z-index: 50; /* above the drawers (41), below the narrator (100) */
    pointer-events: none;
    border: 2px solid var(--spot, var(--ink));
    border-radius: 3px;
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
