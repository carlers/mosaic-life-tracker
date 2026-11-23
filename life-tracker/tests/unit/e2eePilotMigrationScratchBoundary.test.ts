import { describe, expect, it, vi } from 'vitest';
import { MOSAIC_TABLES } from '../../infrastructure/mosaic-backend.mjs';
import { migrateE2eeDiaryPilotBackend } from '../../scripts/migrate-e2ee-pilot.mjs';

const scratch = '6b00671500279e901846';
const tables = ['private_diary_ciphertexts', 'account_crypto_envelopes'];
function expected(id: string) {
  const table = MOSAIC_TABLES.find((entry: {id: string}) => entry.id === id);
  if (!table) throw new Error('Missing E2EE manifest');
  return { ...table, $id: id, enabled: true };
}

describe('synthetic Diary ciphertext migration: isolated Scratch with proven readback', () => {
  it('rejects normal Preview, TEST, Production and arbitrary projects without requests', async () => {
    const request = vi.fn();
    for (const projectId of [
      '6ae94a2100014d01f5ed', '6ae1bf2e00034572451b',
      '6ae9599c002ab812f9c3', 'other', '',
    ]) {
      await expect(migrateE2eeDiaryPilotBackend({ projectId, request }))
        .rejects.toThrow('exact Oracle Scratch');
    }
    expect(request).not.toHaveBeenCalled();
  });

  it('creates only separate tables and independently verifies each full schema', async () => {
    const created = new Set<string>();
    const request = vi.fn(async (method: string, path: string, body?: {tableId: string}) => {
      if (method === 'GET') {
        const id = path.split('/').pop()!;
        if (!created.has(id)) throw { status: 404 };
        return expected(id);
      }
      if (method === 'POST' && body) {
        created.add(body.tableId);
        return { $id: body.tableId };
      }
      throw new Error('Unsupported migration request');
    });
    const result = await migrateE2eeDiaryPilotBackend({ projectId: scratch, request });
    expect(result).toEqual(tables.map(id => ({ id, created: true })));
    expect(request.mock.calls.map(call => call[0]))
      .toEqual(['GET','POST','GET','GET','POST','GET']);
    for (const call of request.mock.calls.filter(call => call[0] === 'POST')) {
      expect(call[2]).toMatchObject({ rowSecurity: true, enabled: true, permissions: [] });
      expect(call[2]?.tableId).toMatch(/^(private_diary_ciphertexts|account_crypto_envelopes)$/);
    }
  });

  it('refuses unavailable or insecure post-create readback', async () => {
    const missing = vi.fn()
      .mockRejectedValueOnce({ status: 404 }).mockResolvedValueOnce({})
      .mockRejectedValueOnce({ status: 404 });
    await expect(migrateE2eeDiaryPilotBackend({ projectId: scratch, request: missing }))
      .rejects.toThrow('post-create readback unavailable');
    expect(missing).toHaveBeenCalledTimes(3);

    const insecure = vi.fn()
      .mockRejectedValueOnce({ status: 404 }).mockResolvedValueOnce({})
      .mockResolvedValueOnce({ ...expected(tables[0]), permissions: ['create("users")'] });
    await expect(migrateE2eeDiaryPilotBackend({ projectId: scratch, request: insecure }))
      .rejects.toThrow('permission drift');
    expect(insecure).toHaveBeenCalledTimes(3);
  });

  it('rejects redacted ACL, disabled table, extra columns/indexes and broad permissions', async () => {
    const original = expected(tables[0]);
    for (const row of [
      { ...original, permissions: undefined },
      { ...original, enabled: undefined },
      { ...original, rowSecurity: false },
      { ...original, permissions: ['read("users")'] },
      { ...original, columns: [...original.columns, { key: 'plain_title', type: 'string', required: true }] },
      { ...original, indexes: [...original.indexes, { key: 'unsafe', type: 'key', attributes: ['user_id'] }] },
    ]) {
      const request = vi.fn(async () => row);
      await expect(migrateE2eeDiaryPilotBackend({
        projectId: scratch, request,
      })).rejects.toThrow('drift');
      expect(request).toHaveBeenCalledOnce();
    }
  });

  it('read-verifies existing schema without backend mutations', async () => {
    const request = vi.fn(async (_method: string, path: string) => expected(path.split('/').pop()!));
    await expect(migrateE2eeDiaryPilotBackend({ projectId: scratch, request }))
      .resolves.toEqual(tables.map(id => ({ id, created: false })));
    expect(request.mock.calls.every(call => call[0] === 'GET')).toBe(true);
  });
});
