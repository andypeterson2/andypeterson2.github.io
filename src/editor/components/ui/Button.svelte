<script lang="ts">
  /**
   * The editor's shared button primitive. Each `variant` maps to one of the
   * button families defined in lib/styles.css (under `.ui.<family>`); `active`
   * renders the family's `.on` selected/pressed state; `tone` is the
   * emphasis/destructive modifier where the family has one. Family-specific
   * modifiers (sym-toggle, add, go, sm, x, …) pass through `class`.
   *
   * Everything a native button takes (onclick, title, aria-*, data-*, type,
   * disabled) passes through; bind the element itself via `bind:el`.
   */
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';

  type Variant =
    | 'toolbar' // .btn — the toolbar-window actions
    | 'mini' // .mini — compact entry/personal editing actions
    | 'tour' // .tbtn — the tour bubble's mono controls
    | 'chip' // .chip — pill chips (history versions)
    | 'act' // .act — drawer action rows
    | 'link' // .link — inline text-link button
    | 'opt' // .opt — full-width option row (profile/variant pickers)
    | 'new' // .new — dashed "create new" affordance
    | 'del' // .del — accent-bordered destructive action
    | 'toast'; // .st-btn — save-toast mono buttons

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

  const classes = $derived(
    ['ui', FAMILY[variant], tone, cls].filter(Boolean).join(' '),
  );
</script>

<button bind:this={el} class={classes} class:on={active} {...rest}>
  {@render children()}
</button>
