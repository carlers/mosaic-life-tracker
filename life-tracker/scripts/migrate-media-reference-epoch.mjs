// Additive private ledger revision needed by the opt-in transactional fence.
// Never adjust table or row ACLs as part of this migration.
export async function migrateMediaReferenceEpoch({ request, databaseId = 'life_tracker', log = () => {} }) {
  const path = '/tablesdb/' + databaseId + '/tables/media_uploads';
  const table = await request('GET', path);
  const permissions = table.$permissions ?? table.permissions ?? [];
  if (table.$id !== 'media_uploads' || table.rowSecurity !== true ||
      table.enabled === false || !Array.isArray(permissions) || permissions.length)
    throw Error('Media reference ledger security drift');
  const column = (table.columns || []).find(col => col.key === 'reference_epoch');
  if (column) {
    if (column.type !== 'integer' || column.required !== false ||
        (column.default !== undefined && column.default !== null && column.default !== 0))
      throw Error('Media reference epoch column drift');
    return { added: false };
  }
  await request('POST', path + '/columns/integer',
    { key: 'reference_epoch', required: false, default: 0, min: 0 });
  log('Added private media reference_epoch column');
  return { added: true };
}
