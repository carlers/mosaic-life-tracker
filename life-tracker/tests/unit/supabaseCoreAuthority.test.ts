import { describe, expect, it, vi } from 'vitest';
import { createSupabaseCoreAuthority } from '../../src/lib/supabaseCoreAuthority';

const owner = '11111111-1111-4111-8111-111111111111';
const canonical = 'sb_' + owner.replaceAll('-', '');
const signed = { userId: owner, accessToken: 'synthetic_test_access_token', sessionEpoch: 1 };
const payload = () => ({
  ownerId: owner, canonicalOwnerId: canonical, provenance: 'fresh-supabase',
  backend: 'supabase-cloud', epoch: 1, expiresAt: new Date(Date.now() + 60_000).toISOString(),
});
function setup(body = payload(), status = 200) {
  const session = { getVerifiedSession: vi.fn().mockResolvedValue(signed) };
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(body), { status }));
  const authority = createSupabaseCoreAuthority({
    baseUrl: 'https://isolated.example', publishableKey: 'sb_publishable_test',
    session, fetcher,
  });
  return { authority, session, fetcher };
}

describe('fresh core server authority', () => {
  it('resolves only the matching server-issued identity and releases its lease', async () => {
    const { authority, fetcher } = setup();
    const identity = await authority.resolveIdentity();
    expect(identity).toEqual({ legacyUserId: canonical, supabaseUserId: owner });
    // A fresh Response per request models the actual fetch body contract.
    fetcher.mockImplementation(async () => new Response(JSON.stringify(payload())));
    const lease = await authority.guard.acquireExclusiveLease(identity);
    expect(lease.isCurrent()).toBe(true);
    await lease.release();
    expect(lease.isCurrent()).toBe(false);
    expect(JSON.parse(String(fetcher.mock.calls.at(-1)?.[1]?.body))).toEqual({ p_action: 'release' });
  });

  it.each([
    { ownerId: '22222222-2222-4222-8222-222222222222' },
    { canonicalOwnerId: 'existing_appwrite_owner' },
    { provenance: 'imported-appwrite' },
    { backend: 'frozen' },
    { epoch: 0 },
    { expiresAt: '2000-01-01T00:00:00.000Z' },
  ])('rejects an unauthorized identity or authority: %j', async patch => {
    const { authority } = setup({ ...payload(), ...patch });
    await expect(authority.resolveIdentity()).rejects.toThrow();
  });

  it('fails closed on a signed server denial rather than inventing a mapping', async () => {
    const { authority } = setup(payload(), 403);
    await expect(authority.resolveIdentity()).rejects.toThrow('denied');
  });

  it('rejects a token rotation during the RPC response', async () => {
    const { authority, session } = setup();
    session.getVerifiedSession.mockResolvedValueOnce(signed).mockResolvedValueOnce({
      ...signed, sessionEpoch: 2, accessToken: 'replacement_test_token',
    });
    await expect(authority.resolveIdentity()).rejects.toThrow('changed');
  });

  it('does not confirm release when the server cannot be reached', async () => {
    const { authority, fetcher } = setup();
    const lease = await authority.guard.acquireExclusiveLease({
      legacyUserId: canonical, supabaseUserId: owner,
    });
    fetcher.mockRejectedValue(new Error('offline'));
    await expect(lease.release()).rejects.toThrow();
    expect(lease.isCurrent()).toBe(true);
  });

  it('never releases a replacement account when an old handle survives a session switch', async () => {
    const { authority, session, fetcher } = setup();
    const lease = await authority.guard.acquireExclusiveLease({
      legacyUserId: canonical, supabaseUserId: owner,
    });
    session.getVerifiedSession.mockResolvedValue({ ...signed, userId: '22222222-2222-4222-8222-222222222222' });
    fetcher.mockClear();
    await expect(lease.release()).rejects.toThrow('owner changed');
    expect(fetcher).not.toHaveBeenCalled();
  });
});
