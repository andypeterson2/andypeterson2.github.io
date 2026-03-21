import rss from '@astrojs/rss';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const posts = import.meta.glob('../content/blog/*.mdx', { eager: true }) as Record<string, any>;

  const items = Object.entries(posts)
    .filter(([_, post]) => post.frontmatter?.date)
    .map(([path, post]) => ({
      title: post.frontmatter.title,
      description: post.frontmatter.description || '',
      pubDate: new Date(post.frontmatter.date),
      link: `/blog/${path.split('/').pop()?.replace('.mdx', '')}/`,
    }))
    .sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());

  return rss({
    title: 'Blog',
    description: 'Thoughts on quantum computing, software engineering, and research.',
    site: context.site?.toString() || 'https://localhost',
    items,
  });
}
