import type { CandidateIdentity } from '../../supabase-poc/candidateMapping';
import type { CandidateSessionProvider } from '../../supabase-poc/candidateHttpTransport';
import type { CandidateCoreGuard } from '../../supabase-poc/candidateCoreRuntime';

interface Authority {
  canonicalOwnerId: string;
  ownerId: string;
  backend: 'supabase-cloud';
  provenance: 'fresh-supabase';
  epoch: number;
  expiresAt: string;
}

/** Server-issued fresh identities only. Imported Appwrite owners fail closed. */
export function createSupabaseCoreAuthority(options: {
  baseUrl: string;
  publishableKey: string;
  session: CandidateSessionProvider;
  fetcher?: typeof fetch;
}) {
  let authority: Authority | null = null;
  const fetcher = options.fetcher ?? fetch;
  async function request(action: 'acquire' | 'release') {
    const signed = await options.session.getVerifiedSession();
    if (!signed) throw new Error('Core authority requires a verified account');
    const response = await fetcher(new URL('/rest/v1/rpc/mosaic_core_session', options.baseUrl), {
      method: 'POST', credentials: 'omit', cache: 'no-store', redirect: 'error',
      headers: {
        apikey: options.publishableKey, Authorization: `Bearer ${signed.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_action: action }),
    });
    if (!response.ok) throw new Error('Server denied core writer authority');
    const current = await options.session.getVerifiedSession();
    if (!current || current.userId !== signed.userId ||
        current.accessToken !== signed.accessToken || current.sessionEpoch !== signed.sessionEpoch)
      throw new Error('Core authority account changed during request');
    if (action === 'release') { authority = null; return; }
    const next = await response.json() as Authority;
    if (next.ownerId !== signed.userId ||
        next.canonicalOwnerId !== 'sb_' + signed.userId.replaceAll('-', '') ||
        next.provenance !== 'fresh-supabase' || next.backend !== 'supabase-cloud' ||
        !Number.isSafeInteger(next.epoch) || next.epoch < 1 ||
        !(Date.parse(next.expiresAt) > Date.now()))
      throw new Error('Invalid server-issued core authority');
    authority = next;
  }
  async function verify(identity: CandidateIdentity) {
    await request('acquire');
    if (authority?.canonicalOwnerId !== identity.legacyUserId ||
        authority?.ownerId !== identity.supabaseUserId)
      throw new Error('Core authority identity mismatch');
  }
  const guard: CandidateCoreGuard = {
    verifyLegacyMapping: verify,
    // A server-created fresh principal has no legacy Appwrite source account.
    // This proof must never be reused to authorize migrated/linked accounts.
    assertAppwriteWritersFenced: verify,
    async acquireExclusiveLease(identity) {
      await verify(identity);
      const epoch = authority!.epoch;
      let released = false;
      return {
        isCurrent: () => !released && authority?.epoch === epoch &&
          authority.ownerId === identity.supabaseUserId && Date.parse(authority.expiresAt) > Date.now(),
        async release() {
          await request('release');
          released = true;
        },
      };
    },
  };
  return {
    guard,
    async resolveIdentity(): Promise<CandidateIdentity> {
      await request('acquire');
      return { legacyUserId: authority!.canonicalOwnerId, supabaseUserId: authority!.ownerId };
    },
    renew: () => request('acquire'),
  };
}
