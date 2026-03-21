// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';

export default defineConfig({
  integrations: [mdx()],
  site: process.env.SITE_URL || 'https://andypeterson.dev',
  redirects: {
    '/nonograms.html': '/projects',
    '/nonograms': '/projects',
    '/quantumvideo.html': '/projects',
    '/quantumvideo': '/projects',
    '/underconstruction.html': '/',
    '/underconstruction': '/',
    '/me': '/about',
    '/me/': '/about',
    '/Current-Resume.pdf': '/resume',
  },
});
