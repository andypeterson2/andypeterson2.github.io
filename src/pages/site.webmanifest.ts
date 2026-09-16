import type { APIRoute } from 'astro';
import { siteConfig } from '../config/site';

// Web app manifest, built from site config so the display name stays out of tracked files.
export const GET: APIRoute = () =>
  new Response(
    JSON.stringify({
      name: siteConfig.displayName,
      short_name: siteConfig.firstName,
      icons: [
        { src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
      ],
      theme_color: '#ffffff',
      background_color: '#ffffff',
      display: 'standalone',
    }),
    { headers: { 'Content-Type': 'application/manifest+json' } },
  );
