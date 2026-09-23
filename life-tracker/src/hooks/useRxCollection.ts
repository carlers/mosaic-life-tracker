import { useEffect, useState } from 'react';
import { getDatabase } from '../db/database';
import { useAuth } from './useAuth';
import type { AppDatabaseCollections } from '../db/database';

type CollectionName = keyof AppDatabaseCollections;

interface UseRxCollectionOptions<TDoc, TData> {
  /**
   * RxDB collection name. Typed against `AppDatabaseCollections` so a
   * typo is a compile error, not a silent empty subscription.
   */
  collection: CollectionName;
  /**
   * Selector passed to `collection.find({ selector })`. Always includes
   * `userId` and `isDeleted: false` at the call sites; the primitive
   * does not enforce it because a future caller may need a different
   * shape (e.g. an admin-style query).
   */
  selector: Record<string, unknown>;
  /** RxDB sort array. Optional; omit for default order. */
  sort?: Array<Record<string, 'asc' | 'desc'>>;
  /**
   * Transforms the raw RxDocument array into the hook's public data
   * shape. Defaults to identity. `useSettings` uses this to build its
   * `Record<string, unknown>` map.
   */
  map?: (docs: TDoc[]) => TData;
  /**
   * Runs once per `userId` before the subscription is created. Used by
   * `useSettings` to purge oversized legacy rows. A failure here is
   * logged but does not block the subscription.
   */
  beforeSubscribe?: (userId: string) => Promise<void>;
  /** Log prefix for the error path, e.g. `[useTasks]`. */
  logPrefix: string;
  /** Skip the subscription while preserving the hook call order. */
  enabled?: boolean;
}

interface UseRxCollectionResult<TData> {
  data: TData;
  isLoading: boolean;
}

/**
 * Local permissive view of an RxCollection that collapses the six-way
 * union of typed collections into one callable surface. Mirrors the
 * `LocalCollection` type in `sync.ts`. Casting at the boundary is
 * unavoidable: RxDB's `RxCollection<T>` is invariant in T and the six
 * collections are distinct types.
 */
interface LocalQuery {
  $: {
    subscribe: (cb: (docs: unknown[]) => void) => {
      unsubscribe: () => void;
    };
  };
}
interface LocalCollectionHandle {
  find: (query: {
    selector: Record<string, unknown>;
    sort?: Array<Record<string, 'asc' | 'desc'>>;
  }) => LocalQuery;
}

const EMPTY_ARRAY: never[] = [];

/**
 * Shared RxDB subscription scaffold for the four per-user data hooks
 * (`useTasks`, `useCategories`, `useDiary`, `useSettings`). Owns:
 *
 *   - auth guard (`user?.$id` — never the user object itself, §9)
 *   - the `find({ selector, sort }).$.subscribe(...)` lifecycle
 *   - the `loadedUserId` cross-user leakage guard (§9)
 *   - the `isMounted` cancellation flag
 *
 * Does NOT own mutators. Each hook keeps its own writes; the primitive
 * only centralizes the read path that the four hooks duplicated
 * verbatim.
 */
export function useRxCollection<
  TDoc,
  TData = TDoc[]
>({
  collection,
  selector,
  sort,
  map,
  beforeSubscribe,
  logPrefix,
  enabled = true,
}: UseRxCollectionOptions<TDoc, TData>): UseRxCollectionResult<TData> {
  const { user } = useAuth();
  const userId = user?.$id;

  const [docs, setDocs] = useState<TDoc[]>(() => EMPTY_ARRAY as unknown as TDoc[]);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);

  const selectorKey = JSON.stringify(selector);
  const sortKey = sort ? JSON.stringify(sort) : '';

  useEffect(() => {
    if (!enabled || !userId) return;
    const uid = userId;

    let subscription: { unsubscribe: () => void } | undefined;
    let isMounted = true;

    async function init() {
      try {
        if (beforeSubscribe) {
          try {
            await beforeSubscribe(uid);
          } catch (err) {
            console.warn(`${logPrefix} beforeSubscribe failed:`, err);
          }
        }
        if (!isMounted) return;

        const db = getDatabase();
        const collectionHandle = db[collection] as unknown as LocalCollectionHandle;
        const query = collectionHandle.find({
          selector,
          ...(sort ? { sort } : {}),
        });

        const sub = query.$.subscribe((incoming) => {
          if (!isMounted) return;
          setDocs(incoming as TDoc[]);
          setLoadedUserId(uid);
        });

        if (!isMounted) {
          sub.unsubscribe();
        } else {
          subscription = sub;
        }
      } catch (error) {
        console.error(`${logPrefix} Error loading:`, error);
        if (isMounted) setLoadedUserId(uid);
      }
    }

    init();

    return () => {
      isMounted = false;
      if (subscription) subscription.unsubscribe();
    };
    // `selectorKey`/`sortKey` are the JSON-stable proxies for the object
    // literals; including the raw objects would re-subscribe on every
    // render (new identity each time).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, collection, selectorKey, sortKey, enabled]);

  const isEmpty = !enabled || !userId || loadedUserId !== userId;
  const data = isEmpty
    ? ((map ? map(EMPTY_ARRAY as unknown as TDoc[]) : EMPTY_ARRAY) as TData)
    : ((map ? map(docs) : (docs as unknown as TData)) as TData);
  const isLoading = enabled && !!userId && loadedUserId !== userId;

  return { data, isLoading };
}
