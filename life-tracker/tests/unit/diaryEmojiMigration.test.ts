import { describe, expect, it, vi } from 'vitest';
import { migrateDiaryEmojiBackend } from '../../scripts/migrate-diary-emoji.mjs';
import { MOSAIC_TABLES } from '../../infrastructure/mosaic-backend.mjs';

const column = MOSAIC_TABLES.find(table => table.id === 'diary')!.columns.find((item: any) => item.key === 'emoji')!;

describe('optional diary emoji backend migration', () => {
  it('creates an optional column exactly once', async () => {
    let state: any = null;
    const request = vi.fn(async (method: string, path: string, body?: any) => {
      if (method === 'GET' && path.endsWith('/tables/diary')) return { $id: 'diary' };
      if (method === 'GET' && path.endsWith('/columns/emoji')) {
        if (state) return state;
        throw Object.assign(new Error('missing'), { status: 404 });
      }
      if (method === 'POST' && path.endsWith('/columns/varchar')) {
        state = { ...column, ...body, status: 'available' };
        return state;
      }
      throw new Error('Unexpected request');
    });
    await expect(migrateDiaryEmojiBackend({ request })).resolves.toMatchObject({ column: 'emoji', created: true });
    await expect(migrateDiaryEmojiBackend({ request })).resolves.toMatchObject({ column: 'emoji', created: false });
    expect(request.mock.calls.filter(c => c[0] === 'POST')).toHaveLength(1);
    expect(state).toMatchObject({ size: 32, required: false, default: '' });
  });
  it('fails closed on drift', async () => {
    const request = vi.fn(async (_method: string, path: string) => (
      path.endsWith('/tables/diary') ? { $id: 'diary' } : { ...column, size: 3, status: 'available' }
    ));
    await expect(migrateDiaryEmojiBackend({ request })).rejects.toThrow(/Incompatible/i);
  });
});
