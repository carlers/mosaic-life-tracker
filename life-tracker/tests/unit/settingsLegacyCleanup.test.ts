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

import { ensureOversizedSettingsRowsMigrated, migrateOversizedSettingsRows } from '../../src/lib/settingsLegacyCleanup';

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
  it('shares one migration between the Settings UI and sync startup', async () => {
    const row = legacyRow();
    setRows([row]);
    let completeWrite!: () => void;
    upsertMock.mockImplementationOnce(
      () => new Promise<void>((resolve) => { completeWrite = resolve; })
    );
    const fromUi = ensureOversizedSettingsRowsMigrated(userId);
    const fromPilot = ensureOversizedSettingsRowsMigrated(userId);
    expect(fromPilot).toBe(fromUi);
    await vi.waitFor(() => expect(upsertMock).toHaveBeenCalledOnce());
    completeWrite();
    await Promise.all([fromUi, fromPilot]);
    expect(row.remove).toHaveBeenCalledOnce();
    expect(upsertMock).toHaveBeenCalledOnce();
  });

  it('retries a failed preflight without removing the only local value', async () => {
    const row = legacyRow();
    setRows([row]);
    upsertMock.mockRejectedValueOnce(new Error('disk error'));
    await expect(ensureOversizedSettingsRowsMigrated(userId)).rejects.toThrow('disk error');
    expect(row.remove).not.toHaveBeenCalled();
    await ensureOversizedSettingsRowsMigrated(userId);
    expect(row.remove).toHaveBeenCalledOnce();
  });

  it('migrates short illegal-character row IDs without losing the original preference', async () => {
    const key = 'uiColor:icons';
    const invalidId = userId + '_' + key;
    expect(invalidId.length).toBeLessThanOrEqual(36);
    const row = legacyRow({ id: invalidId, key, value: '#0fa' });
    const lookup = setRows([row]);

    await migrateOversizedSettingsRows(userId);

    const canonicalId = makeSettingsRowId(userId, key);
    expect(canonicalId).toMatch(/^s_[a-z0-9]+$/);
    expect(lookup).toHaveBeenCalledWith(canonicalId);
    expect(upsertMock).toHaveBeenCalledWith('settings', canonicalId, {
      id: canonicalId,
      userId,
      key,
      value: '#0fa',
      isDeleted: false,
      updatedAt: row.updatedAt,
    });
    expect(row.remove).toHaveBeenCalledOnce();
  });

  it('retains the invalid-character local row when the canonical write fails', async () => {
    const row = legacyRow({ id: userId + '_uiColor:icons', key: 'uiColor:icons' });
    setRows([row]);
    upsertMock.mockRejectedValueOnce(new Error('local write failed'));
    await expect(migrateOversizedSettingsRows(userId)).rejects.toThrow('local write failed');
    expect(row.remove).not.toHaveBeenCalled();
  });

  it('does not erase Appwrite-compatible legacy IDs containing a period or hyphen', async () => {
    const dash = legacyRow({ id: userId + '_color-role', key: 'color-role' });
    const dot = legacyRow({ id: userId + '_color.role', key: 'color.role' });
    setRows([dash, dot]);
    await migrateOversizedSettingsRows(userId);
    expect(upsertMock).not.toHaveBeenCalled();
    expect(dash.remove).not.toHaveBeenCalled();
    expect(dot.remove).not.toHaveBeenCalled();
  });

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
