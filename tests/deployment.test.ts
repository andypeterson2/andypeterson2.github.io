/**
 * Deploy configuration, preview deploy safety, and migration redirect tests.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname!, '..');

// ---- Preview deploy safety ----

describe('Preview deploy safety', () => {
  test('layout supports noindex for preview deploys', () => {
    const layout = readFileSync(resolve(ROOT, 'src/layouts/BaseLayout.astro'), 'utf-8');
    expect(layout).toContain('PREVIEW_DEPLOY');
    expect(layout).toContain('noindex');
    expect(layout).toContain('nofollow');
  });

  test('robots.txt exists', () => {
    expect(existsSync(resolve(ROOT, 'public/robots.txt'))).toBe(true);
  });

  test('robots.txt allows crawling', () => {
    const robots = readFileSync(resolve(ROOT, 'public/robots.txt'), 'utf-8');
    expect(robots).toContain('Allow: /');
  });
});

// ---- Test:integration script ----

describe('Integration test script', () => {
  const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf-8'));

  test('package.json defines test:integration script', () => {
    expect(pkg.scripts['test:integration']).toBeDefined();
  });

  test('test:integration runs astro build before integration tests', () => {
    expect(pkg.scripts['test:integration']).toContain('astro build');
    expect(pkg.scripts['test:integration']).toContain('vitest.integration.config.ts');
  });

  test('vitest.integration.config.ts exists', () => {
    expect(existsSync(resolve(ROOT, 'vitest.integration.config.ts'))).toBe(true);
  });
});

// ---- CI security audit ----

describe('CI security audit', () => {
  const ciYml = readFileSync(resolve(ROOT, '.github/workflows/ci.yml'), 'utf-8');

  test('npm audit does not silently swallow failures', () => {
    const auditLine = ciYml.split('\n').find((l) => l.includes('npm audit'));
    expect(auditLine).toBeDefined();
    expect(auditLine).not.toContain('|| true');
  });
});

// ---- Docker configuration ----

describe('Docker configuration', () => {
  test('Dockerfile uses multi-stage build', () => {
    const dockerfile = readFileSync(resolve(ROOT, 'Dockerfile'), 'utf-8');
    const fromLines = dockerfile.match(/^FROM /gm) || [];
    expect(fromLines.length).toBeGreaterThanOrEqual(2);
    expect(dockerfile).toContain(' AS ');
  });
});

// ---- Submodule configuration ----

describe('Submodule configuration', () => {
  test('submodules do not track branch tip', () => {
    const gitmodules = readFileSync(resolve(ROOT, '.gitmodules'), 'utf-8');
    expect(gitmodules).not.toContain('branch = main');
  });
});

// ---- Security scanning ----

describe('Security scanning', () => {
  test('CodeQL workflow exists', () => {
    expect(existsSync(resolve(ROOT, '.github/workflows/codeql.yml'))).toBe(true);
  });
});

// ---- Documentation ----

describe('Package documentation', () => {
  test('shared-js package has README', () => {
    expect(existsSync(resolve(ROOT, 'packages/shared-js/README.md'))).toBe(true);
  });
});

// ---- Migration redirects ----

describe('Migration redirects', () => {
  const astroConfig = readFileSync(resolve(ROOT, 'astro.config.mjs'), 'utf-8');

  test('redirects old under-construction page', () => {
    expect(astroConfig).toContain('/underconstruction');
  });

  test('redirects /resume', () => {
    expect(astroConfig).toContain("'/resume'");
  });
});
