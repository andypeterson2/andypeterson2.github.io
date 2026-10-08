// Dependency-free drag-to-reorder, as a Svelte action: `use:sortable={{ onReorder }}`
// on a container whose direct children carry `data-sortable` and a
// `[data-drag-handle] draggable="true"` grip. Only the grip starts a drag. A
// container reacts only to grips of its own direct children (others see `from < 0`),
// so nested lists don't cross-talk. Keyboard reordering is `reorderKeydown`, which
// calls the same onReorder.

export interface SortableParam {
  onReorder: (from: number, to: number) => void;
}

/** How close to an edge a drag has to get before the list starts moving under it. */
const EDGE = 56;
/** Pixels per frame at the very edge; it eases in across the EDGE band. */
const MAX_STEP = 18;

/** The nearest ancestor that actually scrolls, which is what a drag has to move. */
function scrollerFor(el: HTMLElement): HTMLElement | null {
  for (let n: HTMLElement | null = el; n; n = n.parentElement) {
    const o = getComputedStyle(n).overflowY;
    if ((o === 'auto' || o === 'scroll') && n.scrollHeight > n.clientHeight) return n;
  }
  return null;
}

/**
 * Keep scrolling while a drag rests near the top or bottom of the list.
 *
 * HTML5 drag-and-drop fires `dragover` only while the pointer moves, so a drag held
 * still at the edge would stall with the drop target off screen. A frame loop carries
 * it instead, and stops as soon as the pointer leaves the band or the drag ends.
 */
function createEdgeScroll() {
  let frame = 0;
  let step = 0;
  let target: HTMLElement | null = null;

  const tick = () => {
    if (!target || step === 0) {
      frame = 0;
      return;
    }
    target.scrollTop += step;
    frame = requestAnimationFrame(tick);
  };

  return {
    /** Called on every dragover: works out which way to go, and how fast. */
    at(el: HTMLElement, clientY: number) {
      target ??= scrollerFor(el);
      if (!target) return;
      const box = target.getBoundingClientRect();
      const above = clientY - box.top;
      const below = box.bottom - clientY;
      step =
        above < EDGE
          ? -Math.ceil(((EDGE - above) / EDGE) * MAX_STEP)
          : below < EDGE
            ? Math.ceil(((EDGE - below) / EDGE) * MAX_STEP)
            : 0;
      if (step !== 0 && frame === 0) frame = requestAnimationFrame(tick);
    },
    stop() {
      step = 0;
      target = null;
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    },
  };
}

/**
 * Keyboard reordering for a focused reorderable item (or its grip). Alt+ArrowUp/
 * Down moves by one; Alt+Home/End jumps to an end. Alt avoids clashing with
 * Enter/Space (activate) and the browser's Alt+←/→ (back/forward). Returns true
 * when it consumed the key, so callers can fall through to their own handler.
 * The keyed re-render drops focus, so we restore it to the moved control (after
 * the DOM settles) — keeping repeated presses working. Pair with an aria-live
 * announcement of the new position.
 */
export function reorderKeydown(
  e: KeyboardEvent,
  index: number,
  length: number,
  move: (from: number, to: number) => void,
): boolean {
  if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return false;
  let to: number;
  switch (e.key) {
    case 'ArrowUp':
      to = index - 1;
      break;
    case 'ArrowDown':
      to = index + 1;
      break;
    case 'Home':
      to = 0;
      break;
    case 'End':
      to = length - 1;
      break;
    default:
      return false;
  }
  e.preventDefault();
  to = Math.max(0, Math.min(length - 1, to));
  if (to !== index) {
    const el = e.currentTarget as HTMLElement | null;
    move(index, to);
    if (el && typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => el.focus());
    }
  }
  return true;
}

export function sortable(container: HTMLElement, param: SortableParam) {
  let onReorder = param.onReorder;
  let from = -1;
  const edge = createEdgeScroll();

  const items = () =>
    Array.from(container.querySelectorAll<HTMLElement>(':scope > [data-sortable]'));
  const indexOfClosest = (target: EventTarget | null) => {
    const el =
      target instanceof HTMLElement ? target.closest<HTMLElement>('[data-sortable]') : null;
    return el ? items().indexOf(el) : -1;
  };

  function onStart(e: DragEvent) {
    const handle = e.target instanceof HTMLElement ? e.target.closest('[data-drag-handle]') : null;
    if (!handle) return;
    const idx = indexOfClosest(handle);
    if (idx < 0) return; // grip belongs to a different (e.g. nested) list
    from = idx;
    const item = items()[idx];
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(idx));
      try {
        e.dataTransfer.setDragImage(item, 8, 8);
      } catch {
        /* setDragImage can throw in some browsers — harmless */
      }
    }
    item.setAttribute('data-dragging', '');
  }

  function onOver(e: DragEvent) {
    if (from < 0) return;
    e.preventDefault();
    edge.at(container, e.clientY);
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    const to = indexOfClosest(e.target);
    items().forEach((el, i) => el.toggleAttribute('data-over', to >= 0 && i === to && i !== from));
  }

  function onDrop(e: DragEvent) {
    if (from < 0) return;
    e.preventDefault();
    const to = indexOfClosest(e.target);
    if (to >= 0 && to !== from) onReorder(from, to);
    clear();
  }

  function clear() {
    edge.stop();
    from = -1;
    for (const el of items()) {
      el.removeAttribute('data-dragging');
      el.removeAttribute('data-over');
    }
  }

  container.addEventListener('dragstart', onStart);
  container.addEventListener('dragover', onOver);
  container.addEventListener('drop', onDrop);
  container.addEventListener('dragend', clear);

  return {
    update(next: SortableParam) {
      onReorder = next.onReorder;
    },
    destroy() {
      container.removeEventListener('dragstart', onStart);
      container.removeEventListener('dragover', onOver);
      container.removeEventListener('drop', onDrop);
      container.removeEventListener('dragend', clear);
    },
  };
}
