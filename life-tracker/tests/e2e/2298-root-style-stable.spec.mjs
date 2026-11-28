import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

const BASE_URL = process.env.MOSAIC_E2E_BASE_URL ?? 'https://127.0.0.1:4173';
const cssPaths = [
  '../../src/components/home/views/CalendarWallpaperBackdrop.css',
  '../../src/components/layout/OtherPagesWallpaper.css',
  '../../src/components/layout/WallpaperMaterial.css',
  '../../src/components/layout/FloatingDock.css',
];
const css = cssPaths.map(path => readFileSync(new URL(path, import.meta.url), 'utf8')).join('\n');

const fixture = `<!doctype html><html data-theme="dark"><head><meta charset="utf-8">
<style>${css}</style></head><body>
<div id="owner" class="mosaic-app-layout" data-mosaic-home-root="true"
 data-mosaic-wallpaper-home="true" data-mosaic-wallpaper-home-material="soft"
 data-mosaic-wallpaper-home-transparency="50"
 data-mosaic-nav="true" data-mosaic-nav-hidden="true">
  <div data-home-wallpaper-paint="true" data-wallpaper-material="soft"
    data-glass-transparency="50"></div>
  <div class="mosaic-material-panel"><input class="mosaic-material-control" placeholder="Hint"></div>
  <div data-calendar-primary-active="true"><div data-calendar-slide-index role="region" id="day-slide"></div></div>
  <nav class="mosaic-floating-navigation" data-mosaic-nav-hidden="true"></nav>
</div>
<div id="other" class="mosaic-app-layout" data-mosaic-wallpaper-other="true"
 data-mosaic-wallpaper-other-material="solid" data-mosaic-wallpaper-other-transparency="50">
  <div data-other-pages-wallpaper-paint="true" data-wallpaper-material="solid"
    data-glass-transparency="50"></div>
  <div class="mosaic-chat-page"><header class="mosaic-material-header"></header></div>
</div></body></html>`;

test.use({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 850 } });

async function visit(page) {
  await page.route('**/2298-stable-style-fixture*', async route => {
    await route.fulfill({ status: 200, contentType: 'text/html', body: fixture });
  });
  await page.goto(BASE_URL + '/2298-stable-style-fixture');
}

test('no app-root wallpaper/material/floating-nav descendant :has dependencies remain', () => {
  // Unlike a CSS override, these source selectors no longer participate in
  // Blink's descendant invalidation sets when Diary/task drag changes rows.
  expect(css).not.toMatch(/\.mosaic-app-layout:has\(\s*>\s*\[data-(?:home|other-pages)-wallpaper-paint/);
  expect(css).not.toMatch(/\.mosaic-app-layout:has\(\s*\.mosaic-floating-navigation/);
  // Calendar's intentionally local wallpaper predicate is not part of this fix.
  expect(css).toContain("[data-calendar-wallpaper]:has(");
});

test('stable shell markers preserve wallpaper, glass and floating navigation style conditions', async ({ page }) => {
  await visit(page);
  const getState = () => page.evaluate(() => {
    const owner = document.getElementById('owner');
    const other = document.getElementById('other');
    const homeStyle = getComputedStyle(owner);
    const otherStyle = getComputedStyle(other);
    return {
      homeIsolation: homeStyle.isolation,
      otherIsolation: otherStyle.isolation,
      clearance: homeStyle.getPropertyValue('--mosaic-active-nav-clearance').trim(),
      glassFade: homeStyle.getPropertyValue('--mosaic-glass-fade').trim(),
      otherGlassFade: otherStyle.getPropertyValue('--mosaic-glass-fade').trim(),
      chatBackground: getComputedStyle(other.querySelector('.mosaic-chat-page')).backgroundColor,
    };
  });
  const first = await getState();
  expect(first.homeIsolation).toBe('isolate');
  expect(first.otherIsolation).toBe('isolate');
  expect(first.clearance).toContain('1.75rem');
  expect(first.glassFade).not.toBe('');
  expect(first.otherGlassFade).toBe('');
  expect(first.chatBackground).toBe('rgba(0, 0, 0, 0)');

  await page.locator('#owner').evaluate(shell => {
    shell.removeAttribute('data-mosaic-nav-hidden');
    shell.removeAttribute('data-mosaic-wallpaper-home-material');
  });
  const visible = await getState();
  expect(visible.clearance).toContain('5.5rem');
  expect(visible.glassFade).toBe('');

  await page.locator('#other').evaluate(shell => {
    shell.setAttribute('data-mosaic-wallpaper-other-material', 'soft');
  });
  const softOther = await getState();
  expect(softOther.otherGlassFade).not.toBe('');
  expect(softOther.homeIsolation).toBe('isolate');

  await page.locator('#owner').evaluate(shell => {
    shell.removeAttribute('data-mosaic-nav');
    shell.removeAttribute('data-mosaic-wallpaper-home');
  });
  const cleared = await getState();
  expect(cleared.clearance).toBe('');
  expect(cleared.homeIsolation).toBe('auto');
  expect(cleared.otherIsolation).toBe('isolate');
});
