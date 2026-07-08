<script lang="ts">
  // The System-6 menubar: real pull-down menus, following the ARIA menubar
  // pattern (menubar → menuitem[aria-haspopup] → menu → menuitem).
  //
  // A menu with no items renders *disabled* rather than as inert text styled to
  // look live. An unimplemented command that looks available is the same class of
  // bug as a demo dot painted red: the interface lying about what it can do.
  import { enabledItems, stepIndex, type MenuDef, type MenuItem } from '../lib/menus';

  let { menus }: { menus: MenuDef[] } = $props();

  let open = $state<number | null>(null);
  let root: HTMLDivElement;
  let titleEls: HTMLButtonElement[] = [];
  let itemEls: HTMLButtonElement[] = [];

  /** Open `mi` and put focus on its first selectable item (keyboard entry). */
  function openMenu(mi: number, focusItems = true) {
    if (!menus[mi]?.items.length) return;
    itemEls = [];
    open = mi;
    if (focusItems) queueMicrotask(() => focusItem(enabledItems(menus[mi])[0] ?? -1));
  }
  function close(restoreFocus = false) {
    const mi = open;
    open = null;
    if (restoreFocus && mi != null) titleEls[mi]?.focus();
  }
  function toggle(mi: number) {
    if (open === mi) close();
    else openMenu(mi, false); // a click already put focus where the user wants it
  }
  function focusItem(ii: number) {
    if (ii >= 0) itemEls[ii]?.focus();
  }
  function focusTitle(from: number, delta: 1 | -1) {
    const selectable = menus.flatMap((m, i) => (m.items.length ? [i] : []));
    const next = stepIndex(selectable, from, delta);
    if (next == null) return;
    titleEls[next]?.focus();
    if (open != null) openMenu(next, false);
  }
  function choose(item: MenuItem) {
    if (item.disabled) return;
    close(true);
    item.onSelect();
  }

  function onTitleKey(e: KeyboardEvent, mi: number) {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      openMenu(mi);
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      focusTitle(mi, e.key === 'ArrowRight' ? 1 : -1);
    } else if (e.key === 'Escape' && open != null) {
      e.stopPropagation();
      close();
    }
  }

  function onMenuKey(e: KeyboardEvent, mi: number) {
    const pool = enabledItems(menus[mi]);
    const cur = itemEls.findIndex((el) => el === document.activeElement);
    if (e.key === 'Escape') {
      // Stop here: the window-level Escape handlers would otherwise end the tour
      // (Editor.svelte) or close a drawer behind the menu.
      e.preventDefault();
      e.stopPropagation();
      close(true);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      focusItem(stepIndex(pool, cur, e.key === 'ArrowDown' ? 1 : -1) ?? -1);
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      focusItem((e.key === 'Home' ? pool[0] : pool[pool.length - 1]) ?? -1);
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      e.stopPropagation();
      focusTitle(mi, e.key === 'ArrowRight' ? 1 : -1);
    } else if (e.key === 'Tab') {
      close();
    }
  }

  /** A press anywhere else dismisses the menu, the way a real pull-down does. */
  function onOutside(e: Event) {
    if (open != null && e.target instanceof Node && !root.contains(e.target)) close();
  }
</script>

<svelte:window onpointerdown={onOutside} />

<div class="menus" role="menubar" aria-label="Editor commands" bind:this={root}>
  {#each menus as menu, mi (menu.title)}
    <div class="wrap">
      <button
        class="menu"
        role="menuitem"
        tabindex={mi === 0 ? 0 : -1}
        disabled={!menu.items.length}
        aria-haspopup={menu.items.length ? 'menu' : undefined}
        aria-expanded={menu.items.length ? open === mi : undefined}
        bind:this={titleEls[mi]}
        onclick={() => toggle(mi)}
        onkeydown={(e) => onTitleKey(e, mi)}>{menu.title}</button
      >
      {#if open === mi}
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <div class="drop" role="menu" aria-label={menu.title} onkeydown={(e) => onMenuKey(e, mi)}>
          {#each menu.items as item, ii (item.label)}
            {#if item.separatorBefore}
              <div class="sep" role="separator"></div>
            {/if}
            <button
              class="item"
              role={item.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
              aria-checked={item.checked}
              aria-keyshortcuts={item.keys}
              tabindex="-1"
              disabled={item.disabled}
              bind:this={itemEls[ii]}
              onclick={() => choose(item)}
            >
              <span class="check" aria-hidden="true">{item.checked ? '✓' : ''}</span>
              <span class="label">{item.label}</span>
              {#if item.accel}
                <span class="accel" aria-hidden="true">{item.accel}</span>
              {/if}
            </button>
          {/each}
        </div>
      {/if}
    </div>
  {/each}
</div>

<style>
  .menus {
    display: flex;
    align-items: center;
    gap: 20px;
  }
  .wrap {
    position: relative;
  }
  .menu {
    font: inherit;
    font-weight: 400;
    color: var(--ink);
    background: none;
    border: 0;
    padding: 0;
    cursor: pointer;
  }
  .menu:disabled {
    color: var(--dim);
    cursor: default;
  }
  .menu[aria-expanded='true'] {
    background: var(--ink);
    color: var(--paper);
    box-shadow: 0 0 0 3px var(--ink);
  }
  .menu:focus-visible,
  .item:focus-visible {
    outline: 2px solid var(--ink);
    outline-offset: 2px;
  }
  .drop {
    position: absolute;
    top: calc(100% + 6px);
    left: -12px;
    z-index: 20;
    min-width: 190px;
    padding: 3px 0;
    background: var(--paper);
    border: 1px solid var(--ink);
    box-shadow: var(--shadow);
  }
  .item {
    display: flex;
    align-items: center;
    width: 100%;
    text-align: left;
    font-family: var(--sans);
    font-size: 13px;
    font-weight: 400;
    color: var(--ink);
    background: none;
    border: 0;
    padding: 5px 14px 5px 6px;
    cursor: pointer;
    white-space: nowrap;
  }

  /* Fixed gutter so every label aligns, toggle or not. */
  .check {
    width: 16px;
    flex: none;
    font-family: var(--mono);
    font-size: 11px;
    line-height: 1;
  }
  .label {
    flex: 1;
  }
  .accel {
    padding-left: 22px;
    font-family: var(--mono);
    font-size: 11px;
    color: var(--dim);
  }
  .item:hover:not(:disabled) .accel,
  .item:focus-visible .accel {
    color: inherit;
    opacity: 0.7;
  }
  .item:disabled .accel {
    opacity: 0.7;
  }
  .item:hover:not(:disabled),
  .item:focus-visible {
    background: var(--ink);
    color: var(--paper);
    outline: none;
  }
  .item:disabled {
    color: var(--dim);
    cursor: default;
  }
  .sep {
    height: 1px;
    margin: 3px 0;
    background: var(--chrome);
  }
</style>
