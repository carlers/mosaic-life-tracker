/**
 * #1027: experimental browser Supabase Auth lifecycle for core-owner pilots.
 *
 * Isolated candidate only. Never imported by the Appwrite AuthProvider.
 * In-memory by default. Optional injected persistence stores refresh token +
 * owner hint, never an authenticated offline identity. Re-entry requires a
 * signed token exchange and GET /user. Cross-tab locking and app integration
 * remain mandatory before any live rollout.
 */
import {
  createCandidateVerifiedAuthProvider,
  type CandidateAuthSnapshot,
} from './candidateVerifiedAuth';
import type { CandidateVerifiedSession } from './candidateHttpTransport';

export interface CandidateSessionPersistence {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
type StoredSession = { version: 1; origin: string; ownerId: string; refreshToken: string };
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

export class CandidateSessionDeniedError extends CandidateSessionError {
  constructor() {
    super('Supabase Auth session was rejected by the server');
    this.name = 'CandidateSessionDeniedError';
  }
}

export class CandidateSessionUnavailableError extends CandidateSessionError {}

/** Only a known server-owned invite gate can be identified to the user. */
export class CandidateSignupInvitationRequiredError extends CandidateSessionDeniedError {
  constructor() {
    super();
    this.name = 'CandidateSignupInvitationRequiredError';
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
  persistence?: CandidateSessionPersistence;
  /** App logout can revoke only this device's signed session. */
  logoutScope?: 'local' | 'global';
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
  const storageKey = 'mosaic_candidate_supabase_refresh_v1:' + base.origin;
  const clearSaved = () => {
    if (!options.persistence) return;
    try { options.persistence.removeItem(storageKey); }
    catch { throw new CandidateSessionError('Cannot clear stored Supabase session'); }
  };
  const save = (tokens: Tokens) => {
    if (!options.persistence) return;
    const record: StoredSession = {
      version: 1, origin: base.origin, ownerId: tokens.ownerId,
      refreshToken: tokens.refreshToken,
    };
    try { options.persistence.setItem(storageKey, JSON.stringify(record)); }
    catch { throw new CandidateSessionError('Cannot save stored Supabase session'); }
  };
  const read = (): StoredSession | null => {
    if (!options.persistence) return null;
    let raw: string | null;
    try { raw = options.persistence.getItem(storageKey); }
    catch { throw new CandidateSessionError('Cannot read stored Supabase session'); }
    if (raw === null) return null;
    try {
      const obj: unknown = JSON.parse(raw);
      if (!obj || typeof obj !== 'object') throw Error();
      const saved = obj as Partial<StoredSession>;
      if (saved.version !== 1 || saved.origin !== base.origin ||
          typeof saved.ownerId !== 'string' || !UUID.test(saved.ownerId) ||
          typeof saved.refreshToken !== 'string' ||
          saved.refreshToken.length < 12 || /\s/.test(saved.refreshToken))
        throw Error();
      return saved as StoredSession;
    } catch {
      clearSaved();
      throw new CandidateSessionError('Invalid stored Supabase session');
    }
  };
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
      throw new CandidateSessionUnavailableError('Supabase Auth network unavailable');
    }
    if (response.status === 403 && path.startsWith('/auth/v1/signup')) {
      // Recognize ONLY the exact installed, static invitation-hook denial.
      // Never return arbitrary provider text or account identifiers to the UI.
      let invitationOnly = false;
      try {
        const raw = await response.json() as unknown;
        if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
          const body = raw as Record<string, unknown>;
          invitationOnly = ['message', 'msg', 'error_description', 'error']
            .some(key => body[key] === 'Registration is by invitation only.');
        }
      } catch { /* Unreadable or unfamiliar denials stay generic. */ }
      if (invitationOnly) throw new CandidateSignupInvitationRequiredError();
    }
    if (response.status === 401 || response.status === 403)
      throw new CandidateSessionDeniedError();
    if (response.status === 400 && path === '/auth/v1/token?grant_type=refresh_token') {
      let code: unknown;
      try {
        const body = await response.json() as { code?: unknown; error_code?: unknown };
        // GoTrue's HTTP API uses numeric `code` plus string `error_code`;
        // some compatible responses expose the symbolic value as `code`.
        code = body.error_code ?? body.code;
      } catch { /* ambiguous error */ }
      if (['refresh_token_not_found', 'refresh_token_already_used', 'session_not_found', 'session_expired']
        .includes(String(code))) throw new CandidateSessionDeniedError();
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
      throw new CandidateSessionUnavailableError('Cannot verify new Supabase account');
    }
    if (response.status === 401 || response.status === 403)
      throw new CandidateSessionDeniedError();
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
    clearSaved();
    const response = await post('/auth/v1/token?grant_type=password', {
      email: email.trim().toLowerCase(), password,
    });
    const tokens = parseAuthTokens(response);
    const verified = await serverOwner(tokens.accessToken);
    if (verified !== tokens.ownerId || generation !== epoch)
      throw new CandidateSessionError('Supabase account changed during login');
    save(tokens);
    active = tokens;
    return { userId: verified, accessToken: tokens.accessToken, sessionEpoch: epoch };
  }

  /** A restored refresh token is untrusted until Supabase verifies the owner.
   * Definitive denial clears storage; outage retains it without local trust. */
  async function restoreFromPersistence(): Promise<CandidateVerifiedSession | null> {
    if (active) throw new CandidateSessionError('Candidate session already active');
    const generation = invalidate();
    const saved = read();
    if (!saved) return null;
    try {
      const response = await post('/auth/v1/token?grant_type=refresh_token', {
        refresh_token: saved.refreshToken,
      });
      let tokens: Tokens;
      try { tokens = parseAuthTokens(response, saved.ownerId); }
      catch { throw new CandidateSessionDeniedError(); }
      const verified = await serverOwner(tokens.accessToken);
      if (generation !== epoch)
        throw new CandidateSessionError('Supabase account changed during restore');
      if (verified !== saved.ownerId) throw new CandidateSessionDeniedError();
      try { save(tokens); }
      catch (error) {
        clearSaved();
        throw error;
      }
      epoch++;
      active = tokens;
      return { userId: verified, accessToken: tokens.accessToken, sessionEpoch: epoch };
    } catch (error) {
      if (generation === epoch) {
        invalidate();
        if (error instanceof CandidateSessionDeniedError) clearSaved();
      }
      throw error;
    }
  }

  async function doRefresh(): Promise<CandidateVerifiedSession> {
    const before = active;
    const generation = epoch;
    if (!before) throw new CandidateSessionError('No Supabase session to refresh');
    let response: unknown;
    try {
      response = await post('/auth/v1/token?grant_type=refresh_token', {
        refresh_token: before.refreshToken,
      });
    } catch (error) {
      // Only a definitive Auth denial revokes local trust. Offline/network
      // uncertainty is NOT a confirmed 401 and must be handled separately.
      if (error instanceof CandidateSessionDeniedError &&
          active === before && epoch === generation) {
        invalidate();
        clearSaved();
      }
      throw error;
    }
    const tokens = parseAuthTokens(response, before.ownerId);
    const verified = await serverOwner(tokens.accessToken);
    if (verified !== before.ownerId || active !== before || epoch !== generation)
      throw new CandidateSessionError('Supabase account changed during refresh');
    try { save(tokens); }
    catch (error) {
      // A rotated refresh token cannot be acknowledged without durable save.
      invalidate();
      clearSaved();
      throw error;
    }
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
    let cleared = true;
    try { clearSaved(); } catch { cleared = false; }
    if (!token) return cleared;
    try {
      const logoutPath = options.logoutScope === 'local' ? '/auth/v1/logout?scope=local' : '/auth/v1/logout';
      const response = await fetcher(new URL(logoutPath, base).toString(), {
        method: 'POST', credentials: 'omit', cache: 'no-store', redirect: 'error',
        headers: { apikey: options.publishableKey, Authorization: 'Bearer ' + token },
      });
      // A 401 means the old session is already invalid; network failure or a
      // 5xx leaves server revocation uncertain, but local tokens stay cleared.
      return cleared && (response.ok || response.status === 401);
    } catch {
      return false;
    }
  }

  function emailEndpoint(path: string, redirectTo?: string) {
    if (!redirectTo) return path;
    const redirect = new URL(redirectTo);
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(redirect.hostname);
    if ((redirect.protocol !== 'https:' && !(redirect.protocol === 'http:' && loopback)) ||
        redirect.username || redirect.password || redirect.hash || redirect.search ||
        !['/auth/confirm', '/reset-password'].includes(redirect.pathname))
      throw new CandidateSessionError('Invalid email callback destination');
    return path + '?redirect_to=' + encodeURIComponent(redirect.toString());
  }

  async function signUp(email: string, password: string, redirectTo?: string): Promise<void> {
    if (!email?.includes('@') || !password || password.length < 8)
      throw new CandidateSessionError('Valid email and password required');
    invalidate();
    clearSaved();
    // Email confirmation may be mandatory in hosted projects. Never assume
    // that a user field returned by signup is a verified active identity.
    await post(emailEndpoint('/auth/v1/signup', redirectTo), { email: email.trim().toLowerCase(), password });
  }

  async function requestPasswordRecovery(email: string, redirectTo?: string): Promise<void> {
    if (!email?.includes('@')) throw new CandidateSessionError('Valid email required');
    // Product layer should always display a generic answer to prevent account
    // enumeration; do not use user_metadata as an authorization claim.
    await post(emailEndpoint('/auth/v1/recover', redirectTo), { email: email.trim().toLowerCase() });
  }

  return {
    signIn, signOut, signUp, refresh, restoreFromPersistence, requestPasswordRecovery,
    getVerifiedSession: () => verifier.getVerifiedSession(),
    getSessionSnapshot: sessions.getSessionSnapshot,
    getOwnerId: () => active?.ownerId ?? null,
    getExpiresAt: () => active?.expiresAt ?? null,
    /** Detach a view without logging out the browser or revoking its family. */
    discardMemory: () => { invalidate(); },
  };
}
