import { expect, test } from '@playwright/test';

const BASE_URL = process.env.MOSAIC_E2E_BASE_URL ?? 'https://127.0.0.1:4173';
const POSTHOG_ORIGIN = 'https://posthog.test';
const USER_ID = 'e2e_appwrite_user';

test.use({ ignoreHTTPSErrors: true });

test('PostHog probe survives redirect and stays privacy-minimal', async ({ page }) => {
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

  await page.goto(
    `${BASE_URL}/?__mosaic_posthog_probe=phase-3-7-exception`,
    { waitUntil: 'domcontentloaded' }
  );

  await expect.poll(() => new URL(page.url()).pathname).toBe('/home');
  await expect.poll(() => new URL(page.url()).search).toBe('');
  await expect
    .poll(
      () =>
        posthogRequests.filter(
          (request) => new URL(request.url).pathname === '/i/v0/e/'
        ).length
    )
    .toBe(1);

  const flagRequests = posthogRequests.filter(
    (request) => new URL(request.url).pathname === '/flags/'
  );
  expect(flagRequests.some((request) => String(request.body?.distinct_id).startsWith('mosaic_anon_'))).toBe(true);
  expect(flagRequests.some((request) => request.body?.distinct_id === USER_ID)).toBe(true);

  const exceptionRequest = posthogRequests.find(
    (request) => new URL(request.url).pathname === '/i/v0/e/'
  );
  expect(exceptionRequest?.body).toEqual(
    expect.objectContaining({
      event: '$exception',
      distinct_id: USER_ID,
      properties: expect.objectContaining({
        source: 'phase-3-7-live-probe',
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

  const paths = [...new Set(posthogRequests.map((request) => new URL(request.url).pathname))].sort();
  expect(paths).toEqual(['/flags/', '/i/v0/e/']);
});
