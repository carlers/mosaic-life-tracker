import { MOSAIC_DATABASE, MOSAIC_TABLES } from '../infrastructure/mosaic-backend.mjs';
const expected = MOSAIC_TABLES.find(table => table.id === 'diary')?.columns.find(column => column.key === 'photos');
export async function migrateDiaryPhotosBackend({ request, log = () => {}, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)) }) {
  if (!expected) throw new Error('Diary photos manifest column missing');
  const path = `/tablesdb/${MOSAIC_DATABASE.id}/tables/diary`;
  async function readColumn() {
    try { return await request('GET', path + '/columns/photos'); }
    catch (e) { if (Number(e?.status) === 404) return null; throw e; }
  }
  const existing = await readColumn();
  if (!existing) {
    log('Creating optional diary.photos longtext column');
    await request('POST', path + '/columns/longtext', { key: 'photos', required: false, array: false, encrypt: false });
  }
  for (let i = 0; i < 60; i++) {
    const col = await readColumn();
    if (col) {
      if (col.key !== expected.key || col.type !== expected.type || col.required !== false)
        throw new Error('Incompatible diary photos column');
      if (!col.status || col.status === 'available') return { column: 'photos', created: !existing };
      if (col.status === 'failed') throw new Error('Diary photos column provisioning failed');
    }
    await sleep(500);
  }
  throw new Error('Diary photos column unavailable');
}
