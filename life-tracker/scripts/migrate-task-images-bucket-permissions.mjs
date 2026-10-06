import { MOSAIC_BUCKET } from '../infrastructure/mosaic-backend.mjs';

function permissionsOf(actual) {
  return Array.isArray(actual?.$permissions)
    ? actual.$permissions
    : Array.isArray(actual?.permissions)
      ? actual.permissions
      : [];
}

function sameStringSet(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  const a = [...left].map(String).sort();
  const b = [...right].map(String).sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

export function assertCompatibleTaskImagesBucket(actual) {
  if (!actual || actual.$id !== MOSAIC_BUCKET.id) {
    throw new Error('task_images bucket is missing or has the wrong ID.');
  }
  for (const key of [
    'name',
    'fileSecurity',
    'enabled',
    'maximumFileSize',
    'compression',
    'encryption',
    'antivirus',
    'transformations',
  ]) {
    if (actual[key] !== MOSAIC_BUCKET[key]) {
      throw new Error(
        `Existing task_images bucket is incompatible (${key}).`
      );
    }
  }
  if (
    !sameStringSet(
      actual.allowedFileExtensions || [],
      MOSAIC_BUCKET.allowedFileExtensions
    )
  ) {
    throw new Error(
      'Existing task_images bucket is incompatible (allowedFileExtensions).'
    );
  }
  return true;
}

function updateBody() {
  return {
    name: MOSAIC_BUCKET.name,
    permissions: MOSAIC_BUCKET.permissions,
    fileSecurity: MOSAIC_BUCKET.fileSecurity,
    enabled: MOSAIC_BUCKET.enabled,
    maximumFileSize: MOSAIC_BUCKET.maximumFileSize,
    allowedFileExtensions: MOSAIC_BUCKET.allowedFileExtensions,
    compression: MOSAIC_BUCKET.compression,
    encryption: MOSAIC_BUCKET.encryption,
    antivirus: MOSAIC_BUCKET.antivirus,
    transformations: MOSAIC_BUCKET.transformations,
  };
}

export async function migrateTaskImagesBucketPermissions({
  request,
  log = () => {},
}) {
  const path = `/storage/buckets/${MOSAIC_BUCKET.id}`;
  let current;
  try {
    current = await request('GET', path);
  } catch (error) {
    if (Number(error?.status) === 404) {
      throw new Error(
        'task_images bucket is missing. Bootstrap the Mosaic backend before running this migration.'
      );
    }
    throw error;
  }

  assertCompatibleTaskImagesBucket(current);
  const currentPermissions = permissionsOf(current);
  if (sameStringSet(currentPermissions, MOSAIC_BUCKET.permissions)) {
    return { bucketId: MOSAIC_BUCKET.id, changed: false };
  }

  const toleratedLegacyPermissions = [
    ...MOSAIC_BUCKET.permissions,
    'read("users")',
  ];
  if (!sameStringSet(currentPermissions, toleratedLegacyPermissions)) {
    throw new Error(
      'Existing task_images bucket permissions are neither the Mosaic manifest nor the known pre-foundation broad-read state.'
    );
  }

  log('Removing redundant bucket-wide authenticated-user read access...');
  await request('PUT', path, updateBody());

  const updated = await request('GET', path);
  assertCompatibleTaskImagesBucket(updated);
  if (!sameStringSet(permissionsOf(updated), MOSAIC_BUCKET.permissions)) {
    throw new Error('task_images bucket permission reconciliation did not stick.');
  }
  return { bucketId: MOSAIC_BUCKET.id, changed: true };
}
