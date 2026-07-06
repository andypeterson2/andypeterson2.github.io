// Dependency-free drag-to-reorder for a list, via a Svelte action.
//
// Usage: put `use:sortable={{ onReorder }}` on a CONTAINER whose direct children
// carry `data-sortable`, and a `[data-drag-handle] draggable="true"` grip inside
// each child. Only the grip starts a drag, so inputs/clicks are untouched.
//
// Nesting-safe: a container only reacts to a drag whose grip belongs to one of
// ITS direct `[data-sortable]` children (it tracks `from` locally, and every
// other container sees `from < 0` and no-ops). That lets a section list contain
// per-section entry lists without cross-talk. Mouse/pointer only — keyboard
// reordering is a separate follow-up.

export interface SortableParam {
  onReorder: (from: number, to: number) => void;
}

export function sortable(container: HTMLElement, param: SortableParam) {
  let onReorder = param.onReorder;
  let from = -1;

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
