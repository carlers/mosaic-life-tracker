import { MOSAIC_DATABASE, MOSAIC_TABLES } from '../infrastructure/mosaic-backend.mjs';

const wanted = MOSAIC_TABLES.find(t => t.id === 'media_uploads')
  ?.columns.filter(c => ['delete_requested_at','delete_token_hash','deleted_at','delete_receipt'].includes(c.key)) || [];

export async function migrateSyntheticMediaDelete({
  request, databaseId = MOSAIC_DATABASE.id, log = () => {},
}) {
  if (wanted.length !== 4) throw new Error('Missing test receipt manifest');
  const path = '/tablesdb/' + databaseId + '/tables/media_uploads';
  const table = await request('GET', path);
  const grants = table.$permissions ?? table.permissions ?? [];
  if (table.$id !== 'media_uploads' || table.rowSecurity !== true ||
      table.enabled === false || grants.length) {
    throw new Error('Test receipt table security drift');
  }
  const existing = new Map((table.columns || []).map(c => [c.key,c]));
  let added = 0;
  for (const field of wanted) {
    const old = existing.get(field.key);
    if (old) {
      if (old.type !== field.type || old.required !== false ||
          old.size !== field.size) throw new Error('Test receipt column drift');
      continue;
    }
    await request('POST', path + '/columns/varchar', {
      key: field.key, size: field.size, required: false,
    });
    log('Added additive synthetic receipt column ' + field.key);
    added++;
  }
  return { added };
}
