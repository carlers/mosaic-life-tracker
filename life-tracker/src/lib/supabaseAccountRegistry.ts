import type { CandidateIdentity } from '../../supabase-poc/candidateMapping';
import { validateCandidateIdentity } from '../../supabase-poc/candidateMapping';
import type { CandidateSessionProvider } from '../../supabase-poc/candidateHttpTransport';

export type AccountStartMode = 'fresh' | 'recovery-pending';
export interface MosaicAccountStatus {
  version: 1;
  mosaicAccountId: string;
  provider: 'supabase-cloud';
  providerUserId: string;
  installationId: string;
  mappingVersion: number;
  provenance: 'server-enrolled' | 'verified-owner-escrow' | 'verified-provider-session';
  historyState: 'unconfirmed' | 'fresh' | 'recovery-pending' | 'recovered';
  consentVersion: 1 | null;
}
export class SupabaseAccountStartRequiredError extends Error {
  constructor() { super('Choose how to start this Mosaic account'); }
}

/** Signed self lookup. No email/legacy-owner arguments or browser mapping authority. */
export function createSupabaseAccountRegistry(options: {
  baseUrl: string; publishableKey: string; session: CandidateSessionProvider;
  fetcher?: typeof fetch;
}) {
  const fetcher = options.fetcher ?? fetch;
  const base = new URL(options.baseUrl);
  if ((base.protocol !== 'https:' && !(base.protocol === 'http:' &&
      ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname))) ||
      base.username || base.password || base.search || base.hash || base.pathname !== '/' ||
      !/^sb_publishable_\S+$/.test(options.publishableKey))
    throw new Error('Account registry requires the explicit public backend');
  let status: MosaicAccountStatus | null = null;
  async function read(identity: CandidateIdentity, mode?: AccountStartMode) {
    validateCandidateIdentity(identity);
    if (mode !== undefined && mode !== 'fresh' && mode !== 'recovery-pending')
      throw new Error('Invalid account start choice');
    const signed = await options.session.getVerifiedSession();
    if (!signed || signed.userId !== identity.supabaseUserId || !signed.accessToken ||
        !Number.isSafeInteger(signed.sessionEpoch) || signed.sessionEpoch < 0)
      throw new Error('Account registry requires a matching signed owner');
    status = null;
    const response = await fetcher(new URL('/rest/v1/rpc/mosaic_account_status', base), {
      method: 'POST', credentials: 'omit', redirect: 'error', cache: 'no-store',
      headers: { apikey: options.publishableKey, Authorization: `Bearer ${signed.accessToken}`,
        'Content-Type': 'application/json' },
      body: JSON.stringify({ p_start_mode: mode ?? null }),
    });
    if (!response.ok) throw new Error('Account registry refused the request');
    const next = await response.json() as MosaicAccountStatus;
    const current = await options.session.getVerifiedSession();
    if (!current || current.userId !== signed.userId ||
        current.accessToken !== signed.accessToken || current.sessionEpoch !== signed.sessionEpoch)
      throw new Error('Account changed during registry verification');
    if (!next || next.version !== 1 || next.provider !== 'supabase-cloud' ||
        next.providerUserId !== signed.userId || next.mosaicAccountId !== identity.legacyUserId ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(next.installationId) ||
        !Number.isSafeInteger(next.mappingVersion) || next.mappingVersion < 1 ||
        !['server-enrolled', 'verified-owner-escrow', 'verified-provider-session'].includes(next.provenance) ||
        !['unconfirmed', 'fresh', 'recovery-pending', 'recovered'].includes(next.historyState) ||
        (next.historyState === 'unconfirmed' ? next.consentVersion !== null : next.consentVersion !== 1) ||
        (mode !== undefined && next.historyState !== mode))
      throw new Error('Invalid server account association');
    status = Object.freeze({ ...next });
    return { ...status };
  }
  return { read, snapshot: () => status ? { ...status } : null };
}
