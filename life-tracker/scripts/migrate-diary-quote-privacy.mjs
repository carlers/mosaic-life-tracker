import { MOSAIC_DATABASE, MOSAIC_TABLES } from '../infrastructure/mosaic-backend.mjs';

/** Additive migration only; does not access or rewrite user message contents. */
export async function migrateDiaryQuotePrivacy({
  request, log = () => {}, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
}) {
  const tableBase = '/tablesdb/' + MOSAIC_DATABASE.id + '/tables';
  async function getOptional(path) {
    try { return await request('GET', path); }
    catch (error) { if (Number(error?.status) === 404) return null; throw error; }
  }
  for (const [table, keys] of [
    ['diary', ['quote_epoch', 'quote_revoke_revision']],
    ['messages', ['diary_ref_epoch']],
  ]) {
    const expected = MOSAIC_TABLES.find(t => t.id === table);
    const path = tableBase + '/' + table;
    if (!expected || !(await getOptional(path))) throw Error('Missing ' + table + ' table');
    for (const key of keys) {
      const wanted = expected.columns.find(c => c.key === key);
      if (!wanted || wanted.required !== false) throw Error('Invalid quote column: ' + key);
      const url = path + '/columns/' + key;
      let existing = await getOptional(url);
      if (!existing) {
        log('Adding ' + table + '.' + key);
        await request('POST', path + '/columns/' + (wanted.type === 'integer' ? 'integer' : 'varchar'), {
          key, required: false, default: wanted.default, array: false,
          ...(wanted.type === 'varchar' ? { size: wanted.size, encrypt: false } : {}),
        });
      }
      for (let attempt = 0; attempt < 60; attempt++) {
        existing = await getOptional(url);
        if (existing) {
          if (existing.key !== key || existing.type !== wanted.type ||
              existing.required !== false || existing.default !== wanted.default ||
              (wanted.size && existing.size !== wanted.size))
            throw Error('Incompatible ' + table + '.' + key);
          if (existing.status === 'failed') throw Error('Column failed: ' + key);
          if (!existing.status || ['available', 'ready'].includes(existing.status)) break;
        }
        if (attempt === 59) throw Error('Column unavailable: ' + key);
        await sleep(500);
      }
    }
  }
  const path = tableBase + '/messages';
  const expectedIndex = MOSAIC_TABLES.find(t => t.id === 'messages')?.indexes
    .find(index => index.key === 'idx_diary_ref_id');
  if (!expectedIndex) throw Error('Missing diary reference index manifest');
  const url = path + '/indexes/' + expectedIndex.key;
  let index = await getOptional(url);
  if (!index) {
    log('Adding messages diary reference lookup index');
    await request('POST', path + '/indexes', {
      key: expectedIndex.key, type: 'key', attributes: expectedIndex.attributes,
      orders: [],
    });
  }
  for (let attempt = 0; attempt < 60; attempt++) {
    index = await getOptional(url);
    if (index) {
      if (index.key !== expectedIndex.key || index.type !== expectedIndex.type ||
          JSON.stringify(index.attributes || index.columns) !==
            JSON.stringify(expectedIndex.attributes))
        throw Error('Incompatible diary reference index');
      if (index.status === 'failed') throw Error('Diary index failed');
      if (!index.status || ['available', 'ready'].includes(index.status)) return;
    }
    if (attempt === 59) throw Error('Diary reference index unavailable');
    await sleep(500);
  }
}
