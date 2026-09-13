import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Every page and every state a visitor can open, against WCAG 2.2 AA plus axe's
// best-practice rules, failing on a violation of ANY impact. The old suite skipped
// colour contrast on the app pages, failed only on "critical", ran no best-practice
// rules (so no page needing a <main> was noticed) and never opened a menu, drawer
// or dialog — CI stayed green over all of it (audit M14).
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];

const EDITOR = '/projects/latex-resume-editor/app/';
const NONOGRAM = '/projects/quantum-nonogram-solver/app/';
const CLASSIFIER = '/projects/ai-ml/app/';

type Setup = (page: Page) => Promise<void>;

async function dismissInvite(page: Page) {
  await expect(page.locator('[data-hydrated]')).toBeAttached();
  await page.locator('#demo-invite button[aria-label="Dismiss"]:visible').first().click();
  await expect(page.locator('#demo-invite')).toHaveCount(0);
}
const openDrawer =
  (name: string): Setup =>
  async (page) => {
    await dismissInvite(page);
    await page.getByRole('button', { name, exact: true }).first().click();
    await expect(page.getByRole('dialog', { name: new RegExp(name) })).toBeVisible();
  };

const states: { name: string; path: string; phone?: boolean; dark?: boolean; setup?: Setup }[] = [
  { name: 'home', path: '/' },
  { name: 'home, dark', path: '/', dark: true },
  { name: 'home, phone', path: '/', phone: true },
  {
    name: 'home, phone menu open',
    path: '/',
    phone: true,
    setup: async (page) => {
      await page.locator('.mobile-nav-btn').click();
      await expect(page.locator('#mobile-nav-menu')).toBeVisible();
    },
  },
  {
    name: 'home, writeup open',
    path: '/',
    setup: async (page) => {
      await page.locator('[data-writeup-open]').first().click();
      await expect(page.getByRole('dialog')).toBeVisible();
    },
  },
  { name: '404', path: '/intentionally-missing/' },
  { name: 'nonogram', path: NONOGRAM },
  { name: 'nonogram, dark', path: NONOGRAM, dark: true },
  { name: 'nonogram, phone', path: NONOGRAM, phone: true },
  {
    name: 'editor, first-run invite',
    path: EDITOR,
    setup: async (page) => {
      await expect(page.locator('#demo-invite')).toBeVisible();
    },
  },
  { name: 'editor', path: EDITOR, setup: dismissInvite },
  { name: 'editor, dark', path: EDITOR, dark: true, setup: dismissInvite },
  { name: 'editor, phone', path: EDITOR, phone: true, setup: dismissInvite },
  { name: 'editor, Tags drawer', path: EDITOR, setup: openDrawer('Tags') },
  { name: 'editor, Layout drawer', path: EDITOR, setup: openDrawer('Layout') },
  { name: 'editor, Style drawer', path: EDITOR, setup: openDrawer('Style') },
  { name: 'classifier', path: CLASSIFIER },
  { name: 'classifier, dark', path: CLASSIFIER, dark: true },
  { name: 'classifier, phone', path: CLASSIFIER, phone: true },
  {
    name: 'classifier, Dataset list open',
    path: CLASSIFIER,
    setup: async (page) => {
      await page.locator('#dataset-menu-btn').click();
      await expect(page.locator('#dataset-menu')).toBeVisible();
    },
  },
];

for (const s of states) {
  test(`${s.name}: no accessibility violations`, async ({ page }) => {
    // The apps' backends are out of scope: block them so every run sees the
    // in-browser tier, the one almost every visitor gets.
    await page.route('**/api/**', (r) => r.abort());
    await page.route('**/health', (r) => r.abort());
    await page.emulateMedia({ reducedMotion: 'reduce' });
    if (s.phone) await page.setViewportSize({ width: 375, height: 812 });
    if (s.dark) await page.addInitScript(() => localStorage.setItem('sm-theme', 'dark'));
    await page.goto(s.path);
    await page.waitForLoadState('networkidle');
    if (s.setup) await s.setup(page);

    const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    const found = results.violations.map((v) => ({
      rule: v.id,
      impact: v.impact,
      nodes: v.nodes.map((n) => n.target.join(' ')).slice(0, 5),
    }));
    expect(found).toEqual([]);
  });
}
