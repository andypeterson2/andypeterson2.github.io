/**
 * Unit tests for pure breadcrumb builders extracted from BaseLayout.astro.
 */
import { describe, test, expect } from 'vitest';
import {
  buildBreadcrumbs,
  buildDetailsSegments,
  renderSegment,
  type Crumb,
} from '../../src/lib/breadcrumbs';

describe('buildBreadcrumbs', () => {
  test('root path returns empty breadcrumbs', () => {
    expect(buildBreadcrumbs('/')).toEqual([]);
  });

  test('passes through custom breadcrumbs when provided', () => {
    const custom: Crumb[] = [{ label: 'Custom', href: '/custom/' }];
    expect(buildBreadcrumbs('/ignored/', undefined, custom)).toEqual(custom);
  });

  test('single segment path without title uses Title Case conversion', () => {
    const result = buildBreadcrumbs('/about/');
    expect(result).toEqual([{ label: 'About', href: undefined }]);
  });

  test('single segment path uses title override when provided', () => {
    const result = buildBreadcrumbs('/about/', 'About Me');
    expect(result).toEqual([{ label: 'About Me', href: undefined }]);
  });

  test('multi-segment path links intermediate segments and unlinks the last', () => {
    const result = buildBreadcrumbs('/projects/quantum-video-chat/');
    expect(result).toEqual([
      { label: 'Projects', href: '/projects/' },
      { label: 'Quantum Video Chat', href: undefined },
    ]);
  });

  test('kebab-case segments convert to Title Case with spaces', () => {
    const result = buildBreadcrumbs('/projects/latex-resume-editor/');
    expect(result[1].label).toBe('Latex Resume Editor');
  });

  test('last segment uses title when provided even for deep paths', () => {
    const result = buildBreadcrumbs('/projects/foo-bar/', 'Foo Bar Project');
    expect(result[1].label).toBe('Foo Bar Project');
    expect(result[1].href).toBeUndefined();
  });

  test('trailing slash is stripped consistently', () => {
    expect(buildBreadcrumbs('/about')).toEqual(buildBreadcrumbs('/about/'));
  });
});

describe('buildDetailsSegments', () => {
  test('home path returns heart + single slash', () => {
    const result = buildDetailsSegments([], true);
    expect(result).toEqual([
      { text: '~', bold: false, href: '/', isHeart: true },
      { text: '/', bold: true },
    ]);
  });

  test('non-home path returns heart + slash/label pairs', () => {
    const breadcrumbs: Crumb[] = [{ label: 'About', href: undefined }];
    const result = buildDetailsSegments(breadcrumbs, false);
    expect(result).toEqual([
      { text: '~', bold: false, href: '/', isHeart: true },
      { text: '/', bold: true },
      { text: 'about', bold: false, href: undefined },
    ]);
  });

  test('lowercases breadcrumb labels in details segments', () => {
    const breadcrumbs: Crumb[] = [{ label: 'PROJECTS', href: '/projects/' }];
    const result = buildDetailsSegments(breadcrumbs, false);
    expect(result[2].text).toBe('projects');
  });

  test('multi-crumb path produces alternating slash/label segments', () => {
    const breadcrumbs: Crumb[] = [
      { label: 'Projects', href: '/projects/' },
      { label: 'Quantum', href: undefined },
    ];
    const result = buildDetailsSegments(breadcrumbs, false);
    expect(result).toHaveLength(5); // heart, /, projects, /, quantum
    expect(result[4]).toEqual({ text: 'quantum', bold: false, href: undefined });
  });
});

describe('renderSegment', () => {
  test('bold segment returns span with crumb-sep class', () => {
    const r = renderSegment({ text: '/', bold: true });
    expect(r).toMatchObject({ tag: 'span', class: 'crumb-sep', text: '/' });
  });

  test('heart segment returns anchor with crumb-heart class', () => {
    const r = renderSegment({ bold: false, href: '/', isHeart: true });
    expect(r).toMatchObject({ tag: 'a', href: '/', class: 'crumb-link crumb-heart', isHeart: true });
  });

  test('segment with href returns anchor with crumb-link class', () => {
    const r = renderSegment({ text: 'about', bold: false, href: '/about/' });
    expect(r).toMatchObject({ tag: 'a', href: '/about/', class: 'crumb-link', text: 'about' });
  });

  test('plain segment returns span without class', () => {
    const r = renderSegment({ text: 'last', bold: false });
    expect(r.tag).toBe('span');
    expect(r.text).toBe('last');
  });
});
