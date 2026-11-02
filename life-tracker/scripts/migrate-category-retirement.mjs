import { MOSAIC_DATABASE, MOSAIC_TABLES } from '../infrastructure/mosaic-backend.mjs';

const expected = MOSAIC_TABLES.find(table => table.id === 'categories')?.columns
  .find(column => column.key === 'retired_on');

/** Idempotent, additive Appwrite schema migration. Does not touch owner rows. */
export async function migrateCategoryRetirementBackend({
  request, log = () => {}, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
}) {
  if (!expected) throw new Error('Missing retired_on in category manifest');
  const base = `/tablesdb/${MOSAIC_DATABASE.id}/tables/categories`;
  const columnPath = `${base}/columns/retired_on`;
  const optional = async path => {
    try { return await request('GET', path); }
    catch (e) { if (Number(e?.status) === 404) return null; throw e; }
  };
  if (!await optional(base)) throw new Error('Categories table missing');
  const prior = await optional(columnPath);
  const validate = row => {
    for (const key of ['key', 'type', 'size', 'required', 'default']) {
      if ((row?.[key] ?? null) !== (expected[key] ?? null))
        throw new Error('Incompatible categories.retired_on column: ' + key);
    }
    if (row.status === 'failed') throw new Error('categories.retired_on provisioning failed');
  };
  if (prior) validate(prior);
  else {
    log('Creating optional categories.retired_on varchar');
    await request('POST', base + '/columns/varchar', {
      key: expected.key, size: expected.size, required: false, default: '',
      array: false, encrypt: false,
    });
  }
  for (let attempt = 0; attempt < 60; attempt++) {
    const current = await request('GET', columnPath);
    validate(current);
    if (!current.status || current.status === 'available') {
      return { column: 'retired_on', created: !prior };
    }
    await sleep(500);
  }
  throw new Error('categories.retired_on column was not available');
}
