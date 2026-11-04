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
  it('refuses migration when the existing private report table is absent', async () => {
    const request = vi.fn().mockRejectedValue(Object.assign(new Error('Missing'), { status: 404 }));
    await expect(migrateFeedbackEmailBackend({ request })).rejects.toThrow(/must exist/);
    expect(request).not.toHaveBeenCalledWith('POST', expect.anything(), expect.anything());
  });
});
