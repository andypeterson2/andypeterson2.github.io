<script lang="ts">
  /**
   * The editor's shared button primitive. Each `variant` maps to one of the
   * button families defined in the editor stylesheet (under `.ui.<family>`); `active`
   * renders the family's `.on` selected/pressed state; `tone` is the
   * emphasis/destructive modifier where the family has one. Family-specific
   * modifiers (sym-toggle, add, go, sm, x, …) pass through `class`.
   *
   * Everything a native button takes (onclick, title, aria-*, data-*, type,
   * disabled) passes through; bind the element itself via `bind:el`.
   */
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';

  // One per button family; FAMILY maps each to its `.ui.<family>` class.
  type Variant = 'toolbar' | 'mini' | 'chip' | 'act' | 'link' | 'opt' | 'new' | 'del' | 'toast';

  interface Props extends HTMLButtonAttributes {
    variant: Variant;
    /** Selected — the family's `.on` modifier. Visual only: a button that opens a
     *  panel is not "pressed", so say `pressed` or `aria-expanded` for that. */
    active?: boolean;
    /** A true two-state control: announced as aria-pressed. */
    pressed?: boolean;
    /** Emphasis (`primary` = solid ink) or destructive (`danger`) modifier. */
    tone?: 'primary' | 'danger';
    /** The rendered <button> element, for focus management. */
    el?: HTMLButtonElement;
    class?: string;
    children: Snippet;
  }

  let {
    variant,
    active,
    pressed,
    tone,
    disabled,
    onclick,
    el = $bindable(),
    class: cls = '',
    children,
    ...rest
  }: Props = $props();

  /**
   * Out of reach, the way the rest of the site says it: `aria-disabled` rather than
   * the native attribute, because a natively disabled button leaves the tab order and
   * answers no hover, so the `title` explaining why would be unreadable for exactly
   * the people most likely to need it. The press is swallowed here instead.
   */
  function press(e: MouseEvent) {
    if (disabled) {
      e.preventDefault();
      return;
    }
    onclick?.(e as MouseEvent & { currentTarget: EventTarget & HTMLButtonElement });
  }

  const FAMILY: Record<Variant, string> = {
    toolbar: 'btn',
    mini: 'mini',
    chip: 'chip',
    act: 'act',
    link: 'link',
    opt: 'opt',
    new: 'new',
    del: 'del',
    toast: 'st-btn',
  };

  const classes = $derived(['ui', FAMILY[variant], tone, cls].filter(Boolean).join(' '));
</script>

<button
  bind:this={el}
  class={classes}
  class:on={active || pressed}
  aria-pressed={pressed}
  aria-disabled={disabled}
  onclick={press}
  {...rest}
>
  {@render children()}
</button>
