/**
 * Website Phase 7: Blog & Tier 3
 * WP #525: Blog index page
 * WP #526: Individual blog post template
 * WP #527: Table of contents sidebar
 * WP #528: RSS feed
 * WP #529: KaTeX / math rendering (MDX support enables this)
 * WP #530: Tags and categories browsing page
 * WP #531: Post series support
 * WP #532: Copy-to-clipboard on code blocks
 * WP #534: Console.log message for devs
 * WP #535: Custom 404 with personality
 * WP #536: Terminal mode easter egg (console message)
 * WP #537: Hidden /uses page
 * WP #434: Built with credit line
 */
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname!, '..');

// ---- WP #525: Blog index ----

describe('Blog index page', () => {
  const blogIndex = readFileSync(resolve(ROOT, 'src/pages/blog/index.astro'), 'utf-8');

  test('blog index page exists', () => {
    expect(existsSync(resolve(ROOT, 'src/pages/blog/index.astro'))).toBe(true);
  });

  test('uses BaseLayout', () => {
    expect(blogIndex).toContain('BaseLayout');
  });

  test('has breadcrumbs', () => {
    expect(blogIndex).toContain('Breadcrumbs');
  });

  test('loads blog posts from content', () => {
    expect(blogIndex).toContain('Astro.glob');
    expect(blogIndex).toContain('content/blog');
  });

  test('sorts posts by date descending', () => {
    expect(blogIndex).toContain('.sort(');
  });

  test('has tag filter buttons', () => {
    expect(blogIndex).toContain('blog-tag-btn');
    expect(blogIndex).toContain('data-tag');
  });

  test('has feed role for accessibility', () => {
    expect(blogIndex).toContain('role="feed"');
  });

  test('renders post cards with title, date, excerpt', () => {
    expect(blogIndex).toContain('post-title');
    expect(blogIndex).toContain('post-date');
    expect(blogIndex).toContain('post-excerpt');
  });
});

// ---- WP #526: Blog post template ----

describe('Individual blog post template', () => {
  const postTemplate = readFileSync(resolve(ROOT, 'src/pages/blog/[slug].astro'), 'utf-8');

  test('template exists', () => {
    expect(existsSync(resolve(ROOT, 'src/pages/blog/[slug].astro'))).toBe(true);
  });

  test('has getStaticPaths', () => {
    expect(postTemplate).toContain('getStaticPaths');
  });

  test('renders post content via Content component', () => {
    expect(postTemplate).toContain('<Content');
  });

  test('has breadcrumbs with Blog parent', () => {
    expect(postTemplate).toContain("label: 'Blog'");
    expect(postTemplate).toContain("href: '/blog'");
  });

  test('shows post date', () => {
    expect(postTemplate).toContain('frontmatter.date');
    expect(postTemplate).toContain('<time');
  });

  test('shows post tags', () => {
    expect(postTemplate).toContain('frontmatter.tags');
  });

  test('has previous/next post navigation', () => {
    expect(postTemplate).toContain('prevPost');
    expect(postTemplate).toContain('nextPost');
    expect(postTemplate).toContain('post-nav');
  });
});

// ---- WP #527: Table of contents ----

describe('Table of contents', () => {
  const postTemplate = readFileSync(resolve(ROOT, 'src/pages/blog/[slug].astro'), 'utf-8');

  test('TOC element exists', () => {
    expect(postTemplate).toContain('toc');
    expect(postTemplate).toContain('Table of contents');
  });

  test('TOC script generates from headings', () => {
    expect(postTemplate).toContain('post-content h2');
    expect(postTemplate).toContain('toc-nav');
  });

  test('TOC has nested styling for h3', () => {
    expect(postTemplate).toContain('toc-h3');
  });
});

// ---- WP #528: RSS feed ----

describe('RSS feed', () => {
  test('RSS endpoint file exists', () => {
    expect(existsSync(resolve(ROOT, 'src/pages/rss.xml.ts'))).toBe(true);
  });

  const rssSrc = readFileSync(resolve(ROOT, 'src/pages/rss.xml.ts'), 'utf-8');

  test('imports @astrojs/rss', () => {
    expect(rssSrc).toContain('@astrojs/rss');
  });

  test('exports GET function', () => {
    expect(rssSrc).toContain('export async function GET');
  });

  test('loads blog posts', () => {
    expect(rssSrc).toContain('content/blog');
  });

  test('RSS link in blog index', () => {
    const blogIndex = readFileSync(resolve(ROOT, 'src/pages/blog/index.astro'), 'utf-8');
    expect(blogIndex).toContain('/rss.xml');
    expect(blogIndex).toContain('RSS');
  });
});

// ---- WP #530: Tags browsing page ----

describe('Tags browsing page', () => {
  test('tags page exists', () => {
    expect(existsSync(resolve(ROOT, 'src/pages/blog/tags.astro'))).toBe(true);
  });

  const tagsSrc = readFileSync(resolve(ROOT, 'src/pages/blog/tags.astro'), 'utf-8');

  test('loads and groups posts by tag', () => {
    expect(tagsSrc).toContain('tagMap');
  });

  test('has breadcrumbs with Blog parent', () => {
    expect(tagsSrc).toContain("label: 'Blog'");
  });

  test('shows post count per tag', () => {
    expect(tagsSrc).toContain('tag-count');
  });

  test('links to individual posts', () => {
    expect(tagsSrc).toContain('/blog/');
  });
});

// ---- WP #531: Post series support ----

describe('Post series support', () => {
  const postTemplate = readFileSync(resolve(ROOT, 'src/pages/blog/[slug].astro'), 'utf-8');

  test('checks for series in frontmatter', () => {
    expect(postTemplate).toContain('frontmatter.series');
  });

  test('shows series navigation', () => {
    expect(postTemplate).toContain('series-nav');
    expect(postTemplate).toContain('series-list');
  });

  test('highlights current post in series', () => {
    expect(postTemplate).toContain('isCurrent');
  });
});

// ---- WP #532: Copy-to-clipboard ----

describe('Copy-to-clipboard on code blocks', () => {
  const postTemplate = readFileSync(resolve(ROOT, 'src/pages/blog/[slug].astro'), 'utf-8');

  test('copy button script exists', () => {
    expect(postTemplate).toContain('copy-btn');
    expect(postTemplate).toContain('clipboard');
  });

  test('uses navigator.clipboard API', () => {
    expect(postTemplate).toContain('navigator.clipboard.writeText');
  });

  test('provides feedback on copy', () => {
    expect(postTemplate).toContain('Copied!');
  });

  test('copy button has aria-label', () => {
    expect(postTemplate).toContain('aria-label');
    expect(postTemplate).toContain('Copy code');
  });
});

// ---- WP #534 / #536: Console message & terminal easter egg ----

describe('Console easter eggs', () => {
  const layout = readFileSync(resolve(ROOT, 'src/layouts/BaseLayout.astro'), 'utf-8');

  test('console.log message exists', () => {
    expect(layout).toContain('console.log');
  });

  test('message has styled output', () => {
    expect(layout).toContain('%c');
  });

  test('message mentions GitHub', () => {
    expect(layout).toContain('GitHub');
  });
});

// ---- WP #535: Custom 404 with personality ----

describe('Custom 404 with personality', () => {
  const fourOhFour = readFileSync(resolve(ROOT, 'src/pages/404.astro'), 'utf-8');

  test('has quantum-themed messaging', () => {
    expect(fourOhFour).toContain('superposition');
  });

  test('suggests multiple navigation options', () => {
    expect(fourOhFour).toContain('not-found-links');
    expect(fourOhFour).toContain('/projects');
    expect(fourOhFour).toContain('/blog');
  });

  test('has navigation aria-label', () => {
    expect(fourOhFour).toContain('aria-label="Suggested pages"');
  });
});

// ---- WP #537: Hidden /uses page ----

describe('Hidden /uses page', () => {
  test('uses page exists', () => {
    expect(existsSync(resolve(ROOT, 'src/pages/uses.astro'))).toBe(true);
  });

  const usesSrc = readFileSync(resolve(ROOT, 'src/pages/uses.astro'), 'utf-8');

  test('uses BaseLayout', () => {
    expect(usesSrc).toContain('BaseLayout');
  });

  test('has editor/terminal section', () => {
    expect(usesSrc).toContain('Editor');
    expect(usesSrc).toContain('Terminal');
  });

  test('has languages section', () => {
    expect(usesSrc).toContain('Languages');
  });

  test('has infrastructure section', () => {
    expect(usesSrc).toContain('Infrastructure');
  });

  test('not linked from main navigation', () => {
    const navSrc = readFileSync(resolve(ROOT, 'src/components/Nav.astro'), 'utf-8');
    expect(navSrc).not.toContain('/uses');
  });
});

// ---- WP #434: Built with credit line ----

describe('Built with credit line', () => {
  const footer = readFileSync(resolve(ROOT, 'src/components/Footer.astro'), 'utf-8');

  test('footer has built-with text', () => {
    expect(footer).toContain('Built with');
  });

  test('credits Astro', () => {
    expect(footer).toContain('Astro');
    expect(footer).toContain('astro.build');
  });
});

// ---- Blog content ----

describe('Blog content exists', () => {
  test('at least one blog post exists', () => {
    expect(existsSync(resolve(ROOT, 'src/content/blog/hello-world.mdx'))).toBe(true);
  });

  test('blog post has required frontmatter', () => {
    const post = readFileSync(resolve(ROOT, 'src/content/blog/hello-world.mdx'), 'utf-8');
    expect(post).toContain('title:');
    expect(post).toContain('description:');
    expect(post).toContain('date:');
    expect(post).toContain('tags:');
  });
});
