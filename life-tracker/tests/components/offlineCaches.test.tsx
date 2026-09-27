import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createPendingImage,
  deletePendingImage,
  getPendingImage,
  resetPendingImagesForTests,
} from '../../src/lib/pendingImages';
import {
  getCachedCalendar,
  setCachedCalendar,
  type FriendCalendarBundle,
} from '../../src/lib/friendCache';
import {
  clearAllCachedOwnProfiles,
  readCachedOwnProfile,
  writeCachedOwnProfile,
} from '../../src/lib/profileCache';
import type { ProfileCard } from '../../src/lib/social';

type StoredDb = {
  version: number;
  stores: Map<string, Map<IDBValidKey, unknown>>;
  keyPaths: Map<string, string | null>;
};

function makeIndexedDbStub() {
  const databases = new Map<string, StoredDb>();

  class FakeRequest<T> {
    onsuccess: (() => void) | null = null;
    onerror: (() => void) | null = null;
    onupgradeneeded:
      | ((event: IDBVersionChangeEvent) => void)
      | null = null;
    result!: T;
    error: DOMException | null = null;
    transaction: FakeTransaction | null = null;
  }

  function complete<T>(result: T): FakeRequest<T> {
    const request = new FakeRequest<T>();
    request.result = result;
    queueMicrotask(() => request.onsuccess?.());
    return request;
  }

  class FakeObjectStore {
    constructor(
      private readonly store: Map<IDBValidKey, unknown>,
      private readonly keyPath: string | null
    ) {}

    get(key: IDBValidKey) {
      return complete(this.store.get(key));
    }

    getAll() {
      return complete([...this.store.values()]);
    }

    put(value: unknown, explicitKey?: IDBValidKey) {
      const key =
        explicitKey ??
        (this.keyPath && value && typeof value === 'object'
          ? (value as Record<string, unknown>)[this.keyPath]
          : undefined);
      if (
        typeof key !== 'string' &&
        typeof key !== 'number' &&
        !(key instanceof Date) &&
        !Array.isArray(key)
      ) {
        throw new Error('Fake IndexedDB put requires a key.');
      }
      this.store.set(key, value);
      return complete(key);
    }

    delete(key: IDBValidKey) {
      this.store.delete(key);
      return complete(undefined);
    }

    clear() {
      this.store.clear();
      return complete(undefined);
    }
  }

  class FakeTransaction {
    constructor(private readonly db: StoredDb) {}

    objectStore(name: string) {
      const store = this.db.stores.get(name);
      if (!store) throw new Error(`Missing object store: ${name}`);
      return new FakeObjectStore(
        store,
        this.db.keyPaths.get(name) ?? null
      );
    }
  }

  class FakeDatabase {
    constructor(private readonly db: StoredDb) {}

    objectStoreNames = {
      contains: (name: string) => this.db.stores.has(name),
    };

    createObjectStore(
      name: string,
      options?: IDBObjectStoreParameters
    ) {
      const store = new Map<IDBValidKey, unknown>();
      this.db.stores.set(name, store);
      this.db.keyPaths.set(
        name,
        typeof options?.keyPath === 'string' ? options.keyPath : null
      );
      return new FakeObjectStore(
        store,
        this.db.keyPaths.get(name) ?? null
      );
    }

    transaction(_name: string, _mode: IDBTransactionMode) {
      return new FakeTransaction(this.db);
    }
  }

  return {
    open(name: string, version = 1) {
      const previous = databases.get(name);
      const oldVersion = previous?.version ?? 0;
      const db: StoredDb =
        previous ?? {
          version,
          stores: new Map(),
          keyPaths: new Map(),
        };
      db.version = Math.max(db.version, version);
      databases.set(name, db);

      const request = new FakeRequest<FakeDatabase>();
      queueMicrotask(() => {
        request.result = new FakeDatabase(db);
        request.transaction = new FakeTransaction(db);
        if (version > oldVersion) {
          request.onupgradeneeded?.({
            oldVersion,
            newVersion: version,
          } as IDBVersionChangeEvent);
        }
        request.onsuccess?.();
      });
      return request;
    },
  };
}

function bundle(friendUserId: string, title: string): FriendCalendarBundle {
  return {
    friendUserId,
    fetchedAt: new Date().toISOString(),
    categories: [],
    tasks: [
      {
        id: 'task_cache',
        userId: friendUserId,
        title,
        completed: false,
        categoryId: '',
        date: '2026-09-27',
        createdAt: '2026-09-27T00:00:00.000Z',
        updatedAt: '2026-09-27T00:00:00.000Z',
        isDeleted: false,
        visibility: 'private',
      },
    ],
  };
}

describe('offline auxiliary caches', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('indexedDB', makeIndexedDbStub());
    resetPendingImagesForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // Regression: §24.18 (pending image blobs remain account isolated).
  it('keeps pending image blobs owner scoped', async () => {
    const id = await createPendingImage(
      'user_A',
      new Blob(['photo'], { type: 'image/webp' })
    );

    expect(await getPendingImage(id, 'user_A')).toBeInstanceOf(Blob);
    expect(await getPendingImage(id, 'user_B')).toBeNull();

    await deletePendingImage(id, 'user_B');
    expect(await getPendingImage(id, 'user_A')).toBeInstanceOf(Blob);

    await deletePendingImage(id, 'user_A');
    expect(await getPendingImage(id, 'user_A')).toBeNull();
  });

  // Regression: §24.18 (friend cache is owner + friend scoped).
  it('isolates the same friend calendar between local Mosaic accounts', async () => {
    await setCachedCalendar('user_A', bundle('friend_1', 'A copy'));
    await setCachedCalendar('user_B', bundle('friend_1', 'B copy'));

    expect(
      (await getCachedCalendar('user_A', 'friend_1'))?.tasks[0].title
    ).toBe('A copy');
    expect(
      (await getCachedCalendar('user_B', 'friend_1'))?.tasks[0].title
    ).toBe('B copy');
  });

  it('allows stale friend cache only when explicitly requested', async () => {
    vi.spyOn(Date, 'now')
      .mockReturnValueOnce(1_000)
      .mockReturnValue(1_000 + 5 * 60 * 1000 + 1);

    await setCachedCalendar('user_A', bundle('friend_1', 'Cached'));

    expect(await getCachedCalendar('user_A', 'friend_1')).toBeNull();
    expect(
      await getCachedCalendar('user_A', 'friend_1', { allowStale: true })
    ).toMatchObject({ friendUserId: 'friend_1' });
  });

  it('keeps own-profile cache keyed to its owner', () => {
    const profile = {
      $id: 'profile_user_A',
      user_id: 'user_A',
      username: 'user_a',
      display_name: 'User A',
      avatar_file_id: '',
      bio: '',
      is_searchable: true,
    } as ProfileCard;
    writeCachedOwnProfile('user_A', profile);

    expect(readCachedOwnProfile('user_A')?.username).toBe('user_a');
    expect(readCachedOwnProfile('user_B')).toBeNull();

    clearAllCachedOwnProfiles();
    expect(readCachedOwnProfile('user_A')).toBeNull();
  });
});
