import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  rows: new Map<string, Record<string, unknown>>(),
  upsert: vi.fn(),
  refreshSync: vi.fn(),
  initializeSync: vi.fn(),
  ensureRestoredImage: vi.fn(),
  getCurrentUserId: vi.fn(),
}));

vi.mock('../../src/db/database', () => ({
  getDatabase: () => ({
    tasks: {
      findOne: (id: string) => ({ exec: async () => {
        const row = state.rows.get(id);
        return row
          ? { toJSON: () => ({ ...row }), incrementalPatch: vi.fn() }
          : null;
      } }),
      find: () => ({ exec: async () => [] }),
    },
    categories: { findOne: () => ({ exec: async () => null }), find: () => ({ exec: async () => [] }) },
    diary: { findOne: () => ({ exec: async () => null }), find: () => ({ exec: async () => [] }) },
    settings: { findOne: () => ({ exec: async () => null }), find: () => ({ exec: async () => [] }) },
  }),
}));

vi.mock('../../src/lib/localUpsert', () => ({
  upsertLocalDoc: state.upsert,
}));

vi.mock('../../src/db/sync', () => ({
  refreshSync: state.refreshSync,
  initializeSync: state.initializeSync,
}));

vi.mock('../../src/lib/exportData', () => ({
  exportUserData: vi.fn(),
  triggerDownload: vi.fn(),
}));

vi.mock('../../src/lib/storage', () => ({
  ensureRestoredImage: state.ensureRestoredImage,
  getCurrentUserId: state.getCurrentUserId,
}));

import { restoreUserData } from '../../src/lib/restoreData';

const currentUser = { id: 'user_A', email: 'a@example.com', name: 'A' };

function makeBackup() {
  return new File([
    JSON.stringify({
      format: 'mosaic-user-backup',
      app: { name: 'Mosaic', version: 'test' },
      version: 2,
      exportedAt: '2026-09-20T12:00:00.000Z',
      user: { id: 'source_user', email: 'source@example.com', name: 'Source' },
      data: {
        tasks: [{
          id: 'source_task',
          title: 'Photo task',
          completed: false,
          categoryId: '',
          date: '2026-09-20',
          memo: '',
          tags: '',
          image: 'source_image',
          createdAt: '2026-09-20T00:00:00.000Z',
          updatedAt: '2026-09-20T00:00:00.000Z',
          userId: 'source_user',
          isDeleted: false,
          visibility: 'private',
        }],
        categories: [],
        diary: [],
        settings: [],
        friendships: [],
      },
      images: {
        included: false,
        referenced: ['source_image'],
        missingImages: ['source_image'],
        note: 'No image blobs.',
      },
    }),
  ], 'backup.json', { type: 'application/json' });
}

describe('backup restore image references', () => {
  beforeEach(() => {
    state.rows.clear();
    vi.clearAllMocks();
    state.refreshSync.mockResolvedValue({
      status: { isSyncing: false, lastSync: new Date().toISOString(), errors: [] },
      startedAt: Date.now() - 1,
    });
    state.initializeSync.mockResolvedValue(undefined);
    state.getCurrentUserId.mockResolvedValue('user_A');
    state.upsert.mockImplementation(async (_collection: string, id: string, doc: Record<string, unknown>) => {
      state.rows.set(id, { ...doc });
    });
    state.ensureRestoredImage.mockResolvedValue({ fileId: 'img_restored', uploaded: true });
  });

  it('preserves a cross-account task image reference when the backup omits image bytes', async () => {
    await restoreUserData(makeBackup(), currentUser, { mode: 'merge' });

    const task = Array.from(state.rows.values())[0];
    expect(task.image).toBe('source_image');
    expect(state.ensureRestoredImage).not.toHaveBeenCalled();
  });
});
