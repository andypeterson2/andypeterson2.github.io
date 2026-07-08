// The menubar's data model. Kept out of the component so Editor.svelte can
// declare its menus as plain data and MenuBar.svelte owns only the behaviour
// (open/close, roving focus, the ARIA menubar pattern).

export interface MenuItem {
  label: string;
  onSelect: () => void;
  /** Dimmed and unselectable — say so rather than offering a dead command. */
  disabled?: boolean;
  /** Draw a rule above this item. */
  separatorBefore?: boolean;
  /**
   * Present → the item is a toggle, rendered with a ✓ gutter and announced as a
   * menuitemcheckbox. Absent → a plain command. (A checkmark faked into the label
   * would leave screen readers with no idea the thing has a state.)
   */
  checked?: boolean;
  /** Keyboard equivalent, shown right-aligned (e.g. "⌘Z"). Purely a visual hint. */
  accel?: string;
  /** The same shortcut in aria-keyshortcuts form (e.g. "Meta+Z Control+Z"). */
  keys?: string;
}

export interface MenuDef {
  title: string;
  /** An empty menu renders disabled: an unimplemented menu must not look live. */
  items: MenuItem[];
}

/** Indices of the items a keyboard user can land on. */
export function enabledItems(menu: MenuDef): number[] {
  return menu.items.flatMap((item, i) => (item.disabled ? [] : [i]));
}

/**
 * Step `from` to the next selectable index in `pool`, wrapping. `from` may be
 * -1 (nothing focused yet) or an index that isn't itself selectable.
 */
export function stepIndex(pool: number[], from: number, delta: 1 | -1): number | null {
  if (!pool.length) return null;
  const at = pool.indexOf(from);
  if (at === -1) return delta === 1 ? pool[0] : pool[pool.length - 1];
  return pool[(at + delta + pool.length) % pool.length];
}
