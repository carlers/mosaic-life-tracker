import { describe, expect, it, vi } from 'vitest';
import { migrateFeedbackEmailBackend } from '../../scripts/migrate-feedback-email.mjs';
import { MOSAIC_TABLES } from '../../infrastructure/mosaic-backend.mjs';

describe('private feedback delivery migration', () => {
  it('defines server-private email queue with bug report default', () => {
    const table = MOSAIC_TABLES.find(t => t.id === 'bug_reports');
    expect(table?.permissions).toEqual([]);
    expect(table?.rowSecurity).toBe(true);
    expect(table?.columns.find(c => c.key === 'report_kind')?.default).toBe('bug');
    expect(table?.indexes.some(idx => idx.key === 'idx_bug_feedback_queue')).toBe(true);
  });
  it('resumes after nine columns exist, creates the index with the Appwrite columns parameter, and reruns idempotently', async () => {
    const table = MOSAIC_TABLES.find(item => item.id === 'bug_reports')!;
    const base = '/tablesdb/life_tracker/tables/bug_reports';
    const index = table.indexes.find(item => item.key === 'idx_bug_feedback_queue')!;
    let existingIndex: Record<string, unknown> | null = null;
    const notFound = () => Object.assign(new Error('Missing'), { status: 404 });
    const request = vi.fn(async (method: string, path: string, data?: Record<string, unknown>) => {
      if (method === 'GET' && path === base) return { $id: 'bug_reports' };
      if (method === 'GET' && path.startsWith(base + '/columns/')) {
        const key = path.slice((base + '/columns/').length);
        const expected = table.columns.find(column => column.key === key);
        if (!expected) throw notFound();
        return { ...expected, status: 'available' };
      }
      if (method === 'GET' && path === base + '/indexes/' + index.key) {
        if (!existingIndex) throw notFound();
        return existingIndex;
      }
      if (method === 'POST' && path === base + '/indexes') {
        expect(data).toEqual({
          key: index.key, type: index.type, columns: index.attributes,
        });
        expect(data).not.toHaveProperty('attributes');
        existingIndex = { ...data, status: 'available' };
        return existingIndex;
      }
      throw new Error('Unexpected migration request: ' + method + ' ' + path);
    });
    const sleep = vi.fn();
    await expect(migrateFeedbackEmailBackend({ request, sleep })).resolves.toEqual({ applied: true });
    await expect(migrateFeedbackEmailBackend({ request, sleep })).resolves.toEqual({ applied: true });
    expect(request.mock.calls.filter(([method]) => method === 'POST')).toHaveLength(1);
    expect(sleep).not.toHaveBeenCalled();
  });
  it('rejects an existing index with the wrong columns instead of concealing schema drift', async () => {
    const table = MOSAIC_TABLES.find(item => item.id === 'bug_reports')!;
    const base = '/tablesdb/life_tracker/tables/bug_reports';
    const index = table.indexes.find(item => item.key === 'idx_bug_feedback_queue')!;
    const request = vi.fn(async (method: string, path: string) => {
      if (method === 'GET' && path === base) return { $id: 'bug_reports' };
      if (method === 'GET' && path.startsWith(base + '/columns/')) {
        const key = path.slice((base + '/columns/').length);
        return { ...table.columns.find(column => column.key === key), status: 'available' };
      }
      if (method === 'GET' && path === base + '/indexes/' + index.key)
        return { key: index.key, type: index.type, columns: ['created_at'], status: 'available' };
      throw new Error('Unexpected request');
    });
    await expect(migrateFeedbackEmailBackend({ request, sleep: vi.fn() }))
      .rejects.toThrow(/does not match the Mosaic manifest/);
    expect(request).not.toHaveBeenCalledWith('POST', expect.anything(), expect.anything());
  });
  it('refuses migration when the existing private report table is absent', async () => {
    const request = vi.fn().mockRejectedValue(Object.assign(new Error('Missing'), { status: 404 }));
    await expect(migrateFeedbackEmailBackend({ request })).rejects.toThrow(/must exist/);
    expect(request).not.toHaveBeenCalledWith('POST', expect.anything(), expect.anything());
  });
});
