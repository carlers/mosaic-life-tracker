import { MOSAIC_DATABASE, MOSAIC_TABLES } from '../infrastructure/mosaic-backend.mjs';

const table = MOSAIC_TABLES.find(t => t.id === 'bug_reports');
const keys = ['github_issue_url', 'github_issue_number', 'github_publish_started_at'];
export async function migratePublicBugReportBackend({
  request, log = () => {}, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
}) {
  if (!table) throw new Error('Bug reports table missing');
  const base = '/tablesdb/' + MOSAIC_DATABASE.id + '/tables/bug_reports';
  const getOptional = async path => {
    try { return await request('GET', path); }
    catch (error) { if (Number(error?.status ?? error?.code) === 404) return null; throw error; }
  };
  if (!await getOptional(base)) throw new Error('Private bug report table must exist');
  const result = [];
  for (const key of keys) {
    const expected = table.columns.find(c => c.key === key);
    if (!expected) throw new Error('Missing manifest column ' + key);
    const path = base + '/columns/' + key;
    let column = await getOptional(path);
    const existed = !!column;
    if (!column) {
      log('Provisioning private issue reference field ' + key);
      const type = expected.type === 'varchar' ? 'varchar' : 'integer';
      await request('POST', base + '/columns/' + type, {
        key, required: false, default: expected.default, array: false,
        ...(type === 'varchar' ? { size: expected.size, encrypt: false } : {}),
      });
    }
    for (let attempt = 0; attempt < 60; attempt++) {
      column = await request('GET', path);
      if (column && ['key', 'type', 'size', 'required', 'default'].every(prop =>
        (column[prop] ?? null) === (expected[prop] ?? null)) &&
        column.status !== 'failed') {
        if (!column.status || column.status === 'available') break;
      } else throw new Error('Incompatible issue receipt column: ' + key);
      await sleep(500);
      if (attempt === 59) throw new Error('Column did not provision: ' + key);
    }
    result.push({ key, created: !existed });
  }
  return result;
}
