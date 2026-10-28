/**
 * Email grants are deliberately separate from the browser's active account.
 * They cannot enter RxDB, persistent session storage or the writer coordinator.
 */
export type EmailAction =
  | { kind: 'signup' | 'recovery'; tokenHash: string; accessToken?: never }
  | { kind: 'signup' | 'recovery'; accessToken: string; tokenHash?: never };
export type VerifiedEmailAction = { kind: EmailAction['kind']; email: string };

export function parseEmailAction(pathname: string, hash: string): EmailAction | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const kind = params.get('type');
  if (params.getAll('type').length !== 1 ||
      (kind !== 'signup' && kind !== 'recovery') ||
      pathname !== (kind === 'signup' ? '/auth/confirm' : '/reset-password'))
    return null;

  const hashes = params.getAll('token_hash');
  const tokens = params.getAll('access_token');
  // Template-driven links contain a one-time token hash. Standard GoTrue
  // verification redirects instead carry an already-issued bearer session
  // in the fragment. Never mix those paths or accept a query credential.
  if (hashes.length === 1 && tokens.length === 0 &&
      params.getAll('refresh_token').length === 0 &&
      /^[a-f0-9]{32,128}$/i.test(hashes[0]))
    return { kind, tokenHash: hashes[0] };
  if (hashes.length === 0 && tokens.length === 1 &&
      params.getAll('refresh_token').length === 1 &&
      params.getAll('token_type').length === 1 &&
      params.get('token_type')?.toLowerCase() === 'bearer' &&
      tokens[0].length <= 8192 &&
      /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(tokens[0]))
    return { kind, accessToken: tokens[0] };
  return null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Grant = { token: string; owner: string; email: string };

export function createSupabaseEmailActions(options: {
  baseUrl: string;
  publishableKey: string;
  callback: EmailAction | null;
  /** Clean-route one-time-code mode; legacy hash callbacks remain supported. */
  kind?: EmailAction['kind'];
  fetcher?: typeof fetch;
}) {
  const base = new URL(options.baseUrl);
  if ((base.protocol !== 'https:' &&
      !(base.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname))) ||
      base.username || base.password || base.search || base.hash || base.pathname !== '/' ||
      !/^sb_publishable_\S+$/.test(options.publishableKey))
    throw Error('Invalid email action service configuration');
  const fetcher = options.fetcher ?? fetch;
  let callback = options.callback;
  const kind = callback?.kind ?? options.kind;
  let consumed = false;
  let grant: Grant | null = null;
  let verifying: Promise<VerifiedEmailAction> | null = null;
  let completing = false;

  async function request(path: string, method: string, body?: object, token?: string) {
    let response: Response;
    try {
      response = await fetcher(new URL(path, base).toString(), {
        method, credentials: 'omit', cache: 'no-store', redirect: 'error',
        signal: AbortSignal.timeout(15_000),
        headers: {
          apikey: options.publishableKey, 'Content-Type': 'application/json',
          ...(token ? { Authorization: 'Bearer ' + token } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    } catch {
      throw Error('Email verification service unavailable. Retry or request a new link.');
    }
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) grant = null;
      throw Error('Email action was rejected. The link may have expired; request a new link.');
    }
    if (response.status === 204) return null;
    try { return await response.json() as Record<string, unknown>; }
    catch { throw Error('Email verification response could not be confirmed.'); }
  }

  async function verifyOwner(token: string, expected?: string): Promise<Grant> {
    const user = await request('/auth/v1/user', 'GET', undefined, token);
    if (!user || typeof user.id !== 'string' || !UUID.test(user.id) ||
        (expected && user.id !== expected) || typeof user.email !== 'string' ||
        !user.email.includes('@') || typeof user.email_confirmed_at !== 'string' ||
        !user.email_confirmed_at) {
      grant = null;
      throw Error('The email account could not be verified.');
    }
    return { owner: user.id, email: user.email, token };
  }

  async function verify(): Promise<VerifiedEmailAction> {
    if (consumed || !callback) throw Error('Invalid or completed email link. Request a new link.');
    if (grant) return { kind: callback.kind, email: grant.email };
    if (!verifying) {
      const current = callback;
      verifying = (async () => {
        if ('accessToken' in current && current.accessToken) {
          // GoTrue already consumed the single-use email OTP and issued this
          // short-lived session before redirecting. Verify against /user;
          // never persist its refresh token or adopt it into app sync.
          grant = await verifyOwner(current.accessToken);
        } else if ('tokenHash' in current && current.tokenHash) {
          const result = await request('/auth/v1/verify', 'POST', {
            token_hash: current.tokenHash, type: current.kind,
          });
          // Never adopt identity claims from email parameters or user_metadata.
          const user = result?.user as { id?: unknown } | undefined;
          if (typeof result?.access_token !== 'string' || result.access_token.length < 12 ||
              typeof user?.id !== 'string' || !UUID.test(user.id))
            throw Error('The email account could not be verified.');
          grant = await verifyOwner(result.access_token, user.id);
        } else throw Error('Invalid email callback.');
        return { kind: current.kind, email: grant.email };
      })();
    }
    const pending = verifying;
    try { return await pending; }
    finally { if (verifying === pending) verifying = null; }
  }

  async function verifyCode(email: string, code: string): Promise<VerifiedEmailAction> {
    // A credential must never travel in an email link, navigation or query.
    // Require an explicit clean-route action and an email supplied in the form.
    if (consumed || callback || (kind !== 'signup' && kind !== 'recovery'))
      throw Error('Invalid or completed email action. Request a new code.');
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ||
        !/^\d{6,10}$/.test(code))
      throw Error('Enter a valid email address and code.');
    if (grant) {
      if (grant.email.trim().toLowerCase() !== normalized)
        throw Error('The email account could not be verified.');
      return { kind, email: grant.email };
    }
    if (verifying) throw Error('Email verification is already in progress.');
    const pending = (async () => {
      const result = await request('/auth/v1/verify', 'POST', {
        email: normalized, token: code, type: kind,
      });
      const user = result?.user as { id?: unknown } | undefined;
      if (typeof result?.access_token !== 'string' || result.access_token.length < 12 ||
          typeof user?.id !== 'string' || !UUID.test(user.id))
        throw Error('The email account could not be verified.');
      const verified = await verifyOwner(result.access_token, user.id);
      if (verified.email.trim().toLowerCase() !== normalized)
        throw Error('The email account could not be verified.');
      grant = verified;
      return { kind, email: verified.email };
    })();
    verifying = pending;
    try { return await pending; }
    finally { if (verifying === pending) verifying = null; }
  }

  async function revoke(current: Grant): Promise<{ revoked: boolean }> {
    // Drop all local credentials even when remote revocation cannot be confirmed.
    grant = null;
    callback = null;
    consumed = true;
    try {
      await request('/auth/v1/logout?scope=local', 'POST', undefined, current.token);
      return { revoked: true };
    } catch { return { revoked: false }; }
  }

  async function resetPassword(password: string) {
    if (!grant || consumed) throw Error('Verify the email code or link before choosing a password.');
    if (kind !== 'recovery') throw Error('A password recovery link is required.');
    if (password.length < 8) throw Error('Use at least 8 characters for your password.');
    if (completing) throw Error('Password change is already in progress.');
    completing = true;
    try {
      const current = await verifyOwner(grant.token, grant.owner);
      const result = await request('/auth/v1/user', 'PUT', { password }, current.token);
      if (result?.id !== current.owner)
        throw Error('Password change could not be confirmed for this account.');
      return await revoke(current);
    } finally { completing = false; }
  }

  async function finishConfirmation() {
    if (!grant || consumed || kind !== 'signup') throw Error('Verify the confirmation code or link first.');
    return revoke(grant);
  }

  return { verify, verifyCode, resetPassword, finishConfirmation };
}
