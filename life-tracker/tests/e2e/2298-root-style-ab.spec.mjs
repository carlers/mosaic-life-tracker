import { test, expect } from '@playwright/test';

const BASE_URL = process.env.MOSAIC_E2E_BASE_URL ?? 'https://127.0.0.1:4173';

// A controlled same-origin document avoids accounts and all backend fixtures.
// The real public diagnostic script is loaded from the Vite server, not copied.
const fixture = [
  '<!doctype html><html><head><meta charset="utf-8">',
  '<style id="fixture-styles">',
  '.mosaic-app-layout:has(> [data-home-wallpaper-paint="true"]) .sample { color: rgb(10, 20, 30) }',
  '.mosaic-app-layout:has(> [data-home-wallpaper-paint="true"][data-wallpaper-material="soft"]) .sample { border-color: rgb(30, 40, 50) }',
  '.mosaic-app-layout:has(> [data-home-wallpaper-paint="true"][data-glass-transparency="50"]) .sample { text-decoration-color: rgb(35, 45, 55) }',
  '.mosaic-app-layout:has(> [data-other-pages-wallpaper-paint="true"]) .secondary { color: rgb(20, 30, 40) }',
  '.mosaic-app-layout:has(.mosaic-floating-navigation) .sample { background-color: rgb(50, 60, 70) }',
  '.mosaic-app-layout:has(.mosaic-floating-navigation[data-mosaic-nav-hidden="true"]) .sample { outline-color: rgb(70, 80, 90) }',
  '[data-calendar-wallpaper]:has(> [data-calendar-wallpaper-image="true"]) .calendar-only { color: rgb(10, 10, 10) }',
  '</style>',
  '<script defer src="/2298-root-style-ab.js"></script></head><body>',
  '<div id="root"><div class="mosaic-app-layout" id="shell">',
  '<div id="paint" data-home-wallpaper-paint="true" data-wallpaper-material="soft" data-glass-transparency="50"></div>',
  '<div class="sample">Drag appearance probe</div>',
  '<div class="secondary">Secondary</div>',
  '<div id="nav" class="mosaic-floating-navigation" data-mosaic-nav-hidden="true"></div>',
  '</div></div></body></html>',
].join('');

test.use({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 850 } });

async function visit(page, enabled) {
  await page.route('**/2298-style-fixture*', async route => {
    await route.fulfill({ status: 200, contentType: 'text/html', body: fixture });
  });
  await page.goto(BASE_URL + '/2298-style-fixture' + (enabled ? '?mosaic2298RootCSS=1' : ''));
}

test('root selector diagnostic is opt-in, without page or app changes by default', async ({ page }) => {
  await visit(page, false);
  await expect(page.locator('[data-mosaic-2298-root-css-hud]')).toHaveCount(0);
  expect(await page.evaluate(() => typeof window.__mosaic2298RootCSS)).toBe('undefined');
  await expect(page.locator('#shell')).not.toHaveAttribute('data-mosaic-2298-home', 'true');
});

test('root selector modes replace only intended CSS dependencies and preserve appearance', async ({ page }) => {
  await visit(page, true);
  const hud = page.locator('[data-mosaic-2298-root-css-hud]');
  await expect(hud).toBeVisible();
  await expect(page.locator('#shell')).toHaveAttribute('data-mosaic-2298-home-material', 'soft');
  await expect(page.locator('#shell')).toHaveAttribute('data-mosaic-2298-home-transparency', '50');
  await expect(page.locator('#shell')).toHaveAttribute('data-mosaic-2298-nav-hidden', 'true');

  const inspect = () => page.evaluate(() => ({
    status: window.__mosaic2298RootCSS.getStatus(),
    rules: Array.from(document.getElementById('fixture-styles').sheet.cssRules, rule => rule.selectorText),
    colors: {
      color: getComputedStyle(document.querySelector('.sample')).color,
      border: getComputedStyle(document.querySelector('.sample')).borderColor,
      background: getComputedStyle(document.querySelector('.sample')).backgroundColor,
      outline: getComputedStyle(document.querySelector('.sample')).outlineColor,
    },
  }));
  const baseline = await inspect();
  expect(baseline.status.available.page).toBeGreaterThan(0);
  expect(baseline.status.available.material).toBeGreaterThan(0);
  expect(baseline.status.available.nav).toBeGreaterThan(0);

  for (const [label, group] of [
    ['Page paint', 'page'], ['Material / glass', 'material'],
    ['Floating nav', 'nav'], ['All three', 'all'],
  ]) {
    await hud.getByRole('button', { name: label, exact: true }).click();
    const result = await inspect();
    expect(result.status.mode).toBe(group);
    expect(result.status.failed).toBe(0);
    expect(result.status.rewritten).toBeGreaterThan(0);
    expect(result.colors).toEqual(baseline.colors);
    if (group === 'all') {
      expect(result.rules.slice(0, 6).every(selector =>
        !selector.includes('.mosaic-app-layout:has(') &&
        !selector.includes(':has(.mosaic-floating-navigation')
      )).toBe(true);
      expect(result.rules.at(-1)).toContain('[data-calendar-wallpaper]:has(');
    }
  }

  // Attribute changes must match the original :has() conditions, not a
  // one-time stale snapshot, and never require observing drag descendants.
  await page.locator('#paint').evaluate(node => node.setAttribute('data-wallpaper-material', 'solid'));
  await expect(page.locator('#shell')).toHaveAttribute('data-mosaic-2298-home-material', 'solid');
  expect((await inspect()).colors.border).not.toBe(baseline.colors.border);
  await page.locator('#nav').evaluate(node => node.removeAttribute('data-mosaic-nav-hidden'));
  await expect(page.locator('#shell')).not.toHaveAttribute('data-mosaic-2298-nav-hidden', 'true');

  await hud.getByRole('button', { name: 'Original CSS', exact: true }).click();
  const restored = await inspect();
  expect(restored.status.mode).toBe('baseline');
  expect(restored.status.rewritten).toBe(0);
  expect(restored.rules).toEqual(baseline.rules);
});
