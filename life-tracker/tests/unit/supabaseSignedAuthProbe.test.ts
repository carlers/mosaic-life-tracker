import { describe, expect, it } from 'vitest';
import { runSignedAuthProbe, ISOLATED_PROJECT_REF } from '../../supabase-poc/signed-auth-probe.mjs';

const origin = 'https://' + ISOLATED_PROJECT_REF + '.supabase.co';
const aliceId = '11111111-1111-4111-8111-111111111111';
const bobId = '22222222-2222-4222-8222-222222222222';
const nonce = '33333333-3333-4333-8333-333333333333';
const config = {
  baseUrl: origin, publishableKey: 'sb_publishable_test_public',
  alice: { email: 'disposable-a@example.test', password: 'disposable-pass-A' },
  bob: { email: 'disposable-b@example.test', password: 'disposable-pass-B' },
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function fixture({
  leakForeign = false, allowUpdate = false, sameUser = false,
  leakPrivateForeign = false, allowPrivateAnonRead = false, allowPrivateAnonRpc = false,
  populateOwned = false, missingOwnedTable = null, leakUnfiltered = false, leakExactId = false,
  pageThroughOwned = false, leakOnLaterPage = false, duplicateInPage = false,
} = {}) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetcher = async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const path = new URL(url).pathname;
    const bearer = (init.headers as Record<string, string>).Authorization;
    const alice = bearer === 'Bearer signed-token-alice';
    const bob = bearer === 'Bearer signed-token-bob';
    if (path === '/auth/v1/token') {
      const body = JSON.parse(String(init.body));
      const a = body.email === config.alice.email;
      return json({
        access_token: a ? 'signed-token-alice' : 'signed-token-bob',
        user: { id: a || sameUser ? aliceId : bobId },
      });
    }
    if (path === '/auth/v1/user') return json({ id: alice || sameUser ? aliceId : bobId });
    const privateTables = ['mosaic_candidate_diary', 'mosaic_candidate_settings', 'mosaic_candidate_buckets',
      'mosaic_candidate_bucket_task_links'];
    if (path.startsWith('/rest/v1/rpc/')) {
      if (!alice && !bob) {
        if (allowPrivateAnonRpc && path.endsWith('mosaic_candidate_cas_bucket_link'))
          return json(null);
        return json({ code: '42501' }, 403);
      }
      const body = JSON.parse(String(init.body));
      return 'owner_id' in body.p_patch ? json({ code: '22023' }, 400) : json(null);
    }
    if (init.method === 'PATCH' || init.method === 'DELETE')
      return allowUpdate ? new Response(null, { status: 204 }) : json({ code: '42501' }, 403);
    if (!alice && !bob) {
      if (allowPrivateAnonRead && path.includes('/rest/v1/mosaic_candidate_settings'))
        return json([]);
      return json({ code: '42501' }, 403);
    }
    const query = new URL(url).searchParams;
    if (query.has('id'))
      return leakExactId ? json([{ id: 'foreign-row', owner_id: alice ? bobId : aliceId }]) : json([]);
    const isForeign = query.has('owner_id');
    if (isForeign && (leakForeign ||
      (leakPrivateForeign && privateTables.some(table => path.endsWith('/' + table)))))
      return json([{ id: 'foreign' }]);
    // A correct owner-scoped query cannot return the signed user's own fixture.
    if (isForeign) return json([]);
    if (leakUnfiltered)
      return json([{ id: 'leaked-row', owner_id: alice ? bobId : aliceId }]);
    if (duplicateInPage)
      return json([
        { id: 'duplicate-owner', owner_id: alice ? aliceId : bobId },
        { id: 'duplicate-owner', owner_id: alice ? aliceId : bobId },
      ]);
    if (pageThroughOwned || leakOnLaterPage) {
      if (query.get('offset') === '0')
        return json(Array.from({ length: 200 }, (_, index) => ({
          id: 'page-owner-' + index, owner_id: alice ? aliceId : bobId,
        })));
      if (query.get('offset') === '200')
        return json([{ id: 'next-page-row',
          owner_id: leakOnLaterPage ? (alice ? bobId : aliceId) : (alice ? aliceId : bobId) }]);
    }
    if (populateOwned && !path.endsWith('/' + missingOwnedTable))
      return json([{ id: alice ? 'fixture-a' : 'fixture-b', owner_id: alice ? aliceId : bobId }]);
    return json([]);
  };
  return { fetcher: fetcher as typeof fetch, calls };
}

describe('isolated Supabase genuine-signed-user denial-path harness (#967)', () => {
  it('verifies two Auth users and grant boundaries, without requiring fixture writes', async () => {
    const { fetcher, calls } = fixture();
    const result = await runSignedAuthProbe(config, { fetcher, nonce });
    expect(result).toEqual({
      signedUsers: 2, ownReads: 12, foreignReads: 12, deniedTableWrites: 12,
      deniedAnonymousCalls: 12, rpcConflicts: 6, rejectedRpcFields: 6,
    });
    expect(calls.every(c => c.url.startsWith(origin + '/'))).toBe(true);
    expect(calls.every(c => c.init.credentials === 'omit' &&
      c.init.redirect === 'error')).toBe(true);
    expect(calls.filter(c => c.init.method === 'POST' &&
      c.url.includes('rpc/'))).toHaveLength(18);
    expect(JSON.stringify(calls)).not.toContain('sb_secret_');
  });

  it('checks signed/anonymous reads and both forbidden direct writes for all six domains', async () => {
    const { fetcher, calls } = fixture();
    await runSignedAuthProbe(config, { fetcher, nonce });
    const tables = [
      'mosaic_candidate_tasks', 'mosaic_candidate_categories', 'mosaic_candidate_diary',
      'mosaic_candidate_settings', 'mosaic_candidate_buckets',
      'mosaic_candidate_bucket_task_links',
    ];
    for (const table of tables) {
      const requests = calls.filter(c => new URL(c.url).pathname === '/rest/v1/' + table);
      expect(requests.filter(c => c.init.method === 'PATCH')).toHaveLength(1);
      expect(requests.filter(c => c.init.method === 'DELETE')).toHaveLength(1);
      expect(requests.filter(c => !('Authorization' in (c.init.headers as Record<string, string>)) &&
        c.init.method === 'GET')).toHaveLength(1);
      expect(requests.filter(c => new URL(c.url).searchParams.has('owner_id'))).toHaveLength(2);
    }
  });

  it('rejects non-isolated targets, secret keys, duplicate account and unverified identities', async () => {
    let called = 0;
    const fetcher = (async (...args: Parameters<typeof fetch>) => {
      called++;
      return fixture().fetcher(...args);
    }) as typeof fetch;
    for (const override of [
      { baseUrl: 'https://production.example' },
      { baseUrl: 'http://' + ISOLATED_PROJECT_REF + '.supabase.co' },
      { publishableKey: 'sb_secret_danger' },
      { publishableKey: 'eyJhbGciOiJIUzI1NiJ9.fake.service-role-key' },
      { bob: config.alice },
    ]) {
      await expect(runSignedAuthProbe({ ...config, ...override }, { fetcher, nonce }))
        .rejects.toThrow();
    }
    expect(called).toBe(0);
    await expect(runSignedAuthProbe(config, {
      fetcher: fixture({ sameUser: true }).fetcher, nonce,
    })).rejects.toThrow(/same Auth user/);
  });

  it('fails closed if a foreign response leaks rows or direct UPDATE succeeds', async () => {
    await expect(runSignedAuthProbe(config, {
      fetcher: fixture({ leakForeign: true }).fetcher, nonce,
    })).rejects.toThrow(/Foreign-owner/);
    await expect(runSignedAuthProbe(config, {
      fetcher: fixture({ allowUpdate: true }).fetcher, nonce,
    })).rejects.toThrow(/Direct mosaic_candidate_tasks PATCH/);
  });

  it('fails closed when any private domain leaks a foreign row or anonymous access', async () => {
    await expect(runSignedAuthProbe(config, {
      fetcher: fixture({ leakPrivateForeign: true }).fetcher, nonce,
    })).rejects.toThrow(/Foreign-owner/);
    await expect(runSignedAuthProbe(config, {
      fetcher: fixture({ allowPrivateAnonRead: true }).fetcher, nonce,
    })).rejects.toThrow(/Anonymous private/);
    await expect(runSignedAuthProbe(config, {
      fetcher: fixture({ allowPrivateAnonRpc: true }).fetcher, nonce,
    })).rejects.toThrow(/Anonymous privileged RPC/);
  });

  it('does not equate an unfiltered foreign-owner leak with an authenticated own read', async () => {
    await expect(runSignedAuthProbe(config, {
      fetcher: fixture({ leakUnfiltered: true }).fetcher, nonce,
    })).rejects.toThrow(/unfiltered table SELECT leaked/);
  });

  it('audits all owner-visible pages and rejects a late foreign-row leak', async () => {
    const { fetcher, calls } = fixture({ pageThroughOwned: true });
    const counts = await runSignedAuthProbe(config, { fetcher, nonce });
    expect(counts.ownReads).toBe(12);
    const laterPages = calls.filter(c => new URL(c.url).searchParams.get('offset') === '200');
    expect(laterPages).toHaveLength(12);
    expect(laterPages.every(c => new URL(c.url).searchParams.get('order') === 'id.asc')).toBe(true);
    await expect(runSignedAuthProbe(config, {
      fetcher: fixture({ leakOnLaterPage: true }).fetcher, nonce,
    })).rejects.toThrow(/unfiltered table SELECT leaked/);
    await expect(runSignedAuthProbe(config, {
      fetcher: fixture({ duplicateInPage: true }).fetcher, nonce,
    })).rejects.toThrow(/duplicate or invalid row/);
  });

  it('strict mode requires existing two-owner fixture rows in all six tables and proves exact-ID denials', async () => {
    const { fetcher, calls } = fixture({ populateOwned: true });
    const totals = await runSignedAuthProbe(config, {
      fetcher, nonce, requireOwnedFixtures: true,
    });
    expect(totals).toMatchObject({
      signedUsers: 2, ownReads: 12, foreignReads: 12,
      verifiedOwnedFixtures: 12, deniedFixtureById: 12,
      deniedTableWrites: 12, deniedAnonymousCalls: 12,
      rpcConflicts: 6, rejectedRpcFields: 6,
    });
    const exact = calls.filter(c => c.init.method === 'GET' &&
      new URL(c.url).searchParams.has('id'));
    expect(exact).toHaveLength(12);
    expect(new Set(exact.map(c => new URL(c.url).pathname))).toEqual(new Set([
      '/rest/v1/mosaic_candidate_tasks', '/rest/v1/mosaic_candidate_categories',
      '/rest/v1/mosaic_candidate_diary', '/rest/v1/mosaic_candidate_settings',
      '/rest/v1/mosaic_candidate_buckets', '/rest/v1/mosaic_candidate_bucket_task_links',
    ]));
    expect(calls.every(c => c.url.startsWith(origin + '/'))).toBe(true);
  });

  it('fails strict proof for empty owner domain or a leaked exact-ID foreign row', async () => {
    await expect(runSignedAuthProbe(config, {
      fetcher: fixture().fetcher, nonce, requireOwnedFixtures: true,
    })).rejects.toThrow(/needs an existing owner fixture/);
    await expect(runSignedAuthProbe(config, {
      fetcher: fixture({ populateOwned: true, missingOwnedTable: 'mosaic_candidate_settings' }).fetcher,
      nonce, requireOwnedFixtures: true,
    })).rejects.toThrow(/needs an existing owner fixture/);
    await expect(runSignedAuthProbe(config, {
      fetcher: fixture({ populateOwned: true, leakExactId: true }).fetcher,
      nonce, requireOwnedFixtures: true,
    })).rejects.toThrow(/could read an exact fixture row/);
  });

  it('never sends signup or a row insert in the signed owner RLS probe', async () => {
    const { fetcher, calls } = fixture();
    const summary = await runSignedAuthProbe(config, { fetcher, nonce });
    expect(summary.signedUsers).toBe(2);
    expect(calls.every(c => !c.url.includes('/auth/v1/signup') &&
      (c.init.method !== 'POST' || (c.url.includes('/auth/v1/token') ||
        c.url.includes('/rest/v1/rpc/'))))).toBe(true);
    for (const rowWrite of calls.filter(c => c.init.method === 'PATCH' ||
      c.init.method === 'DELETE')) {
      expect(rowWrite.url).toContain('id=eq.probe_');
    }
  });
});
