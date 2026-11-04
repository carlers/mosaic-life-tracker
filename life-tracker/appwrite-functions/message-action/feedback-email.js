const crypto = require('node:crypto');
const { Query } = require('node-appwrite');
const { handleSubmitBugReport } = require('./bug-reports');

const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || 'life_tracker';
const TABLE_ID = 'bug_reports';
const LABELS = Object.freeze({ idea: 'Suggestion', experience: 'Experience', other: 'Other feedback' });
const SENDER = 'no-reply@mosaic.carlers.is-a.dev';
const MAX_ATTEMPTS = 3;
const LEASE_MS = 10 * 60 * 1000;

function normalizeFeedback(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  if (Object.keys(payload).some(key => !['action', 'kind', 'message', 'requestId', 'diagnostics'].includes(key))) return null;
  if (!Object.hasOwn(LABELS, payload.kind) || typeof payload.message !== 'string' ||
      !payload.message.trim() || payload.message.trim().length > 3000) return null;
  return {
    requestId: payload.requestId,
    title: '[Feedback] ' + LABELS[payload.kind],
    description: payload.message.trim(),
    steps: '',
    ...(payload.diagnostics === undefined ? {} : { diagnostics: payload.diagnostics }),
  };
}
async function handleSubmitFeedback(db, callerId, payload, now = new Date()) {
  const report = normalizeFeedback(payload);
  if (!report) return { status: 400, body: { error: 'Invalid feedback' } };
  return handleSubmitBugReport(db, callerId, report, now, { kind: 'feedback' });
}
function deliveryConfig(env) {
  const key = env.BREVO_FEEDBACK_API_KEY;
  const recipient = env.FEEDBACK_EMAIL_TO;
  return env.FEEDBACK_EMAIL_ENABLED === 'true' && typeof key === 'string' && !!key.trim() &&
    typeof recipient === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)
    ? { key, recipient } : null;
}
function emailBody(row) {
  return ['New private Mosaic feedback', 'Category: ' + row.title.replace(/^\[Feedback\] /, ''),
    'Reference: ' + row.$id, 'Received: ' + row.created_at, '', row.description, '',
    'Email copies are retained separately from Appwrite private feedback.'].join('\n');
}
function updateFeedback(db, rowId, data) {
  return db.updateRow({ databaseId: DATABASE_ID, tableId: TABLE_ID, rowId, data });
}
async function tryDeliverFeedback(db, rowId, {
  env = process.env, fetchImpl = globalThis.fetch, now = new Date(), log = () => {},
} = {}) {
  const config = deliveryConfig(env);
  if (!config) return { status: 'disabled' };
  if (!/^bug_[a-f0-9]{32}$/.test(rowId)) return { status: 'invalid_id' };
  const row = await db.getRow({ databaseId: DATABASE_ID, tableId: TABLE_ID, rowId });
  // A user-controlled title is NOT enough to make a bug report email-eligible.
  if (row.report_kind !== 'feedback' ||
      !Object.values(LABELS).some(label => row.title === '[Feedback] ' + label))
    return { status: 'not_feedback' };
  if (['sent', 'review', 'failed'].includes(row.feedback_email_status)) return { status: 'terminal' };
  if (!['pending', 'sending'].includes(row.feedback_email_status)) return { status: 'not_queued' };
  const attempts = Number(row.feedback_email_attempts || 0);
  if (attempts >= MAX_ATTEMPTS) return { status: 'attempt_limit' };
  const leaseAge = now.getTime() - Date.parse(row.feedback_email_lease_at || '');
  if (row.feedback_email_status === 'sending') {
    if (leaseAge >= 0 && leaseAge < LEASE_MS) return { status: 'leased' };
    // A crashed sender may already have handed the message to Brevo.
    // Never automatically replay an expired lease with unknown provider acceptance.
    await updateFeedback(db, rowId, {
      feedback_email_status: 'review', feedback_email_error_code: 'stale_lease',
      feedback_email_lease_token: '',
    });
    return { status: 'review' };
  }
  if (row.feedback_email_next_attempt_at && Date.parse(row.feedback_email_next_attempt_at) > now.getTime())
    return { status: 'not_due' };
  const token = crypto.randomBytes(16).toString('hex');
  await updateFeedback(db, rowId, {
    feedback_email_status: 'sending', feedback_email_attempts: attempts + 1,
    feedback_email_lease_at: now.toISOString(), feedback_email_lease_token: token,
  });
  const claimed = await db.getRow({ databaseId: DATABASE_ID, tableId: TABLE_ID, rowId });
  if (claimed.feedback_email_lease_token !== token) return { status: 'lost_lease' };
  let responseStatus = 0;
  let providerAccepted = false;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    let response;
    try {
      response = await fetchImpl('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'api-key': config.key },
        body: JSON.stringify({
          sender: { name: 'Mosaic', email: SENDER }, to: [{ email: config.recipient }],
          subject: row.title, textContent: emailBody(row), tags: ['mosaic-feedback'],
        }),
        signal: controller.signal,
      });
      responseStatus = response.status;
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) throw new Error('Provider rejected notification');
    const receipt = await response.json();
    if (typeof receipt?.messageId !== 'string' || !receipt.messageId.trim())
      throw new Error('Unconfirmed provider response');
    providerAccepted = true;
    await updateFeedback(db, rowId, {
      feedback_email_status: 'sent', feedback_email_message_id: receipt.messageId.slice(0, 255),
      feedback_email_sent_at: new Date().toISOString(), feedback_email_lease_token: '',
      feedback_email_next_attempt_at: '', feedback_email_error_code: '',
    });
    return { status: 'accepted' };
  } catch {
    // Missing/ambiguous HTTP response might have been accepted. Require review, not blind replay.
    const retryable = responseStatus === 429 || responseStatus >= 500;
    const nextStatus = providerAccepted || responseStatus === 0 ? 'review' :
      retryable && attempts + 1 < MAX_ATTEMPTS ? 'pending' : 'failed';
    const nextAt = nextStatus === 'pending'
      ? new Date(now.getTime() + (5 * (2 ** attempts)) * 60000).toISOString() : '';
    try {
      await updateFeedback(db, rowId, {
        feedback_email_status: nextStatus, feedback_email_next_attempt_at: nextAt,
        feedback_email_lease_token: '',
        feedback_email_error_code: providerAccepted ? 'receipt_write' :
          responseStatus ? 'http_' + responseStatus : 'uncertain',
      });
    } catch { log('Feedback notification state update failed'); }
    return { status: nextStatus };
  }
}
async function retryPendingFeedback(db, options = {}) {
  if (!deliveryConfig(options.env || process.env)) return { processed: 0 };
  const result = await db.listRows({
    databaseId: DATABASE_ID, tableId: TABLE_ID,
    queries: [Query.equal('feedback_email_status', ['pending', 'sending']),
      Query.orderAsc('created_at'), Query.limit(6)], total: false,
  });
  let processed = 0;
  for (const row of result.rows || []) {
    if (row.report_kind !== 'feedback') continue;
    await tryDeliverFeedback(db, row.$id, options);
    processed++;
  }
  return { processed };
}
module.exports = { normalizeFeedback, handleSubmitFeedback, tryDeliverFeedback,
  retryPendingFeedback, deliveryConfig, emailBody };
