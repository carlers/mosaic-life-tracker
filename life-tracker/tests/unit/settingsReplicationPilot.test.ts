import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { firstValueFrom } from 'rxjs';

const getChangedDocumentsSinceMock = vi.hoisted(() => vi.fn());
const replicateRxCollectionMock = vi.hoisted(() => vi.fn());
const listRowsMock = vi.hoisted(() => vi.fn());
const getRowMock = vi.hoisted(() => vi.fn());
const updateRowMock = vi.hoisted(() => vi.fn());
const createRowMock = vi.hoisted(() => vi.fn());
const realtimeSubscribeMock = vi.hoisted(() => vi.fn());
const reSyncMock = vi.hoisted(() => vi.fn());
const cancelMock = vi.hoisted(() => vi.fn());
const errorSubscribeMock = vi.hoisted(() => vi.fn());
const uploadPendingImageMock = vi.hoisted(() => vi.fn());
const makeProfileImageReadableMock = vi.hoisted(() => vi.fn());
const deletePendingImageMock = vi.hoisted(() => vi.fn());
const updateProfileAvatarMock = vi.hoisted(() => vi.fn());

vi.mock('rxdb', () => ({
  getChangedDocumentsSince: getChangedDocumentsSinceMock,
}));

vi.mock('rxdb/plugins/replication', () => ({
  replicateRxCollection: replicateRxCollectionMock,
}));

vi.mock('appwrite', () => ({
  Query: {
    equal: (key: string, value: unknown) =>
      JSON.stringify({ op: 'equal', key, value }),
    greaterThan: (key: string, value: unknown) =>
      JSON.stringify({ op: 'greaterThan', key, value }),
    and: (queries: string[]) =>
      JSON.stringify({ op: 'and', queries }),
    or: (queries: string[]) =>
      JSON.stringify({ op: 'or', queries }),
    orderAsc: (field: string) =>
      JSON.stringify({ op: 'orderAsc', field }),
    limit: (value: number) =>
      JSON.stringify({ op: 'limit', value }),
  },
  Permission: {
    read: (role: string) => `read(${role})`,
    update: (role: string) => `update(${role})`,
    delete: (role: string) => `delete(${role})`,
  },
  Role: {
    user: (id: string) => `user:${id}`,
  },
}));

vi.mock('../../src/lib/sdk', () => ({
  guardedTablesDB: {
    listRows: listRowsMock,
    getRow: getRowMock,
    updateRow: updateRowMock,
    createRow: createRowMock,
  },
  guardedRealtime: {
    subscribe: realtimeSubscribeMock,
  },
}));

vi.mock('../../src/lib/storage', () => ({
  uploadPendingImage: uploadPendingImageMock,
  makeProfileImageReadable: makeProfileImageReadableMock,
}));

vi.mock('../../src/lib/pendingImages', () => ({
  isPendingImageId: (fileId: string) => fileId.startsWith('localimg_'),
  deletePendingImage: deletePendingImageMock,
}));

vi.mock('../../src/lib/social', () => ({
  updateProfileAvatar: updateProfileAvatarMock,
}));

import {
  __settingsReplicationPilotTestUtils,
  captureSettingsReplicationPushCheckpoint,
  startSettingsReplicationPilot,
  stopSettingsReplicationPilot,
} from '../../src/db/settingsReplicationPilot';

function localSetting(overrides: Record<string, unknown> = {}) {
  return {
    id: 'setting_a',
    userId: 'user_A',
    key: 'theme',
    value: 'dark',
    isDeleted: false,
    updatedAt: '2026-10-02T00:00:00.000Z',
    _deleted: false,
    ...overrides,
  };
}

function remoteSetting(overrides: Record<string, unknown> = {}) {
  return {
    $id: 'setting_a',
    $updatedAt: '2026-10-02T00:00:01.000Z',
    user_id: 'user_A',
    key: 'theme',
    value: 'dark',
    deleted: false,
    updated_at: '2026-10-02T00:00:00.000Z',
    ...overrides,
  };
}

function collectionFixture() {
  return { storageInstance: {} } as never;
}

beforeEach(async () => {
  await stopSettingsReplicationPilot();
  vi.clearAllMocks();
  getChangedDocumentsSinceMock.mockResolvedValue({
    documents: [],
    checkpoint: { id: 'setting_z', lwt: 123 },
  });
  listRowsMock.mockResolvedValue({ rows: [] });
  getRowMock.mockResolvedValue(remoteSetting());
  updateRowMock.mockResolvedValue({});
  createRowMock.mockResolvedValue({});
  uploadPendingImageMock.mockResolvedValue('img_uploaded');
  makeProfileImageReadableMock.mockResolvedValue(undefined);
  deletePendingImageMock.mockResolvedValue(undefined);
  updateProfileAvatarMock.mockResolvedValue(undefined);
  cancelMock.mockResolvedValue(true);
  errorSubscribeMock.mockReturnValue({ unsubscribe: vi.fn() });
  realtimeSubscribeMock.mockReturnValue(vi.fn());
  replicateRxCollectionMock.mockReturnValue({
    reSync: reSyncMock,
    cancel: cancelMock,
    error$: { subscribe: errorSubscribeMock },
  });
});

afterEach(async () => {
  await stopSettingsReplicationPilot();
});

describe('settings RxDB replication pilot', () => {
  it('captures the current local checkpoint for the pre-bootstrap seed', async () => {
    const checkpoint = await captureSettingsReplicationPushCheckpoint(
      collectionFixture()
    );

    expect(getChangedDocumentsSinceMock).toHaveBeenCalledWith(
      {},
      200,
      undefined
    );
    expect(checkpoint).toEqual({
      id: 'setting_z',
      lwt: 123,
    });
  });

  it('starts from the caller-supplied pre-bootstrap checkpoint without rescanning', async () => {
    const checkpoint = { id: 'setting_seed', lwt: 77 };

    await startSettingsReplicationPilot(
      'user_A',
      collectionFixture(),
      checkpoint
    );

    expect(getChangedDocumentsSinceMock).not.toHaveBeenCalled();
    const options = replicateRxCollectionMock.mock.calls[0][0];
    expect(options.push.initialCheckpoint).toEqual(checkpoint);
    expect(options.waitForLeadership).toBe(true);
    expect(options.live).toBe(true);
  });

  it('pulls with an owner-scoped updatedAt+id tuple checkpoint', async () => {
    listRowsMock.mockResolvedValue({
      rows: [
        remoteSetting({
          $id: 'setting_b',
          $updatedAt: '2026-10-02T00:00:02.000Z',
          deleted: true,
        }),
      ],
    });

    const result =
      await __settingsReplicationPilotTestUtils.pullSettings(
        'user_A',
        {
          id: 'setting_a',
          updatedAt: '2026-10-02T00:00:01.000Z',
        },
        100
      );

    const queries = listRowsMock.mock.calls[0][0].queries.map(
      (query: string) => JSON.parse(query)
    );
    expect(queries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          op: 'equal',
          key: 'user_id',
          value: 'user_A',
        }),
        expect.objectContaining({ op: 'or' }),
        expect.objectContaining({
          op: 'orderAsc',
          field: '$updatedAt',
        }),
        expect.objectContaining({
          op: 'orderAsc',
          field: '$id',
        }),
      ])
    );
    expect(result.checkpoint).toEqual({
      id: 'setting_b',
      updatedAt: '2026-10-02T00:00:02.000Z',
    });
    expect(result.documents[0]).toEqual(
      expect.objectContaining({
        id: 'setting_b',
        userId: 'user_A',
        isDeleted: true,
        _deleted: false,
      })
    );
  });

  it('creates a missing remote row with createRow', async () => {
    getRowMock.mockRejectedValue(
      Object.assign(new Error('not found'), { code: 404 })
    );

    await __settingsReplicationPilotTestUtils.pushSettings(
      [{ newDocumentState: localSetting() }],
      'user_A'
    );

    expect(createRowMock).toHaveBeenCalledWith(
      expect.objectContaining({
        rowId: 'setting_a',
        data: expect.objectContaining({
          user_id: 'user_A',
          deleted: false,
        }),
      })
    );
    expect(updateRowMock).not.toHaveBeenCalled();
  });

  it('returns the current master as a conflict instead of overwriting it', async () => {
    getRowMock.mockResolvedValue(
      remoteSetting({ value: 'server' })
    );

    const conflicts =
      await __settingsReplicationPilotTestUtils.pushSettings(
        [
          {
            assumedMasterState: localSetting({ value: 'old' }),
            newDocumentState: localSetting({ value: 'local' }),
          },
        ],
        'user_A'
      );

    expect(updateRowMock).not.toHaveBeenCalled();
    expect(conflicts).toEqual([
      expect.objectContaining({
        id: 'setting_a',
        value: 'server',
        _deleted: false,
      }),
    ]);
  });

  it('falls back from update 404 to strict createRow', async () => {
    updateRowMock.mockRejectedValue(
      Object.assign(new Error('not found'), { code: 404 })
    );
    const state = localSetting();

    const conflicts =
      await __settingsReplicationPilotTestUtils.pushSettings(
        [{ assumedMasterState: state, newDocumentState: state }],
        'user_A'
      );

    expect(conflicts).toEqual([]);
    expect(updateRowMock).toHaveBeenCalledTimes(1);
    expect(createRowMock).toHaveBeenCalledTimes(1);
  });

  it('uploads pending profile images and returns the stored master state', async () => {
    const pending = localSetting({
      key: 'profileImageId',
      value: 'localimg_abc',
    });
    getRowMock.mockResolvedValue(
      remoteSetting({
        key: 'profileImageId',
        value: 'img_old',
      })
    );

    const conflicts =
      await __settingsReplicationPilotTestUtils.pushSettings(
        [
          {
            assumedMasterState: localSetting({
              key: 'profileImageId',
              value: 'img_old',
            }),
            newDocumentState: pending,
          },
        ],
        'user_A'
      );

    expect(uploadPendingImageMock).toHaveBeenCalledWith(
      'localimg_abc',
      'user_A'
    );
    expect(makeProfileImageReadableMock).toHaveBeenCalledWith(
      'img_uploaded',
      'user_A'
    );
    expect(updateRowMock).toHaveBeenCalledWith(
      expect.objectContaining({
        rowId: 'setting_a',
        data: expect.objectContaining({
          key: 'profileImageId',
          value: 'img_uploaded',
        }),
      })
    );
    expect(updateProfileAvatarMock).toHaveBeenCalledWith(
      'user_A',
      'img_uploaded'
    );
    expect(deletePendingImageMock).toHaveBeenCalledWith(
      'localimg_abc',
      'user_A'
    );
    expect(conflicts).toEqual([
      expect.objectContaining({
        value: 'img_uploaded',
        _deleted: false,
      }),
    ]);
  });

  it('repairs the profile side effect when a prior setting write already reached master', async () => {
    getRowMock.mockResolvedValue(
      remoteSetting({
        key: 'profileImageId',
        value: 'img_uploaded',
      })
    );

    const conflicts =
      await __settingsReplicationPilotTestUtils.pushSettings(
        [
          {
            assumedMasterState: localSetting({
              key: 'profileImageId',
              value: 'img_old',
            }),
            newDocumentState: localSetting({
              key: 'profileImageId',
              value: 'localimg_abc',
            }),
          },
        ],
        'user_A'
      );

    expect(updateRowMock).not.toHaveBeenCalled();
    expect(uploadPendingImageMock).not.toHaveBeenCalled();
    expect(updateProfileAvatarMock).toHaveBeenCalledWith(
      'user_A',
      'img_uploaded'
    );
    expect(deletePendingImageMock).toHaveBeenCalledWith(
      'localimg_abc',
      'user_A'
    );
    expect(conflicts).toEqual([
      expect.objectContaining({
        value: 'img_uploaded',
      }),
    ]);
  });

  it('keeps the pending avatar available when the profile side effect fails', async () => {
    const pending = localSetting({
      key: 'profileImageId',
      value: 'localimg_abc',
    });
    getRowMock.mockResolvedValue(
      remoteSetting({
        key: 'profileImageId',
        value: 'img_old',
      })
    );
    updateProfileAvatarMock.mockRejectedValueOnce(
      new Error('profile write failed')
    );

    await expect(
      __settingsReplicationPilotTestUtils.pushSettings(
        [
          {
            assumedMasterState: localSetting({
              key: 'profileImageId',
              value: 'img_old',
            }),
            newDocumentState: pending,
          },
        ],
        'user_A'
      )
    ).rejects.toThrow('profile write failed');

    expect(updateRowMock).toHaveBeenCalledTimes(1);
    expect(deletePendingImageMock).not.toHaveBeenCalled();
  });

  it('streams owner-scoped Appwrite realtime updates into replication', async () => {
    await startSettingsReplicationPilot(
      'user_A',
      collectionFixture(),
      { id: 'setting_seed', lwt: 77 }
    );
    const options = replicateRxCollectionMock.mock.calls[0][0];
    const next = firstValueFrom(options.pull.stream$);
    const callback = realtimeSubscribeMock.mock.calls[0][1];

    callback({
      events: [
        'databases.life_tracker.tables.settings.rows.setting_a.update',
      ],
      channels: [],
      timestamp: '',
      payload: remoteSetting(),
    });

    await expect(next).resolves.toEqual({
      checkpoint: {
        id: 'setting_a',
        updatedAt: '2026-10-02T00:00:01.000Z',
      },
      documents: [
        expect.objectContaining({
          id: 'setting_a',
          userId: 'user_A',
          _deleted: false,
        }),
      ],
    });
  });
});
