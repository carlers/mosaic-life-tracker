import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { makeMockDb } from '../helpers/invoke-handler';

const require = createRequire(import.meta.url);
const email = require('../../appwrite-functions/message-action/feedback-email.js');
const reportId = 'bug_' + 'a'.repeat(32);
const now = new Date('2026-11-04T12:00:00.000Z');
const env = {
  FEEDBACK_EMAIL_ENABLED: 'true',
  BREVO_FEEDBACK_API_KEY: 'test-only-key',
  FEEDBACK_EMAIL_TO: 'operator@example.com',
};
const missing = () => Object.assign(new Error('Missing'), { code: 404 });
function makeDeliveryRow(overrides: Record<string, unknown> = {}) {
  return { $id: reportId, user_id: 'private_owner', report_kind: 'feedback',
    title: '[Feedback] Suggestion', description: 'Please add a faster calendar',
    diagnostics: '{"os":"Android"}', created_at: now.toISOString(),
    feedback_email_status: 'pending', feedback_email_attempts: 0,
    feedback_email_next_attempt_at: '', feedback_email_lease_at: '', ...overrides };
}
function deliveryDb(row: Record<string, unknown>) {
  const db = makeMockDb();
  db.getRow.mockImplementation(async () => ({ ...row }));
  db.updateRow.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
    Object.assign(row, data);
    return { ...row };
  });
  return db;
}
describe('private feedback intake and email', () => {
  it('classifies feedback server-side and stores without GitHub publishing', async () => {
    const db = makeMockDb();
    db.getRow.mockRejectedValue(missing());
    db.listRows.mockResolvedValue({ rows: [] });
    const response = await email.handleSubmitFeedback(db, 'alice', {
      action: 'submit_feedback', kind: 'idea', message: 'Add a quick filter',
      requestId: 'b'.repeat(32),
    }, now);
    expect(response.status).toBe(201);
    const created = db.createRow.mock.calls[0][0];
    expect(created.data.report_kind).toBe('feedback');
    expect(created.data.feedback_email_status).toBe('pending');
    expect(created.data.title).toBe('[Feedback] Suggestion');
    expect(created.data.user_id).toBe('alice');
    expect(created.permissions).toEqual([]);
    expect(created.data).not.toHaveProperty('github_issue_url');
  });
  it('rejects unknown feedback kind, recipient override and invalid request ID', async () => {
    const db = makeMockDb();
    for (const payload of [
      { kind: '__proto__', message: 'X', requestId: 'a'.repeat(32) },
      { kind: 'idea', message: '', requestId: 'a'.repeat(32) },
      { kind: 'idea', message: 'Hi', requestId: 'a'.repeat(32), recipient: 'attacker@example.com' },
      { kind: 'idea', message: 'Hi', requestId: 'bad' },
    ]) {
      const result = await email.handleSubmitFeedback(db, 'alice', payload, now);
      expect(result.status).toBe(400);
    }
    expect(db.createRow).not.toHaveBeenCalled();
  });
  it('sends only category, message and reference, not owner identity or diagnostics', async () => {
    const row = makeDeliveryRow();
    const db = deliveryDb(row);
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true, status: 201, json: async () => ({ messageId: 'provider-123' }),
    });
    const result = await email.tryDeliverFeedback(db, reportId, { env, fetchImpl, now });
    expect(result.status).toBe('accepted');
    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    const body = JSON.parse(options.body);
    expect(body.to).toEqual([{ email: 'operator@example.com' }]);
    expect(body.sender.email).toBe('no-reply@mosaic.carlers.is-a.dev');
    expect(body.textContent).toContain('Please add a faster calendar');
    expect(body.textContent).not.toMatch(/private_owner|Android/);
    expect(row.feedback_email_status).toBe('sent');
    expect(row.feedback_email_message_id).toBe('provider-123');
    await email.tryDeliverFeedback(db, reportId, { env, fetchImpl, now });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it('never emails ordinary bugs even if a user mimics a feedback title', async () => {
    const db = deliveryDb(makeDeliveryRow({ report_kind: 'bug' }));
    const fetchImpl = vi.fn();
    expect((await email.tryDeliverFeedback(db, reportId, { env, fetchImpl, now })).status).toBe('not_feedback');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it('queues with disabled config, retries explicit throttling, and holds ambiguous errors', async () => {
    const row = makeDeliveryRow();
    const db = deliveryDb(row);
    expect((await email.tryDeliverFeedback(db, reportId, { env: {}, now })).status).toBe('disabled');
    const throttled = await email.tryDeliverFeedback(db, reportId, {
      env, now, fetchImpl: vi.fn().mockResolvedValue({ ok: false, status: 429 }),
    });
    expect(throttled.status).toBe('pending');
    expect(row.feedback_email_attempts).toBe(1);
    expect(Date.parse(String(row.feedback_email_next_attempt_at))).toBeGreaterThan(now.getTime());
    Object.assign(row, { feedback_email_status: 'pending', feedback_email_next_attempt_at: '' });
    const uncertain = await email.tryDeliverFeedback(db, reportId, {
      env, now, fetchImpl: vi.fn().mockRejectedValue(new Error('timeout')),
    });
    expect(uncertain.status).toBe('review');
    expect(row.feedback_email_status).toBe('review');
  });
  it('does not resend a stale sending lease that may already have reached the provider', async () => {
    const row = makeDeliveryRow({
      feedback_email_status: 'sending',
      feedback_email_attempts: 1,
      feedback_email_lease_at: '2026-11-04T11:00:00.000Z',
    });
    const db = deliveryDb(row);
    const fetchImpl = vi.fn();
    const outcome = await email.tryDeliverFeedback(db, reportId, { env, fetchImpl, now });
    expect(outcome.status).toBe('review');
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(row.feedback_email_status).toBe('review');
  });
});
