/**
 * Pure breadcrumb and details-bar builders used by BaseLayout.astro.
 * Extracted so the logic can be unit tested without Astro runtime.
 */

export interface Crumb {
  label: string;
  href?: string;
}

export interface Segment {
  text?: string;
  bold: boolean;
  href?: string;
  isHeart?: boolean;
}

export interface RenderedSegment {
  tag: 'a' | 'span';
  class?: string;
  href?: string;
  text?: string;
  isHeart?: boolean;
}

/**
 * Build breadcrumbs from a URL pathname. If customBreadcrumbs is provided,
 * returns them unchanged. Otherwise auto-generates from path segments,
 * converting kebab-case to Title Case. The last segment uses the title
 * prop if provided, and has no href (it's the current page).
 */
export function buildBreadcrumbs(
  pathname: string,
  title?: string,
  customBreadcrumbs?: Crumb[],
): Crumb[] {
  const normalized = pathname.replace(/\/$/, '') || '/';
  const isHome = normalized === '/';

  if (customBreadcrumbs) return customBreadcrumbs;
  if (isHome) return [];

  const segments = normalized.split('/').filter(Boolean);
  const crumbs: Crumb[] = [];
  for (let i = 0; i < segments.length; i++) {
    const isLast = i === segments.length - 1;
    const href = '/' + segments.slice(0, i + 1).join('/') + '/';
    const label =
      isLast && title
        ? title
        : segments[i].replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    crumbs.push({ label, href: isLast ? undefined : href });
  }
  return crumbs;
}

/**
 * Build the details-bar segment array consumed by the renderer.
 * Starts with a heart icon linking home, then pairs of / separators
 * and lowercase labels for each breadcrumb.
 */
export function buildDetailsSegments(breadcrumbs: Crumb[], isHome: boolean): Segment[] {
  if (isHome) {
    return [
      { text: '~', bold: false, href: '/', isHeart: true },
      { text: '/', bold: true },
    ];
  }
  return [
    { text: '~', bold: false, href: '/', isHeart: true },
    ...breadcrumbs.flatMap((crumb) => [
      { text: '/', bold: true } as Segment,
      { text: crumb.label.toLowerCase(), bold: false, href: crumb.href } as Segment,
    ]),
  ];
}

/**
 * Map a segment to rendering props (tag, class, href, text) used by
 * BaseLayout.astro's template.
 */
export function renderSegment(seg: Segment): RenderedSegment {
  if (seg.bold) return { tag: 'span', class: 'crumb-sep', text: seg.text };
  if (seg.isHeart)
    return { tag: 'a', href: seg.href, class: 'crumb-link crumb-heart', isHeart: true };
  if (seg.href) return { tag: 'a', href: seg.href, class: 'crumb-link', text: seg.text };
  return { tag: 'span', text: seg.text };
}
