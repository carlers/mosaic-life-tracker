import { describe, expect, it, vi } from 'vitest';
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


describe('opt-in public GitHub issue publishing', () => {
  const publicPayload = { ...payload, action: 'publish_bug_report', publicConsent: true };
  const now = new Date('2026-11-01T00:00:00.000Z');
  const publicId = reports.reportId('alice', requestId);
  const mkResponse = (obj) => ({ ok: true, json: async () => obj });

  it('fails closed without explicit consent or server-side integration credentials', async () => {
    const db = makeMockDb();
    const invalid = await reports.handlePublishBugReport(db, 'alice', {
      ...publicPayload, publicConsent: false,
    }, { enabled: true, token: 'test', now });
    expect(invalid.status).toBe(400);
    const unavailable = await reports.handlePublishBugReport(db, 'alice', publicPayload, {
      enabled: false, token: 'test', now,
    });
    expect(unavailable.status).toBe(503);
    expect(db.createRow).not.toHaveBeenCalled();
    expect(db.listRows).not.toHaveBeenCalled();
  });

  it('publishes only consenting text and returns an exact public issue URL', async () => {
    const db = makeMockDb();
    db.getRow.mockRejectedValue(missing());
    db.listRows.mockResolvedValue({ rows: [] });
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(mkResponse([]))
      .mockResolvedValueOnce(mkResponse({
        number: 987, html_url: 'https://github.com/carlers/mosaic-life-tracker/issues/987',
      }));
    const answer = await reports.handlePublishBugReport(db, 'alice', {
      ...publicPayload, diagnostics: { os: 'Android' },
    }, { enabled: true, token: 'mock-token', now, fetchImpl });
    expect(answer.status).toBe(201);
    expect(answer.body.issueUrl).toBe('https://github.com/carlers/mosaic-life-tracker/issues/987');
    expect(db.createRow.mock.calls[0][0]).toMatchObject({
      rowId: publicId, permissions: [], data: { user_id: 'alice', github_issue_url: '' },
    });
    expect(db.updateRow.mock.calls[0][0].data).toMatchObject({
      github_issue_number: 987, github_issue_url: answer.body.issueUrl,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const published = JSON.parse(fetchImpl.mock.calls[1][1].body);
    expect(published.title).toContain('Task not visible');
    expect(published.body).toContain(payload.description);
    expect(published.body).not.toContain('alice');
    expect(published.body).not.toContain('Android');
    expect(published.body).toContain('mosaic-public-bug:' + publicId);
  });

  it('does not publish a second issue for a completed retry', async () => {
    const db = makeMockDb();
    const report = reports.normalizeReport(publicPayload);
    const digest = require('node:crypto').createHash('sha256')
      .update(JSON.stringify({ ...report, destination: 'github-public' })).digest('hex');
    db.getRow.mockResolvedValue({
      user_id: 'alice', body_hash: digest,
      github_issue_url: 'https://github.com/carlers/mosaic-life-tracker/issues/11',
    });
    const fetchImpl = vi.fn();
    const answer = await reports.handlePublishBugReport(db, 'alice', publicPayload, {
      enabled: true, token: 'mock-token', now, fetchImpl,
    });
    expect(answer).toMatchObject({ status: 200, body: { duplicate: true } });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('blocks simultaneous retries while an earlier publication is pending', async () => {
    const db = makeMockDb();
    const digest = require('node:crypto').createHash('sha256')
      .update(JSON.stringify({ ...reports.normalizeReport(publicPayload), destination: 'github-public' }))
      .digest('hex');
    db.getRow.mockResolvedValue({
      user_id: 'alice', body_hash: digest, github_issue_url: '',
      github_publish_started_at: now.toISOString(),
    });
    const fetchImpl = vi.fn();
    const answer = await reports.handlePublishBugReport(db, 'alice', publicPayload,
      { enabled: true, token: 'mock-token', now, fetchImpl });
    expect(answer.status).toBe(503);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(db.createRow).not.toHaveBeenCalled();
  });

  it('recovers an uncertain publication by finding the existing GitHub marker', async () => {
    const db = makeMockDb();
    const digest = require('node:crypto').createHash('sha256')
      .update(JSON.stringify({ ...reports.normalizeReport(publicPayload), destination: 'github-public' }))
      .digest('hex');
    db.getRow.mockResolvedValue({
      user_id: 'alice', body_hash: digest, github_issue_url: '',
      github_publish_started_at: '2026-10-31T23:00:00.000Z',
    });
    const fetchImpl = vi.fn().mockResolvedValue(mkResponse([{
      number: 12, body: '<!-- mosaic-public-bug:' + publicId + ' -->',
    }]));
    const result = await reports.handlePublishBugReport(db, 'alice', publicPayload,
      { enabled: true, token: 'mock-token', now, fetchImpl });
    expect(result.status).toBe(200);
    expect(result.body.issueUrl).toBe('https://github.com/carlers/mosaic-life-tracker/issues/12');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('retains its private reservation on GitHub network failure', async () => {
    const db = makeMockDb();
    db.getRow.mockRejectedValue(missing());
    db.listRows.mockResolvedValue({ rows: [] });
    const fetchImpl = vi.fn().mockRejectedValue(new Error('secret detail'));
    const result = await reports.handlePublishBugReport(db, 'alice', publicPayload,
      { enabled: true, token: 'mock-token', now, fetchImpl });
    expect(result).toMatchObject({ status: 503 });
    expect(JSON.stringify(result)).not.toContain('secret detail');
    expect(db.createRow).toHaveBeenCalledTimes(1);
  });
});
