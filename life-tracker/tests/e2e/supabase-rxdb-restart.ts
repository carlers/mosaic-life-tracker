/**
 * Browser-only #967 RxDB checkpoint/queued-write probe. Runs only from the
 * Playwright fixture page; no Mosaic application bootstrap or cloud calls.
 *
 * RxDB + Dexie + IndexedDB are REAL. "Remote Supabase" rows are deliberately
 * simulated via sessionStorage to survive browser reload independently.
 * Do not mistake this for hosted Supabase Auth or live multi-device evidence.
 */
import { createRxDatabase, type RxDatabase, type RxCollection } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { categoriesSchema, type CategoryDocument } from '../../src/db/schema';
import {
  type CandidateCategoryRow, type CandidateIdentity,
  toCandidateCategoryWrite,
} from '../../supabase-poc/candidateMapping';
import {
  createCandidateRxdbPilot,
} from '../../supabase-poc/candidateRxdbPilot';
import type { CandidateChangeTransport } from '../../supabase-poc/candidatePull';
import type { createCandidateCreateTransport } from '../../supabase-poc/candidateCreateTransport';
import type { createCandidateCasTransport } from '../../supabase-poc/candidateCasTransport';

const params = new URLSearchParams(window.location.search);
const tag = params.get('id') ?? 'default';
if (!/^[a-zA-Z][a-zA-Z0-9_]{0,32}$/.test(tag))
  throw new Error('Invalid browser-only RxDB test database suffix');

const identity: CandidateIdentity = {
  legacyUserId: 'legacy_local_candidate_owner',
  supabaseUserId: '11111111-1111-4111-8111-111111111111',
};
type Collections = { categories: RxCollection<CategoryDocument> };
type Db = RxDatabase<Collections>;
let db: Db | null = null;
let stopReplication: (() => Promise<void>) | null = null;
let replication: { awaitInitialReplication(): Promise<unknown>; reSync(): void } | null = null;
let afterCursors: string[] = [];
let failedOfflinePushes = 0;
const STORAGE_KEY = 'mosaic-967-fake-remote-' + tag;
const OFFLINE_KEY = 'mosaic-967-offline-' + tag;

function startFixtureRow(): CandidateCategoryRow {
  return {
    owner_id: identity.supabaseUserId,
    id: 'seed_first_' + tag,
    name: 'From remote', color: '#222222', order_index: 0,
    visibility: 'private', icon: null, updated_at: '2026-10-19T00:00:00.000Z',
    is_deleted: false, change_seq: '1', server_updated_at: '2026-10-19T00:00:00.000Z',
  };
}
function remoteRows(): CandidateCategoryRow[] {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const initial = [startFixtureRow()];
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    return initial;
  }
  return JSON.parse(raw) as CandidateCategoryRow[];
}
function saveRemote(rows: CandidateCategoryRow[]) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}
function offline(): boolean {
  return sessionStorage.getItem(OFFLINE_KEY) === '1';
}
function checkAvailable() {
  if (offline()) {
    failedOfflinePushes++;
    throw new Error('Synthetic remote outage; preserve local RxDB write');
  }
}
function allocateRevision(rows: CandidateCategoryRow[]): string {
  return (rows.reduce((max, row) => {
    const revision = BigInt(row.change_seq);
    return revision > max ? revision : max;
  }, 0n) + 1n).toString();
}

const changes: CandidateChangeTransport = {
  async listChanges<R>({ domain, ownerId, afterExclusive, batchSize }): Promise<R[]> {
    if (domain !== 'categories' || ownerId !== identity.supabaseUserId)
      throw new Error('Wrong candidate owner or domain');
    afterCursors.push(afterExclusive);
    if (offline()) throw new Error('Synthetic remote offline on pull');
    return remoteRows()
      .filter(row => row.owner_id === ownerId && BigInt(row.change_seq) > BigInt(afterExclusive))
      .sort((a, b) => BigInt(a.change_seq) < BigInt(b.change_seq) ? -1 : 1)
      .slice(0, batchSize) as unknown as R[];
  },
};
const writer = {
  async readCategoryMaster(id: string): Promise<CandidateCategoryRow | null> {
    checkAvailable();
    return remoteRows().find(row => row.owner_id === identity.supabaseUserId && row.id === id) ?? null;
  },
  async createCategory(document: CategoryDocument) {
    checkAvailable();
    const rows = remoteRows();
    const exists = rows.find(row => row.id === document.id);
    if (exists)
      return { state: 'conflict' as const, row: exists, revision: String(exists.change_seq) };
    const revision = allocateRevision(rows);
    const added: CandidateCategoryRow = {
      ...toCandidateCategoryWrite(document, identity),
      change_seq: revision,
      server_updated_at: '2026-10-19T00:00:00.000Z',
    };
    saveRemote([...rows, added]);
    return { state: 'created' as const, row: added, revision };
  },
  readTaskMaster: async () => { throw new Error('Not part of this categories-only probe'); },
  createTask: async () => { throw new Error('Not part of this categories-only probe'); },
} as unknown as ReturnType<typeof createCandidateCreateTransport>;
const cas = {
  async compareAndSet({
    domain, ownerId, documentId, expectedRevision, patch,
  }: {
    domain: string; ownerId: string; documentId: string;
    expectedRevision: string; patch: Record<string, string | number | boolean | null>;
  }) {
    checkAvailable();
    if (domain !== 'categories' || ownerId !== identity.supabaseUserId)
      throw new Error('Wrong CAS owner');
    const rows = remoteRows();
    const index = rows.findIndex(row => row.owner_id === ownerId && row.id === documentId);
    if (index < 0 || String(rows[index].change_seq) !== expectedRevision)
      return { state: 'conflict' as const };
    if (Object.keys(patch).some(key => ![
      'name', 'color', 'order_index', 'visibility', 'icon', 'updated_at', 'is_deleted',
    ].includes(key))) throw new Error('Forged CAS patch field');
    const revision = allocateRevision(rows);
    const next: CandidateCategoryRow = {
      ...rows[index], ...patch, change_seq: revision,
      server_updated_at: '2026-10-19T00:00:00.000Z',
    } as CandidateCategoryRow;
    rows[index] = next;
    saveRemote(rows);
    return { state: 'applied' as const, revision, row: next };
  },
} as unknown as ReturnType<typeof createCandidateCasTransport>;

async function openDb() {
  if (db) throw new Error('Candidate DB already open');
  db = await createRxDatabase<Collections>({
    name: 'mosaic_sb_967_' + tag,
    storage: getRxStorageDexie(),
    multiInstance: false,
    eventReduce: true,
  });
  await db.addCollections({ categories: { schema: categoriesSchema } });
}
async function start() {
  if (replication) throw new Error('Candidate pilot already started');
  if (!db) await openDb();
  afterCursors = [];
  failedOfflinePushes = 0;
  const pilot = createCandidateRxdbPilot<CategoryDocument>({
    domain: 'categories', identity, changes,
    session: {
      getVerifiedSession: async () => ({
        userId: identity.supabaseUserId,
        accessToken: 'browser-only-synthetic-no-JWT',
        sessionEpoch: 1,
      }),
    },
    writer,
    cas,
    collection: db!.categories,
  });
  const active = pilot.start();
  replication = active.state;
  stopReplication = active.stop;
  await active.state.awaitInitialReplication();
}
async function stop() {
  if (stopReplication) await stopReplication();
  stopReplication = null;
  replication = null;
  if (db) await db.close();
  db = null;
}
function seedAnotherRemoteRow() {
  const rows = remoteRows();
  if (rows.length !== 1) throw new Error('Unexpected fixture remote state');
  saveRemote([...rows, {
    ...startFixtureRow(),
    id: 'seed_second_' + tag, name: 'Created while replica closed',
    change_seq: '2', updated_at: '2026-10-20T00:00:00.000Z',
  }]);
}
async function editLocal() {
  if (!db) throw new Error('No local browser RxDB database');
  const doc = await db.categories.findOne('seed_first_' + tag).exec();
  if (!doc) throw new Error('Missing local seeded row');
  await doc.incrementalPatch({
    name: 'Offline local edit',
    updatedAt: '2026-10-21T00:00:00.000Z',
  });
}
async function snapshot() {
  const local = db ? await db.categories.find().exec() : [];
  return {
    local: local.map(doc => doc.toJSON()).map(row => ({
      id: row.id, name: row.name, userId: row.userId,
      isDeleted: row.isDeleted,
    })),
    remote: remoteRows().map(row => ({
      id: row.id, name: row.name, changeSeq: String(row.change_seq),
    })),
    afterCursors: [...afterCursors],
    failedOfflinePushes,
  };
}
Object.assign(window, {
  __mosaicCandidateProbe: {
    start, stop, snapshot, seedAnotherRemoteRow, editLocal,
    setOffline(value: boolean) {
      sessionStorage.setItem(OFFLINE_KEY, value ? '1' : '0');
    },
  },
});
