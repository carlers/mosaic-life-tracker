import { MOSAIC_DATABASE, MOSAIC_TABLES } from '../infrastructure/mosaic-backend.mjs';

const TABLE = MOSAIC_TABLES.find(table => table.id === 'friendships');

function sameStringSet(left, right) {
  return Array.isArray(left) && Array.isArray(right) &&
    left.length === right.length &&
    [...left].sort().every((item, index) => item === [...right].sort()[index]);
}

export async function migrateFriendshipTablePermissions({
  request, databaseId = MOSAIC_DATABASE.id, log = () => {},
}) {
  if (!TABLE || !sameStringSet(TABLE.permissions, [])) {
    throw new Error('Missing private friendship table manifest');
  }
  const path = `/tablesdb/${databaseId}/tables/friendships`;
  const current = await request('GET', path);
  if (current?.$id !== TABLE.id || current.rowSecurity !== true ||
      current.name !== TABLE.name || current.enabled === false) {
    throw new Error('Incompatible friendship table metadata');
  }
  const columns = new Map((current.columns || []).map(col => [col.key, col]));
  for (const expected of TABLE.columns) {
    const col = columns.get(expected.key);
    if (!col || col.type !== expected.type ||
        col.required !== expected.required ||
        (expected.size !== undefined && col.size !== expected.size) ||
        (Object.hasOwn(expected, 'default') &&
          (col.default ?? null) !== (expected.default ?? null))) {
      throw new Error('Incompatible friendship table column: ' + expected.key);
    }
  }
  const indexes = new Map((current.indexes || []).map(idx => [idx.key, idx]));
  for (const expected of TABLE.indexes) {
    const index = indexes.get(expected.key);
    if (!index || index.type !== expected.type ||
        !sameStringSet(index.columns ?? index.attributes, expected.attributes)) {
      throw new Error('Incompatible friendship index: ' + expected.key);
    }
  }
  const permissions = current.$permissions ?? current.permissions;
  if (sameStringSet(permissions, TABLE.permissions)) return { changed: false };
  if (!sameStringSet(permissions, ['create("users")'])) {
    throw new Error('Unrecognized friendship permissions: refuse to change');
  }
  // This is an explicit-only security migration, not a safe additive Preview
  // auto-apply: older browser clients may still expect table-level creates.
  log('Removing legacy client-level friendship create permission...');
  await request('PUT', path, {
    name: TABLE.name, permissions: [], rowSecurity: true, enabled: true,
  });
  const after = await request('GET', path);
  if (!sameStringSet(after.$permissions ?? after.permissions, TABLE.permissions)) {
    throw new Error('Friendship permission correction was not confirmed');
  }
  return { changed: true };
}
