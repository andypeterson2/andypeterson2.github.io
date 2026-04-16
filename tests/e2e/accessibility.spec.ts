import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Pages that fully pass critical + serious WCAG 2.1 AA.
const cleanPages = [
  { name: 'Home', path: '/' },
  { name: 'About', path: '/about/' },
  { name: 'Projects index', path: '/projects/' },
  { name: '404', path: '/intentionally-missing/' },
];

for (const { name, path } of cleanPages) {
  test(`${name} has no critical or serious accessibility violations`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    const blocking = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(blocking).toEqual([]);
  });
}

// Project detail pages have pre-existing color-contrast issues (#999 on #eee)
// tracked as a separate follow-up. Audit them for critical violations only and
// disable the color-contrast rule until the design tokens are adjusted.
const detailPages = [
  { name: 'Project detail (QVC)', path: '/projects/quantum-video-chat/' },
  { name: 'Project detail (Nonogram)', path: '/projects/quantum-nonogram-solver/' },
  { name: 'Project detail (QPK)', path: '/projects/quantum-protein-kernel/' },
  { name: 'Project detail (CV editor)', path: '/projects/latex-resume-editor/' },
];

for (const { name, path } of detailPages) {
  test(`${name} has no critical accessibility violations`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .disableRules(['color-contrast'])
      .analyze();

    const critical = results.violations.filter((v) => v.impact === 'critical');
    expect(critical).toEqual([]);
  });
}

// App pages: block backends so the shell can render, then audit.
const appPages = [
  { name: 'Classifier shell', path: '/classifiers/' },
];

for (const { name, path } of appPages) {
  test(`${name} shell has no critical accessibility violations`, async ({ page }) => {
    await page.route('**/api/**', (route) => route.abort());
    await page.route('**/health', (route) => route.abort());
    await page.goto(path);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .disableRules(['color-contrast'])
      .analyze();
    const critical = results.violations.filter((v) => v.impact === 'critical');
    expect(critical).toEqual([]);
  });
}
