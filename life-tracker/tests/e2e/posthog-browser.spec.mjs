import { expect, test } from '@playwright/test';

const BASE_URL = process.env.MOSAIC_E2E_BASE_URL ?? 'https://127.0.0.1:4173';
const POSTHOG_ORIGIN = 'https://posthog.test';
const USER_ID = 'e2e_appwrite_user';

test.use({ ignoreHTTPSErrors: true });

test('PostHog browser contract stays privacy-minimal across identity changes', async ({ page }) => {
  const posthogRequests = [];

  await page.addInitScript(
    ({ userId, baseUrl }) => {
      Object.defineProperty(window.navigator, 'onLine', {
        configurable: true,
        get: () => false,
      });
      localStorage.setItem(
        'mosaic_last_known_user',
        JSON.stringify({
          $id: userId,
          email: 'e2e@example.invalid',
          prefs: {},
          name: 'E2E User',
        })
      );
      globalThis._posthogReleaseId = 'release_e2e';
      globalThis._posthogChunkIds = {
        [`Error\n    at chunk (${baseUrl}/src/lib/posthog.ts:1:1)`]: 'chunk_e2e',
      };
    },
    { userId: USER_ID, baseUrl: BASE_URL }
  );

  await page.route('https://sgp.cloud.appwrite.io/**', (route) =>
    route.abort('failed')
  );

  await page.route(`${POSTHOG_ORIGIN}/**`, async (route) => {
    const request = route.request();
    const headers = {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'content-type',
    };

    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }

    let body = null;
    try {
      body = request.postDataJSON();
    } catch {
      body = null;
    }
    posthogRequests.push({ url: request.url(), body });

    if (new URL(request.url()).pathname === '/flags/') {
      await route.fulfill({
        status: 200,
        headers,
        contentType: 'application/json',
        body: JSON.stringify({ flags: {} }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      headers,
      contentType: 'application/json',
      body: '{}',
    });
  });

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await expect.poll(() => new URL(page.url()).pathname).toBe('/home');

  await expect
    .poll(
      () =>
        posthogRequests.filter(
          (request) => new URL(request.url).pathname === '/flags/'
        ).length
    )
    .toBeGreaterThanOrEqual(2);

  const initialFlagRequests = posthogRequests.filter(
    (request) => new URL(request.url).pathname === '/flags/'
  );
  const initialAnonymous = initialFlagRequests.find((request) =>
    String(request.body?.distinct_id).startsWith('mosaic_anon_')
  )?.body?.distinct_id;

  expect(initialAnonymous).toBeTruthy();
  expect(
    initialFlagRequests.some((request) => request.body?.distinct_id === USER_ID)
  ).toBe(true);
  for (const request of initialFlagRequests) {
    expect(Object.keys(request.body ?? {}).sort()).toEqual(['distinct_id', 'token']);
  }

  await page.evaluate(async () => {
    const adapter = await import('/src/lib/posthog.ts');
    adapter.syncPostHogIdentity(null);
  });

  await expect
    .poll(() =>
      posthogRequests
        .filter((request) => new URL(request.url).pathname === '/flags/')
        .map((request) => request.body?.distinct_id)
        .find(
          (distinctId) =>
            String(distinctId).startsWith('mosaic_anon_') &&
            distinctId !== initialAnonymous
        )
    )
    .toBeTruthy();

  const freshAnonymous = posthogRequests
    .filter((request) => new URL(request.url).pathname === '/flags/')
    .map((request) => request.body?.distinct_id)
    .find(
      (distinctId) =>
        String(distinctId).startsWith('mosaic_anon_') &&
        distinctId !== initialAnonymous
    );

  expect(freshAnonymous).not.toBe(USER_ID);

  await page.evaluate(async (userId) => {
    const adapter = await import('/src/lib/posthog.ts');
    adapter.syncPostHogIdentity(userId);
  }, USER_ID);

  await expect
    .poll(
      () =>
        posthogRequests.filter(
          (request) =>
            new URL(request.url).pathname === '/flags/' &&
            request.body?.distinct_id === USER_ID
        ).length
    )
    .toBeGreaterThanOrEqual(2);

  await page.evaluate(async () => {
    const adapter = await import('/src/lib/posthog.ts');
    const error = new Error('Playwright PostHog browser contract exception');
    error.stack =
      `Error: Playwright PostHog browser contract exception\n    at contract (${window.location.origin}/src/lib/posthog.ts:10:20)`;
    adapter.captureHandledException(error, { source: 'playwright-browser-contract' });
  });

  await expect
    .poll(
      () =>
        posthogRequests.filter(
          (request) => new URL(request.url).pathname === '/i/v0/e/'
        ).length
    )
    .toBe(1);

  const exceptionRequest = posthogRequests.find(
    (request) => new URL(request.url).pathname === '/i/v0/e/'
  );
  expect(exceptionRequest?.body).toEqual(
    expect.objectContaining({
      event: '$exception',
      distinct_id: USER_ID,
      properties: expect.objectContaining({
        source: 'playwright-browser-contract',
        $exception_level: 'error',
        $release_id: 'release_e2e',
      }),
    })
  );

  const properties = exceptionRequest.body.properties;
  expect(properties.email).toBeUndefined();
  expect(properties.name).toBeUndefined();
  expect(properties.prefs).toBeUndefined();
  expect(properties.$exception_list[0].mechanism.handled).toBe(true);
  expect(
    properties.$exception_list[0].stacktrace.frames.some(
      (frame) => frame.chunk_id === 'chunk_e2e'
    )
  ).toBe(true);

  const paths = [
    ...new Set(posthogRequests.map((request) => new URL(request.url).pathname)),
  ].sort();
  expect(paths).toEqual(['/flags/', '/i/v0/e/']);
});
