import { MOSAIC_DATABASE, MOSAIC_TABLES } from '../infrastructure/mosaic-backend.mjs';

const column = MOSAIC_TABLES.find(table => table.id === 'diary')?.columns.find(c => c.key === 'emoji');

function compatible(actual) {
  if (!column) throw new Error('Missing diary emoji manifest column');
  for (const key of ['key', 'type', 'size', 'required', 'default']) {
    if ((actual?.[key] ?? null) !== (column[key] ?? null)) {
      throw new Error('Incompatible diary emoji column: ' + key);
    }
  }
  if (actual?.status === 'failed') throw new Error('Diary emoji column provisioning failed');
}

export async function migrateDiaryEmojiBackend({ request, log = () => {}, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)) }) {
  if (!column) throw new Error('Missing diary emoji manifest column');
  const path = `/tablesdb/${MOSAIC_DATABASE.id}/tables/diary`;
  const getOptional = async p => {
    try { return await request('GET', p); }
    catch (error) { if (Number(error?.status) === 404) return null; throw error; }
  };
  if (!await getOptional(path)) throw new Error('Diary table missing');
  const fieldPath = path + '/columns/emoji';
  const current = await getOptional(fieldPath);
  if (current) compatible(current);
  else {
    log('Creating optional diary.emoji column');
    await request('POST', path + '/columns/varchar', {
      key: column.key, size: column.size, required: column.required,
      default: column.default, array: false, encrypt: false,
    });
  }
  for (let attempt = 0; attempt < 60; attempt++) {
    const next = await request('GET', fieldPath);
    compatible(next);
    if (!next.status || next.status === 'available') {
      return { column: 'emoji', created: !current };
    }
    await sleep(500);
  }
  throw new Error('Diary emoji column did not become available');
}
