// Regression: BACKUP_RESTORE.md (validated, idempotent merge/replace restore).
import { beforeEach, describe, expect, it, vi } from 'vitest';

type CollectionName = 'tasks' | 'categories' | 'diary' | 'settings' | 'friendships' | 'messages';

type Stored = Record<string, unknown>;

const state = vi.hoisted(() => {
  const rows = {
    tasks: new Map<string, Stored>(),
    categories: new Map<string, Stored>(),
    diary: new Map<string, Stored>(),
    settings: new Map<string, Stored>(),
    friendships: new Map<string, Stored>(),
    messages: new Map<string, Stored>(),
  };
  return {
    rows,
    sync: vi.fn().mockResolvedValue(undefined),
    exportUserData: vi.fn().mockResolvedValue({
      blob: new Blob(['safety'], { type: 'application/json' }),
      filename: 'mosaic-safety.json',
      counts: {
        tasks: 0,
        categories: 0,
        diary: 0,
        settings: 0,
        friendships: 0,
        images: 0,
        missingImages: 0,
      },
    }),
    triggerDownload: vi.fn(),
    uploadImage: vi.fn().mockResolvedValue('img_restored'),
  };
});

function resetRows() {
  for (const map of Object.values(state.rows)) map.clear();
}

function wrap(collection: CollectionName, id: string) {
  const map = state.rows[collection];
  return {
    get id() {
      return id;
    },
    toJSON: () => ({ ...(map.get(id) ?? {}) }),
    incrementalPatch: vi.fn(async (patch: Stored) => {
      map.set(id, { ...(map.get(id) ?? {}), ...patch });
    }),
  };
}

function dbCollection(collection: CollectionName) {
  const map = state.rows[collection];
  return {
    findOne: (id: string) => ({ exec: async () => (map.has(id) ? wrap(collection, id) : null) }),
    find: () => ({ exec: async () => Array.from(map.keys(), (id) => wrap(collection, id)) }),
    insert: async (doc: Stored) => {
      map.set(String(doc.id), { ...doc });
    },
  };
}

vi.mock('../../src/db/database', () => ({
  getDatabase: () => ({
    tasks: dbCollection('tasks'),
    categories: dbCollection('categories'),
    diary: dbCollection('diary'),
    settings: dbCollection('settings'),
    friendships: dbCollection('friendships'),
    messages: dbCollection('messages'),
  }),
}));

vi.mock('../../src/lib/localUpsert', () => ({
  upsertLocalDoc: vi.fn(async (collection: CollectionName, id: string, doc: Stored) => {
    const map = state.rows[collection];
    map.set(id, { ...(map.get(id) ?? {}), ...doc });
  }),
}));

vi.mock('../../src/db/sync', () => ({ initializeSync: state.sync }));
vi.mock('../../src/lib/exportData', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/lib/exportData')>();
  return {
    ...actual,
    exportUserData: state.exportUserData,
    triggerDownload: state.triggerDownload,
  };
});
vi.mock('../../src/lib/storage', () => ({ uploadImage: state.uploadImage }));

import { inspectBackupFile, restoreUserData } from '../../src/lib/restoreData';

const currentUser = { id: 'user_A', email: 'a@example.com', name: 'A' };

function jsonBackup(overrides: Record<string, unknown> = {}) {
  const payload = {
    app: { name: 'Mosaic', version: '0.1.0' },
    version: 2,
    exportedAt: '2026-09-20T12:00:00.000Z',
    user: currentUser,
    counts: {
      tasks: 0,
      categories: 0,
      diary: 0,
      settings: 0,
      friendships: 0,
      images: 0,
      missingImages: 0,
    },
    data: {
      tasks: [],
      categories: [],
      diary: [],
      settings: [],
      friendships: [],
    },
    images: {
      included: false,
      referenced: [],
      missingImages: [],
      note: 'No image blobs.',
    },
    ...overrides,
  };
  return new File([JSON.stringify(payload)], 'backup.json', { type: 'application/json' });
}

describe('backup restore', () => {
  beforeEach(() => {
    resetRows();
    vi.clearAllMocks();
    state.sync.mockResolvedValue(undefined);
    state.uploadImage.mockResolvedValue('img_restored');
    state.exportUserData.mockResolvedValue({
      blob: new Blob(['safety'], { type: 'application/json' }),
      filename: 'mosaic-safety.json',
      counts: {
        tasks: 0,
        categories: 0,
        diary: 0,
        settings: 0,
        friendships: 0,
        images: 0,
        missingImages: 0,
      },
    });
  });

  it('accepts legacy v1 JSON and reports friendships as reference-only', async () => {
    const file = new File([
      JSON.stringify({
        app: { name: 'Mosaic', version: '0.0.0' },
        version: 1,
        exportedAt: '2026-09-01T00:00:00.000Z',
        user: currentUser,
        counts: { tasks: 1, categories: 0, diary: 0, settings: 1, friendships: 2, images: 0, missingImages: 0 },
        data: {
          tasks: [{
            id: 'task_1', title: 'Old export', completed: false, categoryId: '', date: '2026-09-01',
            createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z',
            userId: 'user_A', isDeleted: false, visibility: 'private',
          }],
          categories: [],
          diary: [],
          settings: { showTodayTag: true },
          friendships: [{ id: 'friend_ref' }, { id: 'friend_ref_2' }],
        },
        images: { included: false, referenced: [], missingImages: [], note: '' },
      }),
    ], 'legacy.json', { type: 'application/json' });

    const preview = await inspectBackupFile(file);

    expect(preview.version).toBe(1);
    expect(preview.counts.tasks).toBe(1);
    expect(preview.counts.settings).toBe(1);
    expect(preview.friendshipsReferenceOnly).toBe(2);
  });

  it('merge preserves a newer current row and imports a newer missing row', async () => {
    state.rows.tasks.set('task_keep', {
      id: 'task_keep', title: 'Current title', completed: false, categoryId: '', date: '2026-09-19',
      createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-21T00:00:00.000Z',
      userId: 'user_A', isDeleted: false, visibility: 'private',
    });
    const file = jsonBackup({
      data: {
        tasks: [
          {
            id: 'task_keep', title: 'Older backup title', completed: false, categoryId: '', date: '2026-09-19',
            createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-20T00:00:00.000Z',
            userId: 'user_A', isDeleted: false, visibility: 'private',
          },
          {
            id: 'task_new', title: 'Imported', completed: false, categoryId: '', date: '2026-09-20',
            createdAt: '2026-09-20T00:00:00.000Z', updatedAt: '2026-09-22T00:00:00.000Z',
            userId: 'user_A', isDeleted: false, visibility: 'private',
          },
        ],
        categories: [],
        diary: [],
        settings: [],
        friendships: [],
      },
    });

    const result = await restoreUserData(file, currentUser, { mode: 'merge' });

    expect(state.rows.tasks.get('task_keep')?.title).toBe('Current title');
    expect(state.rows.tasks.get('task_new')).toMatchObject({ title: 'Imported', userId: 'user_A' });
    expect(result.skippedNewer).toBe(1);
    expect(result.restored.tasks).toBe(1);
    expect(state.sync).toHaveBeenCalled();
  });

  it('cross-account restore uses deterministic IDs and is duplicate-safe', async () => {
    const file = jsonBackup({
      user: { id: 'source_user', email: 'source@example.com', name: 'Source' },
      data: {
        categories: [{
          id: 'cat_source', name: 'Work', color: '#123456', order: 0, visibility: 'private',
          userId: 'source_user', isDeleted: false, updatedAt: '2026-09-20T00:00:00.000Z',
        }],
        tasks: [{
          id: 'task_source', title: 'Portable', completed: false, categoryId: 'cat_source', date: '2026-09-20',
          createdAt: '2026-09-20T00:00:00.000Z', updatedAt: '2026-09-20T00:00:00.000Z',
          userId: 'source_user', isDeleted: false, visibility: 'private',
        }],
        diary: [],
        settings: [],
        friendships: [],
      },
    });

    await restoreUserData(file, currentUser, { mode: 'merge' });
    await restoreUserData(file, currentUser, { mode: 'merge' });

    expect(state.rows.categories.size).toBe(1);
    expect(state.rows.tasks.size).toBe(1);
    const category = Array.from(state.rows.categories.values())[0];
    const task = Array.from(state.rows.tasks.values())[0];
    expect(category.id).not.toBe('cat_source');
    expect(task.id).not.toBe('task_source');
    expect(task.categoryId).toBe(category.id);
    expect(task.userId).toBe('user_A');
  });

  it('replace tombstones missing personal rows without touching friendships or messages', async () => {
    state.rows.tasks.set('task_extra', {
      id: 'task_extra', title: 'Remove me', completed: false, categoryId: '', date: '2026-09-20',
      createdAt: '2026-09-20T00:00:00.000Z', updatedAt: '2026-09-20T00:00:00.000Z',
      userId: 'user_A', isDeleted: false, visibility: 'private',
    });
    state.rows.friendships.set('friend_1', { id: 'friend_1', userId: 'user_A', isDeleted: false });
    state.rows.messages.set('msg_1', { id: 'msg_1', userId: 'user_A', isDeleted: false });
    const file = jsonBackup();

    const result = await restoreUserData(file, currentUser, { mode: 'replace' });

    expect(state.rows.tasks.get('task_extra')?.isDeleted).toBe(true);
    expect(state.rows.friendships.get('friend_1')?.isDeleted).toBe(false);
    expect(state.rows.messages.get('msg_1')?.isDeleted).toBe(false);
    expect(result.tombstoned).toBe(1);
    expect(state.exportUserData).toHaveBeenCalledWith(currentUser, expect.objectContaining({ includeImages: false }));
    expect(state.triggerDownload).toHaveBeenCalledOnce();
  });
});
