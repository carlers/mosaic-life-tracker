import { MOSAIC_DATABASE, MOSAIC_TABLES } from '../infrastructure/mosaic-backend.mjs';

const expected = MOSAIC_TABLES.find(table => table.id === 'tasks')?.columns
  .find(column => column.key === 'category_delete_marker');

/** Additive server-owned provenance for task tombstones created by category delete. */
export async function migrateCategoryRecoveryBackend({
  request, log = () => {}, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
}) {
  if (!expected) throw new Error('Missing tasks.category_delete_marker in manifest');
  const base = `/tablesdb/${MOSAIC_DATABASE.id}/tables/tasks`;
  const path = base + '/columns/category_delete_marker';
  const optional = async uri => {
    try { return await request('GET', uri); }
    catch(e) { if(Number(e?.status) === 404) return null; throw e; }
  };
  if (!await optional(base)) throw new Error('Tasks table unavailable');
  const prior = await optional(path);
  const validate = row => {
    for(const key of ['key','type','size','required','default']) {
      if ((row?.[key] ?? null) !== (expected[key] ?? null))
        throw new Error('Incompatible category deletion provenance column: '+key);
    }
    if (row.status === 'failed') throw new Error('Task provenance column provisioning failed');
  };
  if (prior) validate(prior);
  else {
    log('Adding server-owned tasks.category_delete_marker');
    await request('POST', base + '/columns/varchar', {
      key: expected.key, size: 36, required: false, default: '', array: false, encrypt: false,
    });
  }
  for(let i=0;i<60;i++) {
    const row=await request('GET',path);
    validate(row);
    if (!row.status || row.status === 'available') return {created: !prior};
    await sleep(500);
  }
  throw new Error('Task provenance column not available');
}
