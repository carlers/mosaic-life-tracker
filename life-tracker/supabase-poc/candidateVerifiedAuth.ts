/**
 * Supabase candidate Auth verification boundary (isolated, NOT shipped).
 *
 * Never trust a locally decoded token for account ownership. Obtain the user
 * identity from Supabase Auth's GET /auth/v1/user for the exact access token,
 * then reject a session replaced while that request was in flight.
 * No service-role keys, refresh tokens, storage or real-user migration.
 */
import type { CandidateSessionProvider, CandidateVerifiedSession } from './candidateHttpTransport';

export interface CandidateAuthSnapshot {
  accessToken: string;
  /** Must change whenever the login, logout or account session changes. */
  sessionEpoch: number;
}

export interface CandidateAuthSnapshotProvider {
  getSessionSnapshot(): Promise<CandidateAuthSnapshot | null>;
}

export class CandidateAuthVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CandidateAuthVerificationError';
  }
}

export class CandidateAuthUnavailableError extends CandidateAuthVerificationError {}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function checkedSnapshot(snapshot: CandidateAuthSnapshot | null): CandidateAuthSnapshot | null {
  if (snapshot === null) return null;
  if (!snapshot || typeof snapshot.accessToken !== 'string' ||
    snapshot.accessToken.length < 8 || /\s/.test(snapshot.accessToken) ||
    !Number.isSafeInteger(snapshot.sessionEpoch) || snapshot.sessionEpoch < 0) {
    throw new CandidateAuthVerificationError('Invalid candidate Supabase Auth snapshot');
  }
  return snapshot;
}

export function createCandidateVerifiedAuthProvider(options: {
  baseUrl: string;
  publishableKey: string;
  sessions: CandidateAuthSnapshotProvider;
  fetcher?: typeof fetch;
}): CandidateSessionProvider {
  const url = new URL(options.baseUrl);
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) ||
    url.username || url.password || url.search || url.hash ||
    !['', '/'].includes(url.pathname)) {
    throw new Error('Candidate Auth endpoint must use HTTPS (loopback HTTP only), with no credentials/path/query');
  }
  if (!options.publishableKey ||
    options.publishableKey !== options.publishableKey.trim() ||
    options.publishableKey.startsWith('sb_secret_')) {
    throw new Error('Candidate Auth requires a public/publishable key');
  }
  const authUrl = new URL('/auth/v1/user', url).toString();
  const fetcher = options.fetcher ?? fetch;

  return {
    async getVerifiedSession(): Promise<CandidateVerifiedSession | null> {
      const before = checkedSnapshot(await options.sessions.getSessionSnapshot());
      if (!before) return null;
      let response: Response;
      try {
        response = await fetcher(authUrl, {
          method: 'GET',
          cache: 'no-store',
          credentials: 'omit',
          redirect: 'error',
          headers: {
            apikey: options.publishableKey,
            Authorization: 'Bearer ' + before.accessToken,
            Accept: 'application/json',
          },
        });
      } catch {
        // Not an authenticated session when Supabase Auth cannot be reached.
        // Never assume cached claims remain verified while offline.
        throw new CandidateAuthUnavailableError('Cannot verify Supabase Auth session');
      }
      if (response.status === 401 || response.status === 403) return null;
      if (!response.ok) {
        throw new CandidateAuthVerificationError('Supabase Auth verification unavailable');
      }
      let account: unknown;
      try { account = await response.json(); }
      catch { throw new CandidateAuthVerificationError('Malformed Supabase Auth response'); }
      const id = account && typeof account === 'object' &&
        'id' in account && (account as { id?: unknown }).id;
      if (typeof id !== 'string' || !UUID.test(id)) {
        throw new CandidateAuthVerificationError('Supabase Auth returned no valid user identity');
      }
      // Also compare raw token to detect session replacement even if caller
      // forgets to bump sessionEpoch. The token is never printed.
      const after = checkedSnapshot(await options.sessions.getSessionSnapshot());
      if (!after || after.sessionEpoch !== before.sessionEpoch ||
        after.accessToken !== before.accessToken) {
        throw new CandidateAuthVerificationError('Supabase account changed during verification');
      }
      return { userId: id, accessToken: before.accessToken, sessionEpoch: before.sessionEpoch };
    },
  };
}
