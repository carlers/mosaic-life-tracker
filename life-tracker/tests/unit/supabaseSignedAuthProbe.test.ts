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

function fixture({ leakForeign = false, allowUpdate = false, sameUser = false } = {}) {
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
    if (path.startsWith('/rest/v1/rpc/')) {
      if (!alice && !bob) return json({ code: '42501' }, 403);
      const body = JSON.parse(String(init.body));
      return 'owner_id' in body.p_patch ? json({ code: '22023' }, 400) : json(null);
    }
    if (init.method === 'PATCH' || init.method === 'DELETE')
      return allowUpdate ? new Response(null, { status: 204 }) : json({ code: '42501' }, 403);
    if (!alice && !bob) return json({ code: '42501' }, 403);
    if (leakForeign && new URL(url).searchParams.has('owner_id'))
      return json([{ id: 'foreign' }]);
    return json([]);
  };
  return { fetcher: fetcher as typeof fetch, calls };
}

describe('isolated Supabase genuine-signed-user denial-path harness (#967)', () => {
  it('verifies two Auth users and grant boundaries, without requiring fixture writes', async () => {
    const { fetcher, calls } = fixture();
    const result = await runSignedAuthProbe(config, { fetcher, nonce });
    expect(result).toEqual({
      signedUsers: 2, ownReads: 4, foreignReads: 4, deniedTableWrites: 2,
      deniedAnonymousCalls: 3, rpcConflicts: 2, rejectedRpcFields: 2,
    });
    expect(calls.every(c => c.url.startsWith(origin + '/'))).toBe(true);
    expect(calls.every(c => c.init.credentials === 'omit' &&
      c.init.redirect === 'error')).toBe(true);
    expect(calls.filter(c => c.init.method === 'POST' &&
      c.url.includes('rpc/'))).toHaveLength(6);
    expect(JSON.stringify(calls)).not.toContain('sb_secret_');
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
    })).rejects.toThrow(/Direct UPDATE/);
  });
});
