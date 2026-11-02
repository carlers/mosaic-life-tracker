import { MOSAIC_DATABASE, MOSAIC_TABLES } from '../infrastructure/mosaic-backend.mjs';

const KEYS = ['lifecycle_state', 'lifecycle_target'];

/**
 * Additive, idempotent server lifecycle lock migration.
 * Never touches owner rows or changes existing category permission grants.
 */
export async function migrateCategoryLifecycleLockBackend({
  request, log = () => {}, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
}) {
  const table = MOSAIC_TABLES.find(item => item.id === 'categories');
  const expected = KEYS.map(key => table?.columns.find(column => column.key === key));
  if (expected.some(column => column?.type !== 'varchar' ||
      column.size !== 64 || column.required !== false || column.default !== '')) {
    throw new Error('Missing or invalid category lifecycle lock manifest');
  }

  const base = `/tablesdb/${MOSAIC_DATABASE.id}/tables/categories`;
  const optional = async path => {
    try { return await request('GET', path); }
    catch (error) {
      if (Number(error?.status ?? error?.code) === 404) return null;
      throw error;
    }
  };
  if (!await optional(base)) throw new Error('Categories table unavailable');

  const created = [];
  for (const field of expected) {
    const path = `${base}/columns/${field.key}`;
    const prior = await optional(path);
    if (!prior) {
      log(`Adding optional categories.${field.key} lifecycle column`);
      await request('POST', base + '/columns/varchar', {
        key: field.key, size: field.size, required: false,
        default: '', array: false, encrypt: false,
      });
      created.push(field.key);
    }
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      const row = await optional(path);
      if (row) {
        if (row.key !== field.key || row.type !== field.type ||
            row.size !== field.size || row.required !== false ||
            row.default !== field.default || row.array === true ||
            row.encrypt === true) {
          throw new Error(`Incompatible categories.${field.key} lifecycle column`);
        }
        if (row.status === 'failed') {
          throw new Error(`categories.${field.key} provisioning failed`);
        }
        if (!row.status || ['available', 'ready'].includes(row.status)) {
          ready = true;
          break;
        }
      }
      if (attempt < 59) await sleep(500);
    }
    if (!ready) throw new Error(`categories.${field.key} column unavailable`);
  }
  return { created };
}
