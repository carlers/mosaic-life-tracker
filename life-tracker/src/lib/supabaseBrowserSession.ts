import {
  createCandidateAuthSession,
  CandidateSessionError,
  CandidateSessionDeniedError,
  type CandidateSessionPersistence,
} from '../../supabase-poc/candidateAuthSession';
import { validateCandidateIdentity, type CandidateIdentity } from '../../supabase-poc/candidateMapping';

type Session = ReturnType<typeof createCandidateAuthSession>;
type Cache = CandidateIdentity & { email: string };
interface Record {
  version: 1;
  origin: string;
  family: string;
  credential: string;
  cache: Cache | null;
}
type Exclusive = <T>(name: string, operation: () => Promise<T>) => Promise<T>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * One refresh family per browser origin/backend. Every credential transaction
 * reads the latest durable refresh token under a Web Lock. Access JWTs stay in
 * memory; another tab's rotation does not invalidate an otherwise valid JWT.
 * A logout/new login changes the family and fences even delayed tab callbacks.
 * Cached identity grants local data access only, never a verified session.
 */
export function createSupabaseBrowserSession(options: {
  baseUrl: string;
  publishableKey: string;
  fetcher?: typeof fetch;
  storage: CandidateSessionPersistence;
  exclusive: Exclusive;
  randomId: () => string;
}) {
  const origin = new URL(options.baseUrl).origin;
  const storageKey = 'mosaic_supabase_browser_v1:' + origin;
  const lock = storageKey + ':credentials';
  const fetcher: typeof fetch = options.fetcher ?? ((input, init) =>
    fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(15_000) }));
  let current: Session | null = null;
  let family: string | null = null;
  let epoch = 0;

  function read(): Record | null {
    const raw = options.storage.getItem(storageKey);
    if (!raw) return null;
    try {
      const record = JSON.parse(raw) as Record;
      if (record.version !== 1 || record.origin !== origin ||
          !UUID.test(record.family) || typeof record.credential !== 'string') return null;
      const credential = JSON.parse(record.credential);
      if (credential.version !== 1 || credential.origin !== origin ||
          !UUID.test(credential.ownerId) || typeof credential.refreshToken !== 'string' ||
          credential.refreshToken.length < 12 || /\s/.test(credential.refreshToken)) return null;
      if (record.cache) {
        validateCandidateIdentity(record.cache);
        if (record.cache.supabaseUserId !== credential.ownerId ||
            typeof record.cache.email !== 'string') return null;
      }
      return record;
    } catch { return null; }
  }
  function write(record: Record | null) {
    if (record) options.storage.setItem(storageKey, JSON.stringify(record));
    else options.storage.removeItem(storageKey);
  }
  function discardMemory() {
    current?.discardMemory();
    current = null;
    epoch++;
  }
  function isCurrent() {
    try { return family !== null && read()?.family === family; }
    catch { return false; }
  }
  function transactionSession(saved: string | null) {
    let value = saved;
    const session = createCandidateAuthSession({
      ...options, fetcher, logoutScope: 'local',
      persistence: {
        getItem: () => value,
        setItem: (_key, next) => { value = next; },
        removeItem: () => { value = null; },
      },
    });
    return { session, saved: () => value };
  }
  async function rotate(restore: boolean) {
    return options.exclusive(lock, async () => {
      const record = read();
      if (!record || (family !== null && family !== record.family)) {
        discardMemory();
        throw new CandidateSessionDeniedError();
      }
      if (!restore && !current) throw new Error('No core session to refresh');
      family = record.family;
      const next = transactionSession(record.credential);
      try {
        const signed = await next.session.restoreFromPersistence();
        const credential = next.saved();
        if (!signed || !credential) throw new CandidateSessionDeniedError();
        try { write({ ...record, credential }); }
        catch (error) { discardMemory(); throw error; }
        current = next.session;
        epoch++;
        return { ...signed, sessionEpoch: epoch };
      } catch (error) {
        if (error instanceof CandidateSessionDeniedError) {
          write(null);
          discardMemory();
        }
        throw error;
      }
    });
  }
  const session: Session = {
    async signIn(email, password) {
      return options.exclusive(lock, async () => {
        // Fence the previous family before any password request can complete.
        write(null);
        discardMemory();
        family = options.randomId();
        if (!UUID.test(family)) throw new Error('Invalid core session family');
        const next = transactionSession(null);
        const signed = await next.session.signIn(email, password);
        const credential = next.saved();
        if (!credential) throw new Error('Core credential was not saved');
        write({ version: 1, origin, family, credential, cache: null });
        current = next.session;
        epoch++;
        return { ...signed, sessionEpoch: epoch };
      });
    },
    async restoreFromPersistence() {
      if (!read()) return null;
      return rotate(true);
    },
    refresh: () => rotate(false),
    async signOut() {
      return options.exclusive(lock, async () => {
        // A delayed logout from an old tab must never erase the new account.
        // An unreadable store is not confirmed logout; do not acknowledge
        // clearing a family that might still be durable.
        const own = family !== null && read()?.family === family;
        const previous = current;
        if (own) write(null);
        const revoked = previous?.signOut();
        discardMemory();
        family = null;
        return revoked ?? true;
      });
    },
    async getVerifiedSession() {
      if (!isCurrent() || !current) return null;
      // Expiry is not refresh-family revocation. Replication may wake before
      // the provider's online handler pauses it and rotates the credential.
      if ((current.getExpiresAt() ?? 0) - Date.now() < 5_000)
        throw new CandidateSessionError('Core session requires renewal');
      const before = current;
      const generation = epoch;
      const signed = await before.getVerifiedSession();
      if (!isCurrent() || current !== before || epoch !== generation) return null;
      if (!signed) {
        if ((before.getExpiresAt() ?? 0) - Date.now() < 5_000)
          throw new CandidateSessionError('Core session requires renewal');
        await options.exclusive(lock, async () => {
          if (isCurrent() && current === before && epoch === generation) {
            write(null);
            discardMemory();
          }
        });
        return null;
      }
      return signed ? { ...signed, sessionEpoch: epoch } : null;
    },
    async getSessionSnapshot() {
      if (!isCurrent() || !current) return null;
      const generation = epoch;
      const snapshot = await current.getSessionSnapshot();
      return isCurrent() && generation === epoch && snapshot
        ? { ...snapshot, sessionEpoch: epoch } : null;
    },
    getOwnerId: () => isCurrent() ? current?.getOwnerId() ?? null : null,
    getExpiresAt: () => isCurrent() ? current?.getExpiresAt() ?? null : null,
    discardMemory,
    async signUp(email, password, redirectTo) {
      // Signup does not adopt or replace any shared signed-in browser account.
      await transactionSession(null).session.signUp(email, password, redirectTo);
    },
    requestPasswordRecovery: (email, redirectTo) =>
      transactionSession(null).session.requestPasswordRecovery(email, redirectTo),
  };
  return {
    session, storageKey,
    getCachedIdentity(): Cache | null {
      let record: Record | null;
      try { record = read(); } catch { return null; }
      if (!record || (family !== null && family !== record.family)) return null;
      family = record.family;
      return record.cache ? { ...record.cache } : null;
    },
    isCurrent,
    async rememberIdentity(identity: CandidateIdentity, email?: string) {
      validateCandidateIdentity(identity);
      await options.exclusive(lock, async () => {
        const record = read();
        if (!record || !isCurrent() || current?.getOwnerId() !== identity.supabaseUserId)
          throw new CandidateSessionDeniedError();
        if (record.cache && record.cache.legacyUserId !== identity.legacyUserId)
          throw new CandidateSessionDeniedError();
        write({ ...record, cache: { ...identity, email: email ?? record.cache?.email ?? '' } });
      });
    },
  };
}
