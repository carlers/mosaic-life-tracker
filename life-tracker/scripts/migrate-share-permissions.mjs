import { MOSAIC_DATABASE, MOSAIC_TABLES } from '../infrastructure/mosaic-backend.mjs';
const expected = MOSAIC_TABLES.find(table => table.id === 'task_shares');

export async function migrateSharePermissions({ request, databaseId = MOSAIC_DATABASE.id,
  log = () => {}, sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms)) }) {
  if (!expected) throw new Error('Missing shared task membership schema');
  const path = '/tablesdb/' + databaseId + '/tables/task_shares';
  const table = await request('GET', path);
  if (table.rowSecurity !== true || (table.$permissions || table.permissions || []).length !== 0)
    throw new Error('Unsafe shared-task table permissions');
  for (const key of ['allow_title_edit', 'allow_date_edit']) {
    const wanted = expected.columns.find(c => c.key === key);
    const current = (table.columns || []).find(c => c.key === key);
    if (current && (current.type !== 'boolean' || current.required !== false || current.default !== false))
      throw new Error('Incompatible share permission column: ' + key);
    if (current?.status === 'available') continue;
    if (!current) {
      log('Adding default-off share permission: ' + key);
      await request('POST', path + '/columns/boolean', {
        key, required: false, default: false, array: false,
      });
    }
    let ready = false;
    for (let attempt = 0; attempt < 25; attempt++) {
      const column = await request('GET', path + '/columns/' + key);
      if (['available', 'ready'].includes(column.status)) { ready = true; break; }
      if (column.status === 'failed') throw new Error('Share permission column failed: ' + key);
      await sleep(800);
    }
    if (!ready) throw new Error('Share permission column not ready: ' + key);
    if (!wanted) throw new Error('Manifest share permission missing');
  }
}
