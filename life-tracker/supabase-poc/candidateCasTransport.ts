/**
 * Source-only Supabase atomic CAS transport for candidate tasks/categories.
 * NOT wired to Mosaic's live RxDB/Appwrite replication.
 *
 * The allowlisted RPC functions must enforce auth.uid() row ownership and
 * update via (owner_id, id, expected change_seq). Do not substitute an
 * ordinary PostgREST UPDATE: direct UPDATE is intentionally revoked.
 */
import { parseCandidateRevision } from './candidateMapping';
import {
  CandidateAuthError, CandidateHttpError,
  type CandidateSessionProvider, type CandidateVerifiedSession,
} from './candidateHttpTransport';
import type { CandidateDomain } from './candidatePull';

type CandidatePatch = Record<string, string | boolean | number | null>;
type CasDomain = CandidateDomain | 'settings';
type CandidateCasRow = {
  owner_id: string;
  id: string;
  change_seq: string | number;
  is_deleted: boolean;
};

export type CandidateCasOutcome<Row extends CandidateCasRow> =
  | { state: 'applied'; revision: string; row: Row }
  | { state: 'conflict' };

const ALLOWED: Record<CasDomain, readonly string[]> = {
  tasks: [
    'title', 'completed', 'category_id', 'order_index', 'tags', 'task_date',
    'memo', 'image', 'completed_at', 'updated_at', 'source',
    'routine_id', 'reminder_time', 'visibility', 'is_deleted',
  ],
  categories: [
    'name', 'color', 'order_index', 'visibility', 'icon', 'retired_on', 'updated_at', 'is_deleted',
  ],
  diary: ['content', 'emoji', 'updated_at', 'is_deleted'],
  settings: ['setting_value', 'updated_at', 'is_deleted'],
};
const RPC: Record<CasDomain, string> = {
  tasks: 'mosaic_candidate_cas_task',
  categories: 'mosaic_candidate_cas_category',
  diary: 'mosaic_candidate_cas_diary',
  settings: 'mosaic_candidate_cas_setting',
};

function validatePatch(domain: CasDomain, patch: CandidatePatch): void {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(patch))) {
    throw new Error('Candidate CAS patch must be an object');
  }
  const keys = Object.keys(patch);
  const allowlist = ALLOWED[domain];
  if (!allowlist || !keys.length || keys.some(key => !allowlist.includes(key))) {
    throw new Error('Candidate CAS patch contains an unapproved field');
  }
  if (domain === 'settings' && keys.some(key => {
    const value: unknown = patch[key];
    return key === 'is_deleted' ? typeof value !== 'boolean' :
      typeof value !== 'string' || (key === 'setting_value' && value.length > 65536) ||
      (key === 'updated_at' && (value.length > 50 || !Number.isFinite(Date.parse(value))));
  })) throw new Error('Invalid Settings CAS patch value');
  if (keys.some(key => {
    const value: unknown = patch[key];
    return value !== null &&
      !(typeof value === 'string' || typeof value === 'boolean' ||
      (typeof value === 'number' && Number.isFinite(value)));
  })) throw new Error('Invalid candidate CAS patch value');
}

export function createCandidateCasTransport(options: {
  baseUrl: string;
  publishableKey: string;
  session: CandidateSessionProvider;
  fetcher?: typeof fetch;
}) {
  const base = new URL(options.baseUrl);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname);
  if ((base.protocol !== 'https:' && !(base.protocol === 'http:' && local)) ||
    base.username || base.password || base.search || base.hash ||
    !['', '/'].includes(base.pathname)) {
    throw new Error('Candidate CAS endpoint must use HTTPS or loopback HTTP without URL credentials/path');
  }
  if (!options.publishableKey?.startsWith('sb_publishable_') ||
    options.publishableKey !== options.publishableKey.trim() ||
    /\s/.test(options.publishableKey)) {
    throw new Error('Candidate CAS requires a modern publishable key');
  }
  const fetcher = options.fetcher ?? fetch;

  async function checkedSession(ownerId: string): Promise<CandidateVerifiedSession> {
    const current = await options.session.getVerifiedSession();
    if (!current || current.userId !== ownerId || !current.accessToken ||
      !Number.isSafeInteger(current.sessionEpoch) || current.sessionEpoch < 0) {
      throw new CandidateAuthError('Candidate CAS has no matching server-verified account');
    }
    return current;
  }

  return {
    async compareAndSet<Row extends CandidateCasRow>({
      domain, ownerId, documentId, expectedRevision, patch,
    }: {
      domain: CasDomain;
      ownerId: string;
      documentId: string;
      expectedRevision: string;
      patch: CandidatePatch;
    }): Promise<CandidateCasOutcome<Row>> {
      // Check input before sending anything to the network.
      if (!Object.prototype.hasOwnProperty.call(RPC, domain) ||
        !documentId || documentId.length > 255 || Array.from(documentId).some(char => char.charCodeAt(0) < 32)) {
        throw new Error('Invalid candidate CAS row identity');
      }
      const revision = parseCandidateRevision(expectedRevision);
      if (revision < 1n) throw new Error('Candidate CAS requires an existing row revision');
      validatePatch(domain, patch);

      const before = await checkedSession(ownerId);
      const url = new URL('/rest/v1/rpc/' + RPC[domain], base);
      const response = await fetcher(url.toString(), {
        method: 'POST',
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'error',
        headers: {
          apikey: options.publishableKey,
          Authorization: 'Bearer ' + before.accessToken,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          p_id: documentId, p_expected_seq: revision.toString(), p_patch: patch,
        }),
      });
      if (response.status === 401 || response.status === 403)
        throw new CandidateAuthError('Candidate CAS Supabase session denied');
      if (!response.ok) throw new CandidateHttpError(response.status);
      const raw: unknown = await response.json();
      // Recheck even after a conflict; no acknowledgement can cross accounts.
      const after = await checkedSession(ownerId);
      if (after.sessionEpoch !== before.sessionEpoch ||
        after.accessToken !== before.accessToken) {
        throw new CandidateAuthError('Candidate CAS account changed during request');
      }
      // The stored procedure returns NULL on a stale, missing or foreign row.
      // Never retry a conflict blindly or synthesize a successful revision.
      if (raw === null) return { state: 'conflict' };
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new Error('Invalid candidate CAS RPC result');
      }
      // A SQL function declared RETURNS <composite> may return a typed NULL
      // row that PostgREST represents as an object whose every field is null,
      // not as JSON null. This is a missing/stale/foreign CAS conflict, never
      // evidence that a write was acknowledged. Require the full row identity
      // shape to avoid hiding malformed partial responses as conflicts.
      const values = raw as Record<string, unknown>;
      if (['owner_id', 'id', 'change_seq', 'is_deleted'].every(
        field => Object.prototype.hasOwnProperty.call(values, field) && values[field] === null,
      ) && Object.values(values).every(value => value === null)) {
        return { state: 'conflict' };
      }
      const row = raw as CandidateCasRow;
      if (row.owner_id !== ownerId || row.id !== documentId ||
        typeof row.is_deleted !== 'boolean' ||
        parseCandidateRevision(row.change_seq) <= revision) {
        throw new Error('Candidate CAS returned foreign or nonadvancing row');
      }
      return {
        state: 'applied', revision: parseCandidateRevision(row.change_seq).toString(),
        row: row as Row,
      };
    },
  };
}
