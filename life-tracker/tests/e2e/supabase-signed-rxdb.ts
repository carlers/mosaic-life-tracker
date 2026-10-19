/**
 * #967 ONLY: ephemeral localhost Supabase Auth/REST + real browser RxDB/Dexie.
 * The JWT is supplied by the dedicated GitHub Actions test via addInitScript;
 * never imported by the shipped Mosaic app, persisted, or logged.
 */
import { makeBackendParityFixtures, PARITY_OWNERS } from '../fixtures/backendProviderParity';
import { toCandidateCategoryWrite, toCandidateTaskWrite } from '../../supabase-poc/candidateMapping';
import { addRxPlugin, createRxDatabase, type RxCollection, type RxDatabase } from 'rxdb';
import { RxDBMigrationSchemaPlugin } from 'rxdb/plugins/migration-schema';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { categoriesSchema, type CategoryDocument } from '../../src/db/schema';
import { categoriesMigrationStrategies } from '../../src/db/migrations';
import { createCandidateHttpTransport, type CandidateVerifiedSession } from '../../supabase-poc/candidateHttpTransport';
import { createCandidateCreateTransport } from '../../supabase-poc/candidateCreateTransport';
import { createCandidateCasTransport } from '../../supabase-poc/candidateCasTransport';
import { createCandidateRxdbPilot } from '../../supabase-poc/candidateRxdbPilot';
import { createCandidateAuthSession } from '../../supabase-poc/candidateAuthSession';

type LocalConfiguration = {
  endpoint: string; publishableKey: string; token: string;
  supabaseId: string; legacyId: string; dbTag: string;
};
type Collections = { categories: RxCollection<CategoryDocument> };
type Db = RxDatabase<Collections>;
const config = (window as unknown as { __mosaicSignedRxdbConfig?: LocalConfiguration })
  .__mosaicSignedRxdbConfig;
if (!config || config.endpoint !== 'http://127.0.0.1:54321' ||
    !config.publishableKey.startsWith('sb_publishable_') ||
    !/^[a-z][a-z0-9_]{1,32}$/.test(config.dbTag)) {
  throw new Error('Signed RxDB probe refuses non-local or invalid test inputs');
}
addRxPlugin(RxDBMigrationSchemaPlugin);

let database: Db | null = null;
let active: ReturnType<ReturnType<typeof createCandidateRxdbPilot<CategoryDocument>>['start']> | null = null;
let conflictPilot: ReturnType<typeof createCandidateRxdbPilot<CategoryDocument>> | null = null;
let offline = false;
let failures = 0;
let remoteReads = 0;
let masterReads = 0;
let authChecks = 0;
let conflictErrors = 0;
const cursors: string[] = [];

const session = {
  async getVerifiedSession(): Promise<CandidateVerifiedSession> {
    authChecks++;
    const response = await fetch(config.endpoint + '/auth/v1/user', {
      cache: 'no-store', credentials: 'omit',
      headers: { apikey: config.publishableKey, Authorization: 'Bearer ' + config.token },
    });
    if (!response.ok) throw new Error('Real signed local Auth verification failed');
    const user: unknown = await response.json();
    if (!user || typeof user !== 'object' ||
      (user as { id?: string }).id !== config.supabaseId) {
      throw new Error('Real Supabase Auth identity mismatch');
    }
    return { userId: config.supabaseId, accessToken: config.token, sessionEpoch: 1 };
  },
};
const safeFetch: typeof fetch = async (input, init) => {
  const target = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  if (target.origin !== config.endpoint || !target.pathname.startsWith('/rest/v1/'))
    throw new Error('Signed RxDB fixture blocked an unexpected remote request');
  if (offline) {
    failures++;
    throw new Error('Synthetic browser-to-Supabase network outage');
  }
  if ((init?.method ?? 'GET') === 'GET' && target.pathname.includes('mosaic_candidate_categories')) {
    remoteReads++;
    if (target.searchParams.has('id')) masterReads++;
  }
  return fetch(input, init);
};
const changeTransport = createCandidateHttpTransport({
  baseUrl: config.endpoint, publishableKey: config.publishableKey, session, fetcher: safeFetch,
});
const changes = {
  async listChanges<R>(request: {
    domain: 'tasks' | 'categories'; ownerId: string; afterExclusive: string; batchSize: number;
  }): Promise<R[]> {
    cursors.push(request.afterExclusive);
    return changeTransport.listChanges<R>(request);
  },
};
const writer = createCandidateCreateTransport({
  baseUrl: config.endpoint, publishableKey: config.publishableKey, session, fetcher: safeFetch,
});
const cas = createCandidateCasTransport({
  baseUrl: config.endpoint, publishableKey: config.publishableKey, session, fetcher: safeFetch,
});

async function start() {
  if (database || active) throw new Error('Signed RxDB fixture already started');
  await session.getVerifiedSession();
  database = await createRxDatabase<Collections>({
    name: 'mosaic_sb_signed_' + config.dbTag,
    storage: getRxStorageDexie(),
    multiInstance: false,
  });
  await database.addCollections({
    categories: { schema: categoriesSchema, migrationStrategies: categoriesMigrationStrategies },
  });
  const pilot = createCandidateRxdbPilot<CategoryDocument>({
    domain: 'categories',
    identity: { legacyUserId: config.legacyId, supabaseUserId: config.supabaseId },
    session, changes, writer, cas, collection: database.categories,
  });
  conflictPilot = pilot;
  active = pilot.start();
  active.state.error$.subscribe((error: unknown) => {
    const rendered = String(error);
    if (rendered.includes('conflict') || rendered.includes('CONFLICT'))
      conflictErrors++;
  });
  await active.state.awaitInitialReplication();
}
async function stop() {
  if (active) await active.stop();
  active = null;
  conflictPilot = null;
  if (database) await database.close();
  database = null;
}
async function edit(id: string, name: string) {
  if (!database) throw new Error('Signed RxDB fixture is not open');
  const document = await database.categories.findOne(id).exec();
  if (!document) throw new Error('Cannot edit missing local category');
  await document.incrementalPatch({ name, updatedAt: '2026-10-20T00:00:00.000Z' });
}
async function snapshot() {
  const docs = database ? await database.categories.find().exec() : [];
  return {
    local: docs.map(doc => ({
      id: doc.id, name: doc.name, userId: doc.userId, isDeleted: doc.isDeleted,
    })),
    cursors: [...cursors], failures, remoteReads, masterReads, authChecks, conflictErrors,
    pending: conflictPilot?.listPendingConflicts().map(review => ({
      documentId: review.documentId,
      reason: review.reason,
      remoteRevision: review.remoteRevision,
      localName: (review.local as CategoryDocument).name,
      remoteName: (review.remote as CategoryDocument | null)?.name ?? null,
    })) ?? [],
  };
}
/**
 * Browser only: compile the checked-in typed eight-domain fixture through Vite,
 * map ONLY the two implemented owner-private domains to signed Supabase UUIDs.
 * Future adapters must independently implement and verify the remaining six.
 */
function privateProviderFixtures(principals: { a: string; b: string }) {
  const source = makeBackendParityFixtures();
  const records = { a: { tasks: [], categories: [] }, b: { tasks: [], categories: [] } } as {
    a: { tasks: ReturnType<typeof toCandidateTaskWrite>[]; categories: ReturnType<typeof toCandidateCategoryWrite>[] };
    b: { tasks: ReturnType<typeof toCandidateTaskWrite>[]; categories: ReturnType<typeof toCandidateCategoryWrite>[] };
  };
  for (const label of ['a', 'b'] as const) {
    const identity = { legacyUserId: PARITY_OWNERS[label], supabaseUserId: principals[label] };
    records[label].categories = source[label].categories.map(doc => toCandidateCategoryWrite(doc, identity));
    records[label].tasks = source[label].tasks.map(doc => toCandidateTaskWrite(doc, identity));
  }
  return records;
}

/**
 * Only callable by the throwaway localhost CI browser fixture.
 * Return non-secret metadata. No real account credentials or tokens persist.
 */
async function exerciseSignedAuthLifecycle(input: {
  a: { email: string; password: string; id: string };
  b: { email: string; password: string; id: string };
}) {
  const auth = createCandidateAuthSession({
    baseUrl: config.endpoint, publishableKey: config.publishableKey,
  });
  if (await auth.getVerifiedSession() !== null) throw new Error('New Auth adapter was not empty');
  const first = await auth.signIn(input.a.email, input.a.password);
  if (first.userId !== input.a.id || (await auth.getVerifiedSession())?.userId !== input.a.id)
    throw new Error('First real JWT owner check failed');
  const refreshed = await auth.refresh();
  if (refreshed.userId !== first.userId || refreshed.sessionEpoch <= first.sessionEpoch ||
      (await auth.getVerifiedSession())?.userId !== input.a.id)
    throw new Error('Refreshed Supabase session was not verified');
  const second = await auth.signIn(input.b.email, input.b.password);
  if (second.userId !== input.b.id || second.sessionEpoch <= refreshed.sessionEpoch ||
      (await auth.getVerifiedSession())?.userId !== input.b.id)
    throw new Error('Login switch did not fence old owner');
  const oldUserChanges = createCandidateHttpTransport({
    baseUrl: config.endpoint, publishableKey: config.publishableKey, session: auth,
  });
  let deniedPreviousOwner = false;
  try {
    await oldUserChanges.listChanges({
      domain: 'tasks', ownerId: input.a.id, afterExclusive: '0', batchSize: 5,
    });
  } catch {
    deniedPreviousOwner = true;
  }
  if (!deniedPreviousOwner) throw new Error('Old account could still pull after switch');
  const revoked = await auth.signOut();
  if (await auth.getSessionSnapshot() !== null ||
      await auth.getVerifiedSession() !== null) {
    throw new Error('Signed-out account still has local session');
  }
  return {
    firstOwner: first.userId, refreshedOwner: refreshed.userId,
    switchedOwner: second.userId, refreshEpochAdvanced: true,
    previousOwnerDenied: deniedPreviousOwner, remoteRevocationConfirmed: revoked,
    localSessionCleared: true,
  };
}

Object.assign(window, {
  __mosaicSignedRxdb: {
    privateProviderFixtures,
    exerciseSignedAuthLifecycle,
    start, stop, edit, snapshot,
    setOffline(value: boolean) { offline = value; },
    resync() { if (!active) throw new Error('No active signed replica'); active.resync(); },
    async awaitSynced() {
      if (!active) throw new Error('No active signed replica');
      await active.state.awaitInSync();
    },
    async resolveKeepLocal(id: string, revision: string) {
      if (!conflictPilot) throw new Error('No active signed conflict pilot');
      return conflictPilot.resolveKeepLocal(id, revision);
    },
    async refreshConflict(id: string) {
      if (!conflictPilot) throw new Error('No active signed conflict pilot');
      return conflictPilot.refreshPendingConflict(id);
    },
  },
});
