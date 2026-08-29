import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Pages that fully pass critical + serious WCAG 2.1 AA.
const cleanPages = [
  // The bio, experience/project timeline and long-form about all live on '/'.
  { name: 'Home', path: '/' },
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

// The legacy detail pages are retired (they 301 to the home timeline), so the
// audits that covered them now cover the surviving demo pages instead.
const demoPages = [
  { name: 'Nonogram demo', path: '/projects/quantum-nonogram-solver/app/' },
  { name: 'CV editor demo', path: '/projects/latex-resume-editor/app/' },
];

for (const { name, path } of demoPages) {
  test(`${name} has no critical accessibility violations`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .disableRules(['color-contrast'])
      .analyze();

    const critical = results.violations.filter((v) => v.impact === 'critical');
    expect(critical).toEqual([]);
  });
}

// App pages: block backends so the shell can render, then audit.
const appPages = [{ name: 'Classifier shell', path: '/projects/quantum-ml-classifier/app/' }];

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
