import { CandidateBucketTargetsPendingError } from '../../supabase-poc/candidateBucketMapping';
import { describe, expect, it, vi } from 'vitest';
import { createSupabasePersonalAuthority } from '../../src/lib/supabasePersonalAuthority';
const owner = '11111111-1111-4111-8111-111111111111';
const identity = { legacyUserId: 'sb_' + owner.replaceAll('-', ''), supabaseUserId: owner };
const approved = () => ({ version: 1, provider: 'supabase-cloud', providerUserId: owner,
  mosaicAccountId: identity.legacyUserId, provenance: 'server-enrolled', historyState: 'fresh',
  consentVersion: 1, personalReady: true });
function fixture() {
  let epoch = 1;
  const fetcher = vi.fn(async () => new Response(JSON.stringify(approved())));
  const guard = { verifyLegacyMapping: vi.fn(), assertAppwriteWritersFenced: vi.fn(), acquireExclusiveLease: vi.fn() };
  const result = createSupabasePersonalAuthority({ baseUrl: 'https://isolated.supabase.co',
    publishableKey: 'sb_publishable_test', identity, guard,
    session: { getVerifiedSession: async () => ({ userId: owner, accessToken: 'signed', sessionEpoch: epoch }) }, fetcher });
  return { ...result, fetcher, change: () => { epoch++; } };
}
describe('personal app authority', () => {
  it.each(['fresh', 'recovery-pending'])('permits only approved independent %s new-data authority', async historyState => {
    const f = fixture();
    f.fetcher.mockImplementation(async () => new Response(JSON.stringify({ ...approved(), historyState })));
    await f.guard.assertHostedSixDomainRecoveryReady(identity);
    await f.guard.assertOriginalOwnerEscrowAndOutboxReady(identity);
    const call = f.fetcher.mock.calls[0] as unknown as [URL, RequestInit];
    expect(String(call[0])).toContain('/rpc/mosaic_personal_readiness');
    expect(call[1].body).toBe('{}');
  });
  it.each([{ personalReady: false }, { historyState: 'unconfirmed' }, { historyState: 'recovered' },
    { provenance: 'verified-owner-escrow' }, { mosaicAccountId: 'legacy_owner' },
    { providerUserId: 'other' }, { consentVersion: null }])('denies unapproved or historical authority %j', async change => {
    const f = fixture();
    f.fetcher.mockImplementation(async () => new Response(JSON.stringify({ ...approved(), ...change })));
    await expect(f.guard.assertHostedSixDomainRecoveryReady(identity)).rejects.toThrow('unavailable');
  });
  it('rejects a release response after a signed session switch', async () => {
    const f = fixture();
    f.fetcher.mockImplementation(async () => { f.change(); return new Response(JSON.stringify(approved())); });
    await expect(f.guard.assertHostedSixDomainRecoveryReady(identity)).rejects.toThrow('unavailable');
  });
  it('retains a link whose signed remote target is missing instead of trusting a local ID', async () => {
    const f = fixture();
    f.fetcher.mockImplementation(async () => new Response('[]'));
    await expect(f.verifyBucketLinkTargets({ id: 'link', userId: identity.legacyUserId,
      bucketListId: 'bucket', taskId: 'task', isDeleted: false } as never)).rejects.toBeInstanceOf(CandidateBucketTargetsPendingError);
    expect(f.fetcher).toHaveBeenCalledTimes(2);
  });
});
