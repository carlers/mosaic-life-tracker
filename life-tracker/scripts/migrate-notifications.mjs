import { MOSAIC_DATABASE, MOSAIC_TABLES } from '../infrastructure/mosaic-backend.mjs';

const TABLE_IDS = ['notifications', 'push_subscriptions'];

function permissionsOf(actual) {
  return Array.isArray(actual?.$permissions)
    ? actual.$permissions
    : Array.isArray(actual?.permissions)
      ? actual.permissions
      : [];
}

function sameArray(left, right) {
  return (
    Array.isArray(left) &&
    Array.isArray(right) &&
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function indexAttributes(actual) {
  return Array.isArray(actual?.attributes)
    ? actual.attributes
    : Array.isArray(actual?.columns)
      ? actual.columns
      : [];
}

function comparable(value) {
  return value === undefined || value === null ? null : value;
}

function assertCompatibleTable(actual, expected) {
  if (
    actual?.$id !== expected.id ||
    actual?.rowSecurity !== expected.rowSecurity ||
    actual?.enabled === false ||
    !sameArray(permissionsOf(actual), expected.permissions)
  ) {
    throw new Error(
      `Existing ${expected.id} table does not match the Mosaic manifest.`
    );
  }

  const columns = new Map(
    (actual.columns || []).map((column) => [column.key, column])
  );
  for (const expectedColumn of expected.columns) {
    const current = columns.get(expectedColumn.key);
    if (!current) {
      throw new Error(
        `Existing ${expected.id} column ${expectedColumn.key} is missing.`
      );
    }
    for (const key of ['type', 'required', 'size', 'default']) {
      if (
        Object.prototype.hasOwnProperty.call(expectedColumn, key) &&
        comparable(current[key]) !== comparable(expectedColumn[key])
      ) {
        throw new Error(
          `Existing ${expected.id} column ${expectedColumn.key} is incompatible.`
        );
      }
    }
  }

  const indexes = new Map(
    (actual.indexes || []).map((index) => [index.key, index])
  );
  // Index 005 is provisioned separately on existing installations.
  for (const expectedIndex of (expected.indexes || []).filter(
    (index) => index.key !== 'idx_notification_created'
  )) {
    const current = indexes.get(expectedIndex.key);
    if (
      !current ||
      current.type !== expectedIndex.type ||
      !sameArray(indexAttributes(current), expectedIndex.attributes)
    ) {
      throw new Error(
        `Existing ${expected.id} index ${expectedIndex.key} is incompatible.`
      );
    }
  }
}

async function getOptional(request, path) {
  try {
    return await request('GET', path);
  } catch (error) {
    if (Number(error?.status) === 404) return null;
    throw error;
  }
}

export async function migrateNotificationsBackend({
  request,
  databaseId = MOSAIC_DATABASE.id,
  log = () => {},
}) {
  const tablesPath = `/tablesdb/${databaseId}/tables`;
  const migrated = [];

  for (const tableId of TABLE_IDS) {
    const expected = MOSAIC_TABLES.find((table) => table.id === tableId);
    if (!expected) {
      throw new Error(`Portable Mosaic manifest is missing ${tableId}.`);
    }
    const path = `${tablesPath}/${tableId}`;
    const current = await getOptional(request, path);
    if (!current) {
      log(`Creating ${tableId} table...`);
      await request('POST', tablesPath, {
        tableId: expected.id,
        name: expected.name,
        permissions: expected.permissions,
        rowSecurity: expected.rowSecurity,
        enabled: expected.enabled,
        columns: expected.columns,
        indexes: expected.indexes,
      });
      migrated.push({ tableId, created: true });
      continue;
    }
    assertCompatibleTable(current, expected);
    migrated.push({ tableId, created: false });
  }

  return migrated;
}
