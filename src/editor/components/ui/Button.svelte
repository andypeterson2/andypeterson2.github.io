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
  type Variant =
    'toolbar' | 'mini' | 'tour' | 'chip' | 'act' | 'link' | 'opt' | 'new' | 'del' | 'toast';

  interface Props extends HTMLButtonAttributes {
    variant: Variant;
    /** Selected/pressed — the family's `.on` modifier. */
    active?: boolean;
    /** Emphasis (`primary` = solid ink) or destructive (`danger`) modifier. */
    tone?: 'primary' | 'danger';
    /** The rendered <button> element, for focus management. */
    el?: HTMLButtonElement;
    class?: string;
    children: Snippet;
  }

  let {
    variant,
    active = false,
    tone,
    el = $bindable(),
    class: cls = '',
    children,
    ...rest
  }: Props = $props();

  const FAMILY: Record<Variant, string> = {
    toolbar: 'btn',
    mini: 'mini',
    tour: 'tbtn',
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

<button bind:this={el} class={classes} class:on={active} {...rest}>
  {@render children()}
</button>
