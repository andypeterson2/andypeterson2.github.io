/**
 * WP #399: Deploy configuration
 * WP #404: Preview deploy safety configuration
 * WP #407: Migration redirects from existing site
 * WP #573: Dual-identity leakage full-build test
 */
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { resolve, extname } from 'path';

const ROOT = resolve(import.meta.dirname!, '..');

// ---- WP #399: Deploy configuration ----

describe('Vercel deploy configuration', () => {
  test('vercel.json exists', () => {
    expect(existsSync(resolve(ROOT, 'vercel.json'))).toBe(true);
  });

  test('vercel.json specifies astro framework', () => {
    const config = JSON.parse(readFileSync(resolve(ROOT, 'vercel.json'), 'utf-8'));
    expect(config.framework).toBe('astro');
  });

  test('vercel.json has security headers', () => {
    const config = JSON.parse(readFileSync(resolve(ROOT, 'vercel.json'), 'utf-8'));
    const headerBlock = config.headers?.find((h: any) => h.source === '/(.*)');
    expect(headerBlock).toBeDefined();
    const names = headerBlock.headers.map((h: any) => h.key);
    expect(names).toContain('X-Content-Type-Options');
    expect(names).toContain('X-Frame-Options');
    expect(names).toContain('Referrer-Policy');
  });

  test('astro.config uses configurable site URL', () => {
    const astroConfig = readFileSync(resolve(ROOT, 'astro.config.mjs'), 'utf-8');
    expect(astroConfig).toContain('andypeterson.dev');
  });

  test('package.json has build script', () => {
    const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf-8'));
    expect(pkg.scripts.build).toBeDefined();
    expect(pkg.scripts.build).toContain('astro build');
  });
});

// ---- WP #404: Preview deploy safety ----

describe('Preview deploy safety', () => {
  test('layout supports noindex for preview deploys', () => {
    const layout = readFileSync(
      resolve(ROOT, 'src/layouts/BaseLayout.astro'),
      'utf-8',
    );
    expect(layout).toContain('PREVIEW_DEPLOY');
    expect(layout).toContain('noindex');
    expect(layout).toContain('nofollow');
  });

  test('robots.txt exists', () => {
    expect(existsSync(resolve(ROOT, 'robots.txt'))).toBe(true);
  });

  test('robots.txt allows crawling', () => {
    const robots = readFileSync(resolve(ROOT, 'robots.txt'), 'utf-8');
    expect(robots).toContain('Allow: /');
  });
});

// ---- WP #407: Migration redirects ----

describe('Migration redirects', () => {
  const astroConfig = readFileSync(resolve(ROOT, 'astro.config.mjs'), 'utf-8');

  test('redirects old nonograms page', () => {
    expect(astroConfig).toContain('/nonograms');
  });

  test('redirects old quantum video page', () => {
    expect(astroConfig).toContain('/quantumvideo');
  });

  test('redirects old under-construction page', () => {
    expect(astroConfig).toContain('/underconstruction');
  });

  test('redirects /me to /about', () => {
    expect(astroConfig).toContain("'/me'");
    expect(astroConfig).toContain('/about');
  });

  test('redirects old resume PDF', () => {
    expect(astroConfig).toContain('Current-Resume.pdf');
    expect(astroConfig).toContain('/resume');
  });
});

// ---- WP #573: Dual-identity leakage test ----

describe('Dual-identity leakage prevention', () => {
  /**
   * Scan all source files to ensure no hardcoded personal names.
   * All identity data should flow through siteConfig/env vars.
   */
  function collectSourceFiles(dir: string, files: string[] = []): string[] {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = resolve(dir, entry.name);
      if (entry.isDirectory()) {
        // Skip node_modules, .git, dist, submodules
        if (['node_modules', '.git', 'dist', 'public', 'lib', 'shared'].includes(entry.name)) continue;
        // Skip submodule directories
        if (['qvc', 'nonogram', 'tech-tree', 'cv', 'dashboard', 'classifiers'].includes(entry.name)) continue;
        collectSourceFiles(full, files);
      } else {
        const ext = extname(entry.name);
        if (['.astro', '.ts', '.tsx', '.js', '.mjs'].includes(ext)) {
          // Skip config files and test files — those are allowed to reference names
          if (entry.name === 'site.ts' || entry.name.includes('.test.')) continue;
          files.push(full);
        }
      }
    }
    return files;
  }

  test('no hardcoded full legal name in source files', () => {
    const srcDir = resolve(ROOT, 'src');
    const files = collectSourceFiles(srcDir);
    const leaks: string[] = [];

    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      // Check for hardcoded full legal name (first + last)
      // This regex matches "Andrew Peterson" as a literal string
      if (/Andrew\s+Peterson/i.test(content)) {
        // Allow references inside siteConfig usage like siteConfig.displayName
        // But flag direct hardcoded strings
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (/Andrew\s+Peterson/i.test(lines[i]) && !lines[i].includes('siteConfig')) {
            leaks.push(`${file}:${i + 1}: ${lines[i].trim()}`);
          }
        }
      }
    }
    expect(leaks).toEqual([]);
  });

  test('pages use siteConfig for display name, not hardcoded', () => {
    const pages = [
      'src/pages/index.astro',
      'src/pages/about.astro',
      'src/pages/contact.astro',
    ];
    for (const page of pages) {
      const content = readFileSync(resolve(ROOT, page), 'utf-8');
      expect(content).toContain('siteConfig');
    }
  });

  test('nav uses siteConfig for branding', () => {
    const nav = readFileSync(resolve(ROOT, 'src/components/Nav.astro'), 'utf-8');
    expect(nav).toContain('siteConfig');
  });

  test('footer uses siteConfig for copyright', () => {
    const footer = readFileSync(resolve(ROOT, 'src/components/Footer.astro'), 'utf-8');
    expect(footer).toContain('siteConfig.displayName');
  });

  test('env.example has placeholder values', () => {
    const env = readFileSync(resolve(ROOT, '.env.example'), 'utf-8');
    // Should not contain actual personal data
    expect(env).not.toMatch(/Andrew\s+Peterson/i);
    expect(env).toContain('Your Name');
  });

  test('siteConfig reads from environment variables', () => {
    const config = readFileSync(resolve(ROOT, 'src/config/site.ts'), 'utf-8');
    expect(config).toContain('import.meta.env');
    expect(config).toContain('SITE_DISPLAY_NAME');
    expect(config).toContain('SITE_DOMAIN');
    expect(config).toContain('SITE_EMAIL');
  });
});
