import { expect, test } from '@playwright/test';

const BASE_URL =
  process.env.MOSAIC_E2E_BASE_URL ?? 'https://127.0.0.1:4173';
const POSTHOG_ORIGIN = 'https://posthog.test';
const USER_ID = 'e2e_offline_user';
const TASK_ID = 'task_e2e_offline';

test.use({ ignoreHTTPSErrors: true });

async function stubPostHog(page) {
  await page.route(`${POSTHOG_ORIGIN}/**`, async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'POST, OPTIONS',
          'access-control-allow-headers': 'content-type',
        },
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: '{}',
    });
  });
}

test('cached account renders locally while browser claims online and Appwrite is unreachable', async ({
  page,
}) => {
  let appwriteRequests = 0;

  await page.addInitScript((userId) => {
    // This is the Android/PWA false-positive we need to support: the browser
    // claims a network interface exists even though Mosaic cannot reach Appwrite.
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      get: () => true,
    });
    localStorage.setItem(
      'mosaic_last_known_user',
      JSON.stringify({
        $id: userId,
        email: 'offline-e2e@example.invalid',
        prefs: {},
        name: 'Offline E2E',
      })
    );
  }, USER_ID);

  await page.route('https://sgp.cloud.appwrite.io/**', async (route) => {
    appwriteRequests += 1;
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await route.abort('failed');
  });
  await stubPostHog(page);

  await page.goto(`${BASE_URL}/home`, { waitUntil: 'domcontentloaded' });
  await expect.poll(() => new URL(page.url()).pathname).toBe('/home');

  // Live-session verification is still pending here. Local startup must show
  // useful UI rather than the old page-level Mosaic spinner.
  await expect(page.getByText('Loading Mosaic')).toHaveCount(0);
  await expect(page.locator('[aria-label="Loading"]')).toHaveCount(0);
  await expect(
    page
      .getByRole('status', { name: 'Opening Home' })
      .or(page.getByRole('status', { name: 'Opening local data' }))
      .or(page.getByRole('button', { name: 'Checking connection' }).first())
  ).toBeVisible({ timeout: 1000 });

  // Once the real request fails, the same shared reachability state must
  // become Offline even though navigator.onLine is still true.
  await expect(
    page.locator('button[aria-label="Offline"]:visible').first()
  ).toBeVisible({ timeout: 5000 });

  await page.evaluate(
    async ({ userId, taskId }) => {
      const { waitForDatabaseReady } = await import(
        '/src/lib/databaseBootstrap.ts'
      );
      await waitForDatabaseReady();
      const { upsertLocalDoc } = await import('/src/lib/localUpsert.ts');
      const now = new Date().toISOString();
      await upsertLocalDoc('tasks', taskId, {
        id: taskId,
        title: 'Created while offline',
        completed: false,
        categoryId: '',
        order: 0,
        tags: '',
        date: now.slice(0, 10),
        memo: '',
        image: '',
        createdAt: now,
        completedAt: '',
        updatedAt: now,
        source: '',
        userId,
        isDeleted: false,
        routineId: '',
        reminderTime: '',
        reactions: '',
        visibility: 'private',
      });
    },
    { userId: USER_ID, taskId: TASK_ID }
  );

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect.poll(() => new URL(page.url()).pathname).toBe('/home');
  await expect(page.getByText('Loading Mosaic')).toHaveCount(0);

  const titleAfterReload = await page.evaluate(async (taskId) => {
    const { waitForDatabaseReady } = await import(
      '/src/lib/databaseBootstrap.ts'
    );
    await waitForDatabaseReady();
    const { getDatabase } = await import('/src/db/database.ts');
    const task = await getDatabase().tasks.findOne(taskId).exec();
    return task?.toJSON().title ?? null;
  }, TASK_ID);
  expect(titleAfterReload).toBe('Created while offline');

  await page.evaluate(async (taskId) => {
    const { upsertLocalDoc } = await import('/src/lib/localUpsert.ts');
    await upsertLocalDoc('tasks', taskId, {
      title: 'Edited while offline',
      updatedAt: new Date().toISOString(),
    });
  }, TASK_ID);

  await page.reload({ waitUntil: 'domcontentloaded' });
  const titleAfterEditReload = await page.evaluate(async (taskId) => {
    const { waitForDatabaseReady } = await import(
      '/src/lib/databaseBootstrap.ts'
    );
    await waitForDatabaseReady();
    const { getDatabase } = await import('/src/db/database.ts');
    const task = await getDatabase().tasks.findOne(taskId).exec();
    return task?.toJSON().title ?? null;
  }, TASK_ID);

  expect(titleAfterEditReload).toBe('Edited while offline');
  expect(appwriteRequests).toBeGreaterThan(0);
});

test('Login form renders while initial Appwrite session verification is pending', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      get: () => true,
    });
    localStorage.removeItem('mosaic_last_known_user');
  });

  await page.route('https://sgp.cloud.appwrite.io/**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await route.abort('failed');
  });
  await stubPostHog(page);

  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });

  await expect(page.getByRole('heading', { name: 'Welcome Back' })).toBeVisible({
    timeout: 1000,
  });
  await expect(page.getByText('Loading Mosaic')).toHaveCount(0);
  await expect(page.locator('[aria-label="Loading"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Sign In' })).toBeEnabled();
});
