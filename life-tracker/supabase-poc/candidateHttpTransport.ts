/**
 * Signed candidate transport, also used by the gated app-owned core bridge.
 * Never invoked by the shipped Appwrite AuthProvider.
 * This does not verify JWT signatures. Its session provider MUST obtain a
 * server-verified Supabase Auth user and a matching access token. Never pass
 * service-role/secret keys to client code. Every request rechecks account epoch.
 */
import { parseCandidateRevision } from './candidateMapping';
import type { CandidateChangeTransport, CandidateReadDomain } from './candidatePull';

export interface CandidateVerifiedSession {
  userId: string;
  accessToken: string;
  /** Increment on login, logout, account switch or session replacement. */
  sessionEpoch: number;
}

export interface CandidateSessionProvider {
  getVerifiedSession(): Promise<CandidateVerifiedSession | null>;
}

export class CandidateAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CandidateAuthError';
  }
}

export class CandidateHttpError extends Error {
  readonly status: number;
  constructor(status: number) {
    super('Candidate Supabase HTTP request failed with status ' + status);
    this.status = status;
    this.name = 'CandidateHttpError';
  }
}

export function createCandidateHttpTransport(options: {
  baseUrl: string;
  publishableKey: string;
  session: CandidateSessionProvider;
  fetcher?: typeof fetch;
}): CandidateChangeTransport {
  const base = new URL(options.baseUrl);
  const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname);
  if (
    (base.protocol !== 'https:' && !(base.protocol === 'http:' && isLocal)) ||
    base.username || base.password || base.search || base.hash
  ) throw new Error('Candidate endpoint must use HTTPS (HTTP only for localhost)');
  if (!options.publishableKey?.startsWith('sb_publishable_') || options.publishableKey.trim() !== options.publishableKey || /\s/.test(options.publishableKey))
    throw new Error('Missing or invalid candidate publishable key');

  const fetcher = options.fetcher ?? fetch;
  const tables: Record<CandidateReadDomain, string> = {
    tasks: 'mosaic_candidate_tasks',
    categories: 'mosaic_candidate_categories',
    diary: 'mosaic_candidate_diary',
    settings: 'mosaic_candidate_settings',
  };

  async function checkedSession(ownerId: string): Promise<CandidateVerifiedSession> {
    const current = await options.session.getVerifiedSession();
    if (!current || !current.userId || !current.accessToken ||
      !Number.isSafeInteger(current.sessionEpoch) || current.sessionEpoch < 0 ||
      current.userId !== ownerId
    ) throw new CandidateAuthError('Candidate owner has no matching verified session');
    return current;
  }

  return {
    async listChanges<Row>({
      domain, ownerId, afterExclusive, batchSize,
    }: {
      domain: CandidateReadDomain;
      ownerId: string;
      afterExclusive: string;
      batchSize: number;
    }): Promise<Row[]> {
      const session = await checkedSession(ownerId);
      if (!Object.prototype.hasOwnProperty.call(tables, domain) ||
        !Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 100
      ) throw new Error('Invalid candidate transport request');
      const after = parseCandidateRevision(afterExclusive).toString();
      const url = new URL(base.toString());
      url.pathname = base.pathname.replace(/\/$/, '') + '/rest/v1/' + tables[domain];
      url.searchParams.set('owner_id', 'eq.' + ownerId);
      url.searchParams.set('change_seq', 'gt.' + after);
      url.searchParams.set('order', 'change_seq.asc');
      url.searchParams.set('limit', String(batchSize));

      const response = await fetcher(url.toString(), {
        method: 'GET',
        cache: 'no-store',
        credentials: 'omit',
        headers: {
          apikey: options.publishableKey,
          Authorization: 'Bearer ' + session.accessToken,
          Accept: 'application/json',
        },
      });
      if (response.status === 401 || response.status === 403)
        throw new CandidateAuthError('Candidate Supabase session was denied');
      if (!response.ok) throw new CandidateHttpError(response.status);
      const rows: unknown = await response.json();
      if (!Array.isArray(rows)) throw new Error('Invalid candidate JSON page');

      // Reject in-flight results after a logout/account switch/session replacement,
      // even when the HTTP request was issued under a formerly valid account.
      const current = await checkedSession(ownerId);
      if (current.sessionEpoch !== session.sessionEpoch ||
        current.accessToken !== session.accessToken)
        throw new CandidateAuthError('Candidate account changed during request');
      return rows as Row[];
    },
  };
}
