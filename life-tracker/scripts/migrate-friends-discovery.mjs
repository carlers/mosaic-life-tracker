import { MOSAIC_DATABASE, MOSAIC_TABLES } from '../infrastructure/mosaic-backend.mjs';

const friendships = MOSAIC_TABLES.find(t => t.id === 'friendships');
const controls = MOSAIC_TABLES.find(t => t.id === 'social_discovery_controls');
const acceptance = friendships?.columns.find(c => c.key === 'accepted_at');

function assertColumn(actual, expected) {
  for (const key of ['key', 'type', 'required', 'size', 'default']) {
    if ((actual?.[key] ?? null) !== (expected?.[key] ?? null)) {
      throw new Error('Friends discovery column mismatch: ' + expected.key + '.' + key);
    }
  }
  if (actual.status === 'failed') throw new Error('Friends discovery column failed');
}

export async function migrateFriendsDiscoveryBackend({
  request, log = () => {}, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
}) {
  if (!friendships || !controls || !acceptance) throw new Error('Missing friends discovery manifest');
  const base = '/tablesdb/' + MOSAIC_DATABASE.id + '/tables';
  const getOptional = async path => {
    try { return await request('GET', path); }
    catch (e) { if (Number(e?.status) === 404) return null; throw e; }
  };
  if (!await getOptional(base + '/friendships')) throw new Error('Friendships table missing');
  const columnPath = base + '/friendships/columns/accepted_at';
  let column = await getOptional(columnPath);
  if (!column) {
    log('Creating optional friendships.accepted_at');
    await request('POST', base + '/friendships/columns/varchar', {
      key: acceptance.key, size: acceptance.size, required: false,
      default: '', array: false, encrypt: false,
    });
  }
  for (let i = 0; i < 60; i++) {
    column = await getOptional(columnPath);
    if (column) {
      assertColumn(column, acceptance);
      if (!column.status || column.status === 'available') break;
    }
    if (i === 59) throw new Error('Friendship acceptance timestamp not available');
    await sleep(500);
  }
  const path = base + '/social_discovery_controls';
  let actual = await getOptional(path);
  if (!actual) {
    log('Creating server-private social discovery controls');
    await request('POST', base, {
      tableId: controls.id, name: controls.name, permissions: [],
      rowSecurity: true, enabled: true, columns: controls.columns, indexes: controls.indexes,
    });
  }
  for (let i = 0; i < 60; i++) {
    actual = await getOptional(path);
    if (actual?.status === 'failed') throw new Error('Discovery controls table failed');
    if (actual && (!actual.status || actual.status === 'available')) break;
    if (i === 59) throw new Error('Discovery controls table not available');
    await sleep(500);
  }
  const permissions = actual.$permissions ?? actual.permissions ?? [];
  if (actual.$id !== controls.id || actual.rowSecurity !== true || actual.enabled === false ||
      permissions.length > 0) throw new Error('Discovery controls permissions mismatch');
  const cols = new Map((actual.columns || []).map(c => [c.key, c]));
  for (const col of controls.columns) assertColumn(cols.get(col.key), col);
  const indexes = new Map((actual.indexes || []).map(idx => [idx.key, idx]));
  for (const index of controls.indexes) {
    const got = indexes.get(index.key);
    if (!got || got.type !== index.type ||
        JSON.stringify(got.attributes ?? got.columns) !== JSON.stringify(index.attributes)) {
      throw new Error('Discovery controls index mismatch: ' + index.key);
    }
  }
  return { acceptedAt: true, controls: true };
}
