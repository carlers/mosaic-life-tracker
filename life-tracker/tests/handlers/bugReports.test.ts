import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { invoke, makeMockDb } from '../helpers/invoke-handler';

const require = createRequire(import.meta.url);
const reports = require('../../appwrite-functions/message-action/bug-reports.js');
const requestId = 'a'.repeat(32);
const payload = {
  action: 'submit_bug_report', requestId, title: 'Task not visible',
  description: 'It disappears from the calendar', steps: 'Create a task and sync',
};
function missing() { return Object.assign(new Error('Missing'), { code: 404 }); }

describe('private bug report submission', () => {
  it('derives safe IDs from the authenticated caller, not untrusted browser fields', async () => {
    const db = makeMockDb();
    db.getRow.mockRejectedValue(missing());
    db.listRows.mockResolvedValue({ rows: [] });
    const response = await invoke({ userId: 'alice', mockDb: db, body: payload });
    expect(response.status).toBe(201);
    const call = db.createRow.mock.calls[0][0];
    expect(call.rowId).toMatch(/^bug_[a-f0-9]{32}$/);
    expect(call.rowId).toHaveLength(36);
    expect(call.data.user_id).toBe('alice');
    expect(call.data.description).toBe(payload.description);
    expect(call.data.diagnostics).toBe('');
    expect(call.permissions).toEqual([]);
    expect(reports.reportId('alice', requestId)).not.toBe(reports.reportId('bob', requestId));
  });

  it('rejects fake owner IDs, malformed or excessive content, and unknown diagnostic keys', async () => {
    for (const change of [
      { userId: 'bob' }, { title: ' ' },
      { description: 'x'.repeat(3001) }, { requestId: 'unsafe' },
      { diagnostics: { fullUrl: 'https://secret/' } },
      { diagnostics: { browser: 'Chrome', os: 'Android', build: 'https://private/' } },
    ]) {
      const db = makeMockDb();
      const response = await invoke({ userId: 'alice', mockDb: db, body: { ...payload, ...change } });
      expect(response.status).toBe(400);
      expect(db.createRow).not.toHaveBeenCalled();
    }
  });

  it('returns the same reference for exact retries and blocks conflicting replays', async () => {
    const db = makeMockDb();
    const stored = { $id: reports.reportId('alice', requestId), user_id: 'alice',
      body_hash: require('node:crypto').createHash('sha256')
        .update(JSON.stringify(reports.normalizeReport(payload))).digest('hex') };
    db.getRow.mockResolvedValue(stored);
    const accepted = await invoke({ userId: 'alice', mockDb: db, body: payload });
    expect(accepted.status).toBe(200);
    expect(accepted.body).toMatchObject({ reportId: stored.$id, duplicate: true });
    const changed = await invoke({ userId: 'alice', mockDb: db,
      body: { ...payload, description: 'Different private report' } });
    expect(changed.status).toBe(409);
    expect(db.createRow).not.toHaveBeenCalled();
  });

  it('deduplicates an atomic-create race after the same request reaches the Function twice', async () => {
    const db = makeMockDb();
    const digest = require('node:crypto').createHash('sha256')
      .update(JSON.stringify(reports.normalizeReport(payload))).digest('hex');
    db.getRow.mockRejectedValueOnce(missing()).mockResolvedValueOnce({
      user_id: 'alice', body_hash: digest,
    });
    db.listRows.mockResolvedValue({ rows: [] });
    db.createRow.mockRejectedValue(Object.assign(new Error('Conflict'), { code: 409 }));
    const response = await invoke({ userId: 'alice', mockDb: db, body: payload });
    expect(response.status).toBe(200);
    expect(response.body.duplicate).toBe(true);
  });

  it('limits high-volume submissions per authenticated account', async () => {
    const db = makeMockDb();
    db.getRow.mockRejectedValue(missing());
    const now = new Date().toISOString();
    db.listRows.mockResolvedValue({ rows: Array.from({ length: 5 }, () => ({ created_at: now })) });
    const response = await invoke({ userId: 'alice', mockDb: db, body: payload });
    expect(response.status).toBe(429);
    expect(db.createRow).not.toHaveBeenCalled();
  });

  it('does not expose a report when the caller is unauthenticated', async () => {
    const db = makeMockDb();
    const response = await invoke({ userId: '', mockDb: db, body: payload });
    expect(response.status).toBe(401);
    expect(db.createRow).not.toHaveBeenCalled();
  });

  it('expires reports in bounded maintenance without touching task rows', async () => {
    const db = makeMockDb();
    db.listRows.mockResolvedValue({ rows: [{ $id: 'bug_expired' }] });
    const deleted = await reports.pruneExpiredBugReports(db, new Date('2026-10-31T00:00:00Z'));
    expect(deleted).toBe(1);
    expect(db.deleteRow).toHaveBeenCalledWith({
      databaseId: 'life_tracker', tableId: 'bug_reports', rowId: 'bug_expired',
    });
  });
});
