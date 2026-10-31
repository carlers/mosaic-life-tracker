import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeSettingsRowId } from '../../src/lib/settingsRowId';

const { getDatabaseMock, upsertMock } = vi.hoisted(() => ({
  getDatabaseMock: vi.fn(),
  upsertMock: vi.fn(),
}));

vi.mock('../../src/db/database', () => ({
  getDatabase: getDatabaseMock,
}));
vi.mock('../../src/lib/localUpsert', () => ({
  upsertLocalDoc: upsertMock,
}));

import { migrateOversizedSettingsRows } from '../../src/lib/settingsLegacyCleanup';

const userId = 'user_A';
const key = 'veryLongPreferenceNameForLegacyRows';
const legacyId = userId + '_' + key;

function legacyRow(overrides: Record<string, unknown> = {}) {
  return {
    id: legacyId,
    userId,
    key,
    value: 'true',
    isDeleted: false,
    updatedAt: '2026-10-29T00:00:00.000Z',
    remove: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function setRows(rows: ReturnType<typeof legacyRow>[], canonical: unknown = null) {
  const findOneMock = vi.fn().mockReturnValue({
    exec: vi.fn().mockResolvedValue(canonical),
  });
  getDatabaseMock.mockReturnValue({
    settings: {
      find: vi.fn().mockReturnValue({
        exec: vi.fn().mockResolvedValue(rows),
      }),
      findOne: findOneMock,
    },
  });
  return findOneMock;
}

beforeEach(() => {
  getDatabaseMock.mockReset();
  upsertMock.mockReset().mockResolvedValue(undefined);
});

describe('legacy settings migration before local cleanup', () => {
  it('preserves an unsynced oversized setting before removing the impossible remote ID', async () => {
    const row = legacyRow();
    const order: string[] = [];
    row.remove.mockImplementation(async () => { order.push('remove'); });
    upsertMock.mockImplementation(async () => { order.push('migrate'); });
    const findOne = setRows([row]);

    await migrateOversizedSettingsRows(userId);

    const id = makeSettingsRowId(userId, key);
    expect(id.length).toBeLessThanOrEqual(36);
    expect(findOne).toHaveBeenCalledWith(id);
    expect(upsertMock).toHaveBeenCalledWith('settings', id, {
      id,
      userId,
      key,
      value: 'true',
      isDeleted: false,
      updatedAt: row.updatedAt,
    });
    expect(order).toEqual(['migrate', 'remove']);
  });

  it('retains a more recent canonical setting instead of overwriting it', async () => {
    const row = legacyRow();
    setRows([row], {
      id: makeSettingsRowId(userId, key),
      userId,
      key,
      updatedAt: '2026-10-30T00:00:00.000Z',
    });

    await migrateOversizedSettingsRows(userId);

    expect(upsertMock).not.toHaveBeenCalled();
    expect(row.remove).toHaveBeenCalledOnce();
  });

  it('upgrades an older canonical value without changing its owner or key', async () => {
    const row = legacyRow();
    setRows([row], {
      id: makeSettingsRowId(userId, key),
      userId,
      key,
      updatedAt: '2026-10-28T00:00:00.000Z',
    });

    await migrateOversizedSettingsRows(userId);

    expect(upsertMock).toHaveBeenCalledOnce();
    expect(row.remove).toHaveBeenCalledOnce();
  });

  it('does not erase a legacy setting when its canonical write fails', async () => {
    const row = legacyRow();
    setRows([row]);
    upsertMock.mockRejectedValue(new Error('storage unavailable'));

    await expect(migrateOversizedSettingsRows(userId)).rejects.toThrow('storage unavailable');
    expect(row.remove).not.toHaveBeenCalled();
  });

  it('fails closed on a mismatched owner or canonical hash collision', async () => {
    const foreign = legacyRow({ userId: 'other' });
    setRows([foreign]);
    await expect(migrateOversizedSettingsRows(userId)).rejects.toThrow('owner mismatch');
    expect(foreign.remove).not.toHaveBeenCalled();

    const colliding = legacyRow();
    setRows([colliding], {
      id: makeSettingsRowId(userId, key),
      userId: 'other',
      key,
    });
    await expect(migrateOversizedSettingsRows(userId)).rejects.toThrow('ID collision');
    expect(colliding.remove).not.toHaveBeenCalled();
    expect(upsertMock).not.toHaveBeenCalled();
  });
});
