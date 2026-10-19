/**
 * #1027: experimental browser Supabase Auth lifecycle for core-owner pilots.
 *
 * Isolated candidate only. Never imported by the Appwrite AuthProvider.
 * Tokens live in memory, are never logged, persisted or decoded for ownership.
 * Full durable/offline session integration and password migration are OPEN.
 */
import {
  createCandidateVerifiedAuthProvider,
  type CandidateAuthSnapshot,
} from './candidateVerifiedAuth';
import type { CandidateVerifiedSession } from './candidateHttpTransport';

type Tokens = {
  accessToken: string;
  refreshToken: string;
  ownerId: string;
  expiresAt: number;
};
export class CandidateSessionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CandidateSessionError';
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function parseAuthTokens(payload: unknown, ownerId: string | null = null): Tokens {
  if (!payload || typeof payload !== 'object') throw new CandidateSessionError('Invalid Auth token response');
  const raw = payload as Record<string, unknown>;
  const user = raw.user && typeof raw.user === 'object' ? raw.user as Record<string, unknown> : null;
  const id = user?.id;
  if (typeof id !== 'string' || !UUID.test(id) ||
      (ownerId !== null && ownerId !== id) ||
      typeof raw.access_token !== 'string' || raw.access_token.length < 12 ||
      typeof raw.refresh_token !== 'string' || raw.refresh_token.length < 12 ||
      (raw.token_type !== undefined && raw.token_type !== 'bearer') ||
      typeof raw.expires_in !== 'number' || !Number.isFinite(raw.expires_in) ||
      raw.expires_in < 1) {
    throw new CandidateSessionError('Invalid or mismatched Auth session');
  }
  return {
    accessToken: raw.access_token,
    refreshToken: raw.refresh_token,
    ownerId: id,
    expiresAt: Date.now() + raw.expires_in * 1000,
  };
}

export function createCandidateAuthSession(options: {
  baseUrl: string;
  publishableKey: string;
  fetcher?: typeof fetch;
}) {
  const base = new URL(options.baseUrl);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname);
  if ((base.protocol !== 'https:' && !(base.protocol === 'http:' && local)) ||
      base.username || base.password || base.search || base.hash ||
      !['', '/'].includes(base.pathname)) {
    throw new Error('Candidate Auth requires HTTPS or loopback root URL');
  }
  if (!options.publishableKey.startsWith('sb_publishable_') ||
      options.publishableKey.trim() !== options.publishableKey ||
      /\s/.test(options.publishableKey)) {
    throw new Error('Candidate Auth requires a modern publishable key');
  }
  const fetcher = options.fetcher ?? fetch;
  let active: Tokens | null = null;
  let epoch = 0;
  let refreshInFlight: Promise<CandidateVerifiedSession> | null = null;

  const sessions = {
    async getSessionSnapshot(): Promise<CandidateAuthSnapshot | null> {
      return active
        ? { accessToken: active.accessToken, sessionEpoch: epoch }
        : null;
    },
  };
  const verifier = createCandidateVerifiedAuthProvider({
    baseUrl: base.toString(), publishableKey: options.publishableKey,
    sessions, fetcher,
  });

  async function post(path: string, body: object, bearer?: string) {
    let response: Response;
    try {
      response = await fetcher(new URL(path, base).toString(), {
        method: 'POST', credentials: 'omit', cache: 'no-store', redirect: 'error',
        headers: {
          apikey: options.publishableKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(bearer ? { Authorization: 'Bearer ' + bearer } : {}),
        },
        body: JSON.stringify(body),
      });
    } catch {
      // Do not expose network errors containing a token/email/password.
      throw new CandidateSessionError('Supabase Auth network unavailable');
    }
    if (!response.ok) throw new CandidateSessionError('Supabase Auth request denied');
    try { return await response.json() as unknown; }
    catch { throw new CandidateSessionError('Invalid Supabase Auth JSON'); }
  }

  async function serverOwner(accessToken: string): Promise<string> {
    let response: Response;
    try {
      response = await fetcher(new URL('/auth/v1/user', base).toString(), {
        method: 'GET', credentials: 'omit', cache: 'no-store', redirect: 'error',
        headers: {
          apikey: options.publishableKey, Authorization: 'Bearer ' + accessToken,
          Accept: 'application/json',
        },
      });
    } catch {
      throw new CandidateSessionError('Cannot verify new Supabase account');
    }
    if (!response.ok) throw new CandidateSessionError('Supabase Auth session denied');
    let user: unknown;
    try { user = await response.json(); }
    catch { throw new CandidateSessionError('Invalid Supabase Auth user'); }
    const id = user && typeof user === 'object' && 'id' in user &&
      (user as { id: unknown }).id;
    if (typeof id !== 'string' || !UUID.test(id))
      throw new CandidateSessionError('Invalid server-verified Supabase owner');
    return id;
  }

  function invalidate() {
    // Fence every outstanding authenticated request immediately, even if the
    // next login/refresh fails. No silent fallback to the old account.
    epoch++;
    active = null;
    refreshInFlight = null;
    return epoch;
  }

  async function signIn(email: string, password: string): Promise<CandidateVerifiedSession> {
    if (!email?.includes('@') || !password)
      throw new CandidateSessionError('Email/password required');
    const generation = invalidate();
    const response = await post('/auth/v1/token?grant_type=password', {
      email: email.trim().toLowerCase(), password,
    });
    const tokens = parseAuthTokens(response);
    const verified = await serverOwner(tokens.accessToken);
    if (verified !== tokens.ownerId || generation !== epoch)
      throw new CandidateSessionError('Supabase account changed during login');
    active = tokens;
    return { userId: verified, accessToken: tokens.accessToken, sessionEpoch: epoch };
  }

  async function doRefresh(): Promise<CandidateVerifiedSession> {
    const before = active;
    const generation = epoch;
    if (!before) throw new CandidateSessionError('No Supabase session to refresh');
    const response = await post('/auth/v1/token?grant_type=refresh_token', {
      refresh_token: before.refreshToken,
    });
    const tokens = parseAuthTokens(response, before.ownerId);
    const verified = await serverOwner(tokens.accessToken);
    if (verified !== before.ownerId || active !== before || epoch !== generation)
      throw new CandidateSessionError('Supabase account changed during refresh');
    epoch++;
    active = tokens;
    return { userId: verified, accessToken: tokens.accessToken, sessionEpoch: epoch };
  }

  async function refresh(): Promise<CandidateVerifiedSession> {
    if (!refreshInFlight) {
      const pending = doRefresh();
      refreshInFlight = pending;
      void pending.finally(() => {
        if (refreshInFlight === pending) refreshInFlight = null;
      }).catch(() => {});
    }
    return refreshInFlight;
  }

  async function signOut(): Promise<boolean> {
    const token = active?.accessToken;
    invalidate();
    if (!token) return true;
    try {
      const response = await fetcher(new URL('/auth/v1/logout', base).toString(), {
        method: 'POST', credentials: 'omit', cache: 'no-store', redirect: 'error',
        headers: { apikey: options.publishableKey, Authorization: 'Bearer ' + token },
      });
      // A 401 means the old session is already invalid; network failure or a
      // 5xx leaves server revocation uncertain, but local tokens stay cleared.
      return response.ok || response.status === 401;
    } catch {
      return false;
    }
  }

  async function signUp(email: string, password: string): Promise<void> {
    if (!email?.includes('@') || !password || password.length < 8)
      throw new CandidateSessionError('Valid email and password required');
    invalidate();
    // Email confirmation may be mandatory in hosted projects. Never assume
    // that a user field returned by signup is a verified active identity.
    await post('/auth/v1/signup', { email: email.trim().toLowerCase(), password });
  }

  async function requestPasswordRecovery(email: string): Promise<void> {
    if (!email?.includes('@')) throw new CandidateSessionError('Valid email required');
    // Product layer should always display a generic answer to prevent account
    // enumeration; do not use user_metadata as an authorization claim.
    await post('/auth/v1/recover', { email: email.trim().toLowerCase() });
  }

  return {
    signIn, signOut, signUp, refresh, requestPasswordRecovery,
    getVerifiedSession: () => verifier.getVerifiedSession(),
    getSessionSnapshot: sessions.getSessionSnapshot,
    getOwnerId: () => active?.ownerId ?? null,
    getExpiresAt: () => active?.expiresAt ?? null,
  };
}
