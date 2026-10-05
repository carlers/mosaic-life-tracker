import { test, expect } from '@playwright/test';
const BASE = process.env.MOSAIC_E2E_BASE_URL ?? 'https://127.0.0.1:4173';
test.use({ ignoreHTTPSErrors: true });
test.beforeEach(async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  Object.assign(page, { chatErrors: errors });
});
test.afterEach(async ({ page }, testInfo) => {
  expect(page.chatErrors).toEqual([]);
  if (testInfo.status !== testInfo.expectedStatus) {
    await testInfo.attach('chat failure', { body: await page.screenshot(), contentType: 'image/png' });
  }
});
async function open(page, width = 'full') {
  for (const name of ['useMessages', 'useFriends', 'useAuth']) {
    await page.route(`**/src/hooks/${name}.ts*`, route => route.fulfill({ contentType: 'application/javascript', body: `export { ${name} } from '/tests/e2e/chat-store.ts';` }));
  }
  await page.route('**/src/db/sync.ts*', route => route.fulfill({ contentType: 'application/javascript', body: 'export const forceSync = async () => {};' }));
  await page.goto(`${BASE}/tests/e2e/chat-scroll.html?width=${width}`);
  await expect(page.getByRole('textbox', { name: 'Message', exact: true })).toBeVisible();
}
const scroller = page => page.locator('div.overflow-y-auto').last();
const gap = page => scroller(page).evaluate(el => el.scrollHeight - el.clientHeight - el.scrollTop);
const EDGE_GESTURE_TEST_GUTTER = 48;
for (const { viewport, width } of [
  { viewport: { width: 412, height: 915 }, width: 'full' },
  { viewport: { width: 1440, height: 900 }, width: 'wide' },
]) {
  test(`chat geometry and follow intent ${viewport.width} ${width}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await open(page, width);
      await expect.poll(() => gap(page)).toBeLessThanOrEqual(2);
      const composer = page.getByRole('textbox', { name: 'Message', exact: true });
      const last = page.locator('[id^="msg-"]').last();
      const lastBox = await last.boundingBox();
      expect(lastBox.y + lastBox.height).toBeLessThanOrEqual((await composer.boundingBox()).y);
      const dockBox = await page.getByTestId('chat-dock').boundingBox();
      expect(dockBox.y + dockBox.height).toBeCloseTo(viewport.height, 0);
      expect(dockBox.width).toBeCloseTo((await scroller(page).boundingBox()).width, 0);
      await expect.poll(() => scroller(page).evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
      await scroller(page).evaluate(el => { el.scrollTop -= 500; });
      await expect(page.getByRole('button', { name: 'Scroll to bottom', exact: true })).toBeVisible();
      if (width === 'full') await page.screenshot({ path: testInfo.outputPath('chat-history.png') });
      const before = await scroller(page).evaluate(el => el.scrollTop);
      await page.evaluate(() => window.chatControl.append());
      await expect(page.getByRole('button', { name: 'Scroll to bottom, new messages' })).toBeVisible();
      expect(await scroller(page).evaluate(el => el.scrollTop)).toBeCloseTo(before, 0);
      await composer.fill('Sending while reading history');
      await page.getByRole('button', { name: 'Send', exact: true }).click();
      await expect.poll(() => gap(page)).toBeLessThanOrEqual(2);
      await page.evaluate(() => window.chatControl.append());
      await expect.poll(() => gap(page)).toBeLessThanOrEqual(2);
      expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1)).toBe(true);
  });
}

async function readHistory(page) {
  await scroller(page).evaluate(el => { el.scrollTop = Math.max(0, el.scrollHeight - el.clientHeight - 700); });
  await expect(page.getByRole('button', { name: 'Scroll to bottom', exact: true })).toBeVisible();
  return scroller(page).evaluate(el => el.scrollTop);
}

// Regression: §2/§21 (chat detail edge Back is relative to the live route surface,
// including centered large-screen modes, while non-edge bubble swipes stay chat-owned).
for (const { viewport, width } of [
  { viewport: { width: 412, height: 915 }, width: 'full' },
  { viewport: { width: 1440, height: 900 }, width: 'comfortable' },
  { viewport: { width: 1440, height: 900 }, width: 'wide' },
]) {
  test(`chat edge swipe reveals Messages in ${width} mode while bubble swipes stay chat-owned`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await open(page, width);

    const path = page.getByTestId('chat-path');
    await expect(path).toHaveText('/messages/friend');

    const surface = page.getByTestId('primary-route-swipe-surface');
    const surfaceBox = await surface.boundingBox();
    if (!surfaceBox) throw new Error('Missing chat route surface bounds');
    if (width !== 'full') {
      expect(surfaceBox.x).toBeGreaterThan(32);
    }

    const bubble = page.locator('[data-message-id] > [role="button"]').last();
    await expect(bubble).toBeVisible();
    const bubbleBox = await bubble.boundingBox();
    if (!bubbleBox) throw new Error('Missing message bubble bounds');

    // Away from the reserved edge, an incoming bubble keeps its right-swipe reply gesture.
    const bubbleStartX = Math.max(
      surfaceBox.x + EDGE_GESTURE_TEST_GUTTER,
      bubbleBox.x + Math.min(24, bubbleBox.width * 0.25)
    );
    await page.mouse.move(
      bubbleStartX,
      bubbleBox.y + bubbleBox.height * 0.5
    );
    await page.mouse.down();
    await page.mouse.move(
      bubbleStartX + Math.min(110, bubbleBox.width * 0.8),
      bubbleBox.y + bubbleBox.height * 0.5,
      { steps: 5 }
    );
    await page.mouse.up();
    await expect(path).toHaveText('/messages/friend');
    await expect(page.getByRole('button', { name: 'Cancel reply' })).toBeVisible();
    await page.getByRole('button', { name: 'Cancel reply' }).click();

    // Re-read geometry after the reply composer expanded/collapsed so the next
    // pointer starts on the live bubble rather than a stale screen coordinate.
    const edgeBubbleBox = await bubble.boundingBox();
    if (!edgeBubbleBox) throw new Error('Missing live message bubble bounds');

    // Inside the reserved edge, route Back wins even when a replyable bubble is under the pointer.
    const startX = edgeBubbleBox.x + 2;
    expect(startX - surfaceBox.x).toBeLessThanOrEqual(32);
    const y = edgeBubbleBox.y + edgeBubbleBox.height * 0.5;
    await page.mouse.move(startX, y);
    await page.mouse.down();
    await page.mouse.move(startX + 90, y + 2, { steps: 5 });
    expect(await bubble.evaluate(el => el.style.transform)).toBe('translateX(0px)');

    const preview = page.getByTestId('primary-route-neighbor-preview');
    await expect(preview).toHaveCount(1);
    const previewBox = await preview.boundingBox();
    if (!previewBox) throw new Error('Missing Messages preview bounds');
    expect(previewBox.x + previewBox.width).toBeGreaterThan(surfaceBox.x);

    await page.mouse.move(startX + 180, y + 2, { steps: 5 });
    await page.mouse.up();

    await expect(path).toHaveText('/messages');
    await expect(page.getByTestId('messages-parent-page')).toBeVisible();
  });
}

test('search restores history, incoming stays below, FAB acknowledges, send exits search', async ({ page }) => {
  await open(page);
  const before = await readHistory(page);
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search messages', exact: true }).fill('Message 1:');
  await page.evaluate(() => window.chatControl.append());
  await expect(page.getByRole('button', { name: /Scroll to bottom/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Close search' }).click();
  await expect.poll(() => scroller(page).evaluate(el => el.scrollTop)).toBeCloseTo(before, 0);
  await page.getByRole('button', { name: 'Scroll to bottom, new messages' }).click();
  await expect.poll(() => gap(page)).toBeLessThanOrEqual(2);
  await readHistory(page);
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search messages', exact: true }).fill('no matches');
  await page.getByRole('textbox', { name: 'Message', exact: true }).fill('Sent from search');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Search messages', exact: true })).toHaveCount(0);
  await expect.poll(() => gap(page)).toBeLessThanOrEqual(2);
});

test('loading, short conversations, late growth and viewport resize', async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await open(page);
  await page.evaluate(() => window.chatControl.loading());
  await expect(page.getByRole('status')).toContainText('Loading messages');
  await page.evaluate(() => window.chatControl.load(0));
  await expect(page.getByText('No messages yet')).toBeVisible();
  await page.evaluate(() => window.chatControl.append());
  await expect.poll(() => gap(page)).toBeLessThanOrEqual(2);
  await page.evaluate(() => window.chatControl.load(60));
  await expect.poll(() => gap(page)).toBeLessThanOrEqual(2);
  await page.locator('[id^="msg-"]').last().evaluate(el => { el.style.minHeight = '500px'; });
  await expect.poll(() => gap(page)).toBeLessThanOrEqual(2);
  await page.setViewportSize({ width: 412, height: 500 });
  await expect.poll(() => gap(page)).toBeLessThanOrEqual(2);
  await expect
    .poll(async () => {
      const dock = await page.getByTestId('chat-dock').boundingBox();
      return dock.y + dock.height;
    })
    .toBeCloseTo(500, 0);
  const before = await readHistory(page);
  await page.locator('[id^="msg-"]').last().evaluate(el => { el.style.minHeight = '700px'; });
  await page.setViewportSize({ width: 412, height: 650 });
  await expect.poll(() => scroller(page).evaluate(el => el.scrollTop)).toBeCloseTo(before, 0);
  await page.evaluate(() => { Object.defineProperty(navigator, 'onLine', { configurable: true, value: false }); window.dispatchEvent(new Event('offline')); });
  await expect(page.getByText('You are offline. Changes will sync later.')).toBeVisible();
  expect(await scroller(page).evaluate(el => el.scrollTop)).toBeCloseTo(before, 0);
});

test('switching and reopening a conversation resets the bottom pin', async ({ page }) => {
  await open(page);
  await readHistory(page);
  await page.evaluate(() => { window.chatControl.loading(); window.chatNavigate('/messages/second'); });
  await expect(page.getByRole('status')).toContainText('Loading messages');
  await page.evaluate(() => window.chatControl.load(80));
  await expect.poll(() => gap(page)).toBeLessThanOrEqual(2);
  await readHistory(page);
  await page.evaluate(() => window.chatNavigate('/messages/friend'));
  await expect.poll(() => gap(page)).toBeLessThanOrEqual(2);
});

test('quote navigation suspends following and reply expansion keeps dock anchored', async ({ page }) => {
  await open(page);
  await page.evaluate(() => window.chatControl.quote());
  await expect.poll(() => gap(page)).toBeLessThanOrEqual(2);
  await page.getByRole('button', { name: /Jump to earlier message/ }).click();
  await expect(page.getByRole('button', { name: 'Scroll to bottom', exact: true })).toBeVisible();
  // Wait for the deliberate smooth quote navigation to finish before receiving.
  await expect.poll(() => scroller(page).evaluate(el => el.scrollTop)).toBeLessThan(300);
  await page.evaluate(() => window.chatControl.append());
  await expect(page.getByRole('button', { name: 'Scroll to bottom, new messages' })).toBeVisible();
  await page.getByRole('button', { name: 'Scroll to bottom, new messages' }).click();
  const last = page.locator('[id^="msg-"]').last();
  const box = await last.getByRole('button').first().boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(page.getByRole('button', { name: 'Reply', exact: true })).toBeVisible();
  await page.mouse.up();
  await page.getByRole('button', { name: 'Reply', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Cancel reply' })).toBeVisible();
  await expect.poll(() => gap(page)).toBeLessThanOrEqual(2);
  const dock = await page.getByTestId('chat-dock').boundingBox();
  expect(dock.y + dock.height).toBeCloseTo(page.viewportSize().height, 0);
});
