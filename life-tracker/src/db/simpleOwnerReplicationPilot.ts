import { Permission, Role } from 'appwrite';
import type { RxCollection, RxReplicationPullStreamItem, RxReplicationWriteToMasterRow, WithDeletedAndAttachments } from 'rxdb';
import { replicateRxCollection, type RxReplicationState } from 'rxdb/plugins/replication';
import { Subject, type Subscription } from 'rxjs';
import { guardedTablesDB, type RealtimeUnsubscribe } from '../lib/sdk';
import { fromAppwriteFormat, toAppwriteFormat } from '../lib/syncMapping';
import { APPWRITE_DATABASE_ID } from '../lib/appwriteConfig';
import { awaitPilotReplicationFreshness } from './replicationFreshness';
import { getReplicationIdentifier, type SyncedCollectionName } from './replicationIds';
import { trackReplicationFreshness } from './replicationLocalState';
import { createOwnerRowViaFunction, readOwnerMaster, updateOwnerRowWithCas } from './ownerWriteCas';
import { captureReplicationPushCheckpoint, pullOwnerRowsByUpdatedAtId, subscribeToOwnerRealtime } from './replicationPilotPrimitives';
import { createReplicationPilotLifecycleQueue } from './replicationPilotLifecycle';

export type SimpleOwnerPullCheckpoint = { updatedAt: string; id: string };
export type SimpleOwnerPushCheckpoint = { id: string; lwt: number };
type OwnerDocument = { id: string; userId: string; updatedAt: string; isDeleted: boolean };

export function createSimpleOwnerReplicationPilot<D extends OwnerDocument>(config: {
  collectionName: Extract<SyncedCollectionName, 'categories' | 'diary' | 'bucketList' | 'bucketTaskLinks'>;
  tableId: string;
  casTableId: Parameters<typeof updateOwnerRowWithCas>[0];
  label: string;
  freshnessLabel: string;
  equalityFields: ReadonlyArray<keyof D>;
  /** True iff server-owned state was mutated and the CAS token needs refresh. */
  beforeWrite?: (next: D, current: D, userId: string) => Promise<boolean>;
}) {
  type Replicated = WithDeletedAndAttachments<D>;
  type Checkpoint = SimpleOwnerPullCheckpoint;
  let ownerId: string | null = null;
  let replication: RxReplicationState<D, Checkpoint> | null = null;
  let collection: RxCollection<D> | null = null;
  let pullStream: Subject<RxReplicationPullStreamItem<D, Checkpoint>> | null = null;
  let unsubscribeRealtime: RealtimeUnsubscribe | null = null;
  let errorSubscription: Subscription | null = null;

  const mapRow = (row: Record<string, unknown>): Replicated => ({
    ...(fromAppwriteFormat(row, config.collectionName) as unknown as D),
    _deleted: false,
  });
  const equals = (a: Replicated, b: Replicated): boolean =>
    config.equalityFields.every(key => (a[key] ?? '') === (b[key] ?? '')) &&
    a._deleted === b._deleted;
  const newer = (local: string, remote: string) => {
    const a = Date.parse(local);
    const b = Date.parse(remote);
    return Number.isFinite(a) && Number.isFinite(b) && a > b;
  };
  const read = (id: string, userId: string) =>
    readOwnerMaster(config.tableId, id, userId, mapRow);

  async function create(next: Replicated, userId: string): Promise<Replicated | null> {
    const data = toAppwriteFormat(next as unknown as Record<string, unknown>, config.collectionName, userId);
    if (config.collectionName === 'categories') {
      const server = await createOwnerRowViaFunction('categories', next.id, userId, data);
      if (server.status === 'created') return null;
      if (server.status === 'existing') return mapRow(server.row);
    }
    try {
      await guardedTablesDB.createRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: config.tableId,
        rowId: next.id,
        data,
        permissions: [
          Permission.read(Role.user(userId)),
          Permission.update(Role.user(userId)),
          Permission.delete(Role.user(userId)),
        ],
      });
      return null;
    } catch (error) {
      if ((error as { code?: number } | null)?.code !== 409) throw error;
      const current = await read(next.id, userId);
      if (current) return current.document;
      throw error;
    }
  }

  async function push(rows: RxReplicationWriteToMasterRow<D>[], userId: string): Promise<Replicated[]> {
    const conflicts: Replicated[] = [];
    for (const row of rows) {
      const next = row.newDocumentState;
      // Other accounts share the local DB but not this owner's remote queue.
      if (next.userId !== userId) continue;
      if (next._deleted) throw new Error(config.label + ' replication cannot physically delete ' + next.id + '; use isDeleted tombstones');

      const master = await read(next.id, userId);
      const current = master?.document ?? null;
      const assumed = row.assumedMasterState;

      if (!assumed) {
        if (!current) {
          const conflict = await create(next, userId);
          if (conflict) conflicts.push(conflict);
          continue;
        }
        // On first sync, an RxDB local revision alone does not prove an edit:
        // it can be the result of a previous downstream replication.
        if (equals(current, next)) continue;
        if (!newer(next.updatedAt, current.updatedAt)) {
          conflicts.push(current);
          continue;
        }
      } else if (current && !equals(current, assumed)) {
        conflicts.push(current);
        continue;
      }

      if (!current) {
        const conflict = await create(next, userId);
        if (conflict) conflicts.push(conflict);
        continue;
      }
      if (!master) throw new Error(config.label + ' replication master token missing for ' + next.id);
      // An owner-scoped pre-write guard may update server-owned privacy state.
      // Re-read the server CAS token rather than using its stale value.
      let writeMaster = master;
      if (config.beforeWrite && await config.beforeWrite(next as D, current as D, userId)) {
        const refreshed = await read(next.id, userId);
        if (!refreshed) throw new Error(config.label + ' row disappeared after privacy guard');
        if (!equals(refreshed.document, current)) {
          conflicts.push(refreshed.document);
          continue;
        }
        writeMaster = refreshed;
      }

      const result = await updateOwnerRowWithCas(
        config.casTableId, next.id, userId, writeMaster.serverUpdatedAt,
        toAppwriteFormat(next as unknown as Record<string, unknown>, config.collectionName, userId)
      );
      if (result.status === 'conflict') {
        conflicts.push(mapRow(result.row));
      } else if (result.status === 'missing') {
        const conflict = await create(next, userId);
        if (conflict) conflicts.push(conflict);
      }
    }
    return conflicts;
  }

  function pull(userId: string, checkpoint: Checkpoint | undefined, batchSize: number) {
    return pullOwnerRowsByUpdatedAtId<Replicated, Checkpoint>({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: config.tableId,
      userId,
      ownerLabel: config.label,
      checkpoint,
      batchSize,
      mapRow,
    });
  }
  const capture = (local: RxCollection<D>) =>
    captureReplicationPushCheckpoint<D, SimpleOwnerPushCheckpoint>(local, 200);
  const active = (userId: string): boolean => ownerId === userId && replication !== null;
  const resync = (userId: string): boolean => {
    if (!active(userId)) return false;
    replication?.reSync();
    return true;
  };
  const refresh = async (userId: string, timeoutMs: number): Promise<boolean> => {
    if (!active(userId) || !replication || !collection) return false;
    await awaitPilotReplicationFreshness(config.freshnessLabel, replication, collection, timeoutMs);
    return true;
  };
  async function stopNow(userId?: string): Promise<void> {
    if (userId && ownerId !== userId) return;
    const old = replication;
    ownerId = null;
    replication = null;
    collection = null;
    unsubscribeRealtime?.();
    unsubscribeRealtime = null;
    errorSubscription?.unsubscribe();
    errorSubscription = null;
    pullStream?.complete();
    pullStream = null;
    if (old) await old.cancel();
  }
  async function startNow(
    userId: string,
    local: RxCollection<D>,
    initialPushCheckpoint: SimpleOwnerPushCheckpoint | undefined
  ): Promise<void> {
    if (!userId || active(userId)) return;
    if (replication) await stopNow();
    const stream = new Subject<RxReplicationPullStreamItem<D, Checkpoint>>();
    const next = replicateRxCollection<D, Checkpoint>({
      replicationIdentifier: getReplicationIdentifier(config.collectionName, userId),
      collection: local,
      live: true,
      retryTime: 5_000,
      waitForLeadership: true,
      toggleOnDocumentVisible: true,
      pull: {
        batchSize: 100,
        stream$: stream.asObservable(),
        handler: (checkpoint, batchSize) => pull(userId, checkpoint, batchSize),
      },
      push: {
        batchSize: 20,
        initialCheckpoint: initialPushCheckpoint,
        handler: (rows) => push(rows, userId),
      },
    });
    ownerId = userId;
    replication = next;
    trackReplicationFreshness(next, userId, config.collectionName);
    collection = local;
    pullStream = stream;
    unsubscribeRealtime = subscribeToOwnerRealtime({
      channel: 'databases.' + APPWRITE_DATABASE_ID + '.tables.' + config.tableId + '.rows',
      userId,
      isActiveOwner: () => ownerId === userId,
      pullStream: stream,
    });
    errorSubscription = next.error$.subscribe(error => {
      console.error('[' + config.label + 'ReplicationPilot] replication error:', error);
    });
  }
  const queue = createReplicationPilotLifecycleQueue();
  const stop = (userId?: string) => queue(() => stopNow(userId));
  const start = (userId: string, local: RxCollection<D>, checkpoint: SimpleOwnerPushCheckpoint | undefined) =>
    queue(() => startNow(userId, local, checkpoint));
  return { capture, pull, push, active, resync, refresh, stop, start };
}
