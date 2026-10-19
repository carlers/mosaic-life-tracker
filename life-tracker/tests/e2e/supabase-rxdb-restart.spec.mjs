import { expect, test } from '@playwright/test';

const BASE_URL = process.env.MOSAIC_E2E_BASE_URL ?? 'https://127.0.0.1:4173';

test('Supabase candidate RxDB retains native IndexedDB cursor and pending offline writes across reload', async ({ page }) => {
  const runId = 'sb' + Date.now().toString(36);
  const url = BASE_URL + '/tests/e2e/supabase-rxdb-restart.html?id=' + runId;
  const ready = async () =>
    page.waitForFunction(() => Boolean(window.__mosaicCandidateProbe));
  const snapshot = () => page.evaluate(() => window.__mosaicCandidateProbe.snapshot());
  const begin = async () => {
    await ready();
    await page.evaluate(() => window.__mosaicCandidateProbe.start());
  };

  await page.goto(url);
  await begin();
  const first = await snapshot();
  expect(first.local).toEqual([expect.objectContaining({
    name: 'From remote', userId: 'legacy_local_candidate_owner',
  })]);
  expect(first.afterCursors[0]).toBe('0');
  expect(first.remote).toHaveLength(1);

  // Close RxDB (without deleting IndexedDB), simulate an independent server
  // change, then reload the page and start the SAME replication identifier.
  await page.evaluate(async () => {
    await window.__mosaicCandidateProbe.stop();
    window.__mosaicCandidateProbe.seedAnotherRemoteRow();
  });
  await page.reload();
  await begin();
  const resumed = await snapshot();
  expect(resumed.local).toHaveLength(2);
  expect(resumed.remote).toHaveLength(2);
  expect(resumed.local.some(row => row.name === 'Created while replica closed')).toBe(true);
  expect(resumed.afterCursors[0]).toBe('1'); // RxDB persisted last remote sequence

  // An edit made while offline remains in the local browser database despite
  // the remote refusing writes; RxDB must not discard it as a merge conflict.
  await page.evaluate(async () => {
    window.__mosaicCandidateProbe.setOffline(true);
    await window.__mosaicCandidateProbe.editLocal();
  });
  await expect.poll(async () => (await snapshot()).failedOfflinePushes, {
    timeout: 15_000,
  }).toBeGreaterThan(0);
  const offline = await snapshot();
  expect(offline.local.some(row => row.name === 'Offline local edit')).toBe(true);
  expect(offline.remote.some(row => row.name === 'From remote')).toBe(true);

  // A brand-new page and RxDB instance must resume the unacknowledged push.
  await page.evaluate(() => window.__mosaicCandidateProbe.stop());
  await page.reload();
  await ready();
  await page.evaluate(() => window.__mosaicCandidateProbe.setOffline(false));
  await page.evaluate(() => window.__mosaicCandidateProbe.start());
  await expect.poll(async () =>
    (await snapshot()).remote.find(row => row.id === 'seed_first_' + runId)?.name,
    { timeout: 20_000 },
  ).toBe('Offline local edit');
  const recovered = await snapshot();
  expect(recovered.local).toHaveLength(2);
  expect(recovered.local.find(row => row.id === 'seed_first_' + runId)?.name)
    .toBe('Offline local edit');
  await page.evaluate(() => window.__mosaicCandidateProbe.stop());
});
