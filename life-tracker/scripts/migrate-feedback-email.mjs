import { MOSAIC_DATABASE, MOSAIC_TABLES } from '../infrastructure/mosaic-backend.mjs';

const keys = ['report_kind', 'feedback_email_status', 'feedback_email_attempts',
  'feedback_email_next_attempt_at', 'feedback_email_lease_at', 'feedback_email_lease_token',
  'feedback_email_sent_at', 'feedback_email_message_id', 'feedback_email_error_code'];
const table = MOSAIC_TABLES.find(item => item.id === 'bug_reports');
export async function migrateFeedbackEmailBackend({
  request, log = () => {}, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
}) {
  if (!table) throw new Error('Private feedback table missing from manifest');
  const base = '/tablesdb/' + MOSAIC_DATABASE.id + '/tables/bug_reports';
  const getOptional = async path => {
    try { return await request('GET', path); }
    catch (cause) { if (Number(cause?.status ?? cause?.code) === 404) return null; throw cause; }
  };
  if (!await getOptional(base)) throw new Error('Private bug_reports table must exist');
  for (const key of keys) {
    const expected = table.columns.find(column => column.key === key);
    if (!expected) throw new Error('Missing manifest field ' + key);
    const path = base + '/columns/' + key;
    if (!await getOptional(path)) {
      log('Adding private feedback delivery field ' + key);
      await request('POST', base + '/columns/' + expected.type, {
        key, required: false, default: expected.default, array: false,
        ...(expected.type === 'varchar' ? { size: expected.size, encrypt: false } : {}),
      });
    }
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      const actual = await request('GET', path);
      if (!actual || ['key', 'type', 'required', 'default'].some(prop =>
        (actual[prop] ?? null) !== (expected[prop] ?? null)) ||
        (expected.size && actual.size !== expected.size) || actual.status === 'failed')
        throw new Error('Incompatible private feedback field: ' + key);
      if (!actual.status || actual.status === 'available') { ready = true; break; }
      await sleep(500);
    }
    if (!ready) throw new Error('Feedback field unavailable: ' + key);
  }
  const index = table.indexes.find(item => item.key === 'idx_bug_feedback_queue');
  if (!index) throw new Error('Missing private feedback queue index manifest');
  const indexPath = base + '/indexes/' + index.key;
  if (!await getOptional(indexPath)) {
    log('Adding private feedback queue index');
    await request('POST', base + '/indexes', {
      key: index.key, type: index.type, attributes: index.attributes,
    });
  }
  for (let attempt = 0; attempt < 60; attempt++) {
    const actual = await request('GET', indexPath);
    if (!actual || actual.key !== index.key || actual.type !== index.type ||
        JSON.stringify(actual.attributes) !== JSON.stringify(index.attributes) ||
        actual.status === 'failed') throw new Error('Incompatible private feedback queue index');
    if (!actual.status || actual.status === 'available') return { applied: true };
    await sleep(500);
  }
  throw new Error('Feedback queue index unavailable');
}
