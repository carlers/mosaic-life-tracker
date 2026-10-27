import { describe, expect, it, vi } from 'vitest';
import { createSupabaseAccountRegistry } from '../../src/lib/supabaseAccountRegistry';
const owner = '11111111-1111-4111-8111-111111111111';
const identity = { legacyUserId: 'sb_' + owner.replaceAll('-', ''), supabaseUserId: owner };
const snapshot = () => ({ version: 1, provider: 'supabase-cloud', providerUserId: owner,
  mosaicAccountId: identity.legacyUserId, installationId: '22222222-2222-4222-8222-222222222222',
  mappingVersion: 1, provenance: 'server-enrolled', historyState: 'unconfirmed', consentVersion: null });
function fixture() {
  let current = { userId: owner, accessToken: 'signed-owner', sessionEpoch: 1 };
  const fetcher = vi.fn(async () => new Response(JSON.stringify(snapshot()), { status: 200 }));
  const registry = createSupabaseAccountRegistry({ baseUrl: 'https://isolated.supabase.co',
    publishableKey: 'sb_publishable_test', session: { getVerifiedSession: async () => current }, fetcher });
  return { registry, fetcher, change: () => { current = { ...current, sessionEpoch: 2 }; } };
}
describe('server account registry adapter', () => {
  it('uses signed self lookup without email, passwords, claimed IDs or authority mutation', async () => {
    const f = fixture();
    expect(await f.registry.read(identity)).toEqual(snapshot());
    const call = f.fetcher.mock.calls[0] as unknown as [URL, RequestInit];
    expect(String(call[0])).toBe('https://isolated.supabase.co/rest/v1/rpc/mosaic_account_status');
    expect(JSON.parse(call[1].body as string)).toEqual({ p_start_mode: null });
    expect(call[1]).toMatchObject({ credentials: 'omit', cache: 'no-store', redirect: 'error' });
  });
  it.each([
    { mosaicAccountId: 'forged' }, { providerUserId: 'foreign' }, { provider: 'appwrite-cloud' },
    { historyState: 'recovered', consentVersion: null }, { historyState: 'unknown' },
    { mappingVersion: 0 }, { provenance: 'matching-email' }, { installationId: 'unknown' },
  ])('refuses malformed or foreign associations %j', async change => {
    const f = fixture();
    f.fetcher.mockResolvedValue(new Response(JSON.stringify({ ...snapshot(), ...change })));
    await expect(f.registry.read(identity)).rejects.toThrow('Invalid server account');
    expect(f.registry.snapshot()).toBeNull();
  });
  it('does not accept a delayed response after a session change', async () => {
    const f = fixture();
    f.fetcher.mockImplementation(async () => { f.change(); return new Response(JSON.stringify(snapshot())); });
    await expect(f.registry.read(identity)).rejects.toThrow('Account changed');
  });
  it('requires the server to acknowledge the exact explicit start choice', async () => {
    const f = fixture();
    await expect(f.registry.read(identity, 'recovery-pending')).rejects.toThrow('Invalid server account');
    f.fetcher.mockResolvedValue(new Response(JSON.stringify({ ...snapshot(),
      historyState: 'recovery-pending', consentVersion: 1 })));
    expect((await f.registry.read(identity, 'recovery-pending')).historyState).toBe('recovery-pending');
    const call = f.fetcher.mock.calls.at(-1) as unknown as [URL, RequestInit];
    expect(JSON.parse(call[1].body as string)).toEqual({ p_start_mode: 'recovery-pending' });
  });
});
