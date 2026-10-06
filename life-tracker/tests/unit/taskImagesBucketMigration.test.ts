import { describe, expect, it, vi } from 'vitest';
import { MOSAIC_BUCKET } from '../../infrastructure/mosaic-backend.mjs';
import {
  assertCompatibleTaskImagesBucket,
  migrateTaskImagesBucketPermissions,
} from '../../scripts/migrate-task-images-bucket-permissions.mjs';

function bucket(permissions = MOSAIC_BUCKET.permissions) {
  return {
    $id: MOSAIC_BUCKET.id,
    $permissions: permissions,
    name: MOSAIC_BUCKET.name,
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

describe('task_images bucket permission migration', () => {
  it('is a no-op when bucket permissions already match Git', async () => {
    const request = vi.fn(async () => bucket());
    await expect(
      migrateTaskImagesBucketPermissions({ request })
    ).resolves.toEqual({
      bucketId: MOSAIC_BUCKET.id,
      changed: false,
    });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('removes only the known redundant bucket-wide read permission using a full update', async () => {
    const legacy = bucket([
      ...MOSAIC_BUCKET.permissions,
      'read("users")',
    ]);
    const request = vi
      .fn()
      .mockResolvedValueOnce(legacy)
      .mockResolvedValueOnce(bucket())
      .mockResolvedValueOnce(bucket());

    await expect(
      migrateTaskImagesBucketPermissions({ request })
    ).resolves.toEqual({
      bucketId: MOSAIC_BUCKET.id,
      changed: true,
    });

    expect(request).toHaveBeenNthCalledWith(
      2,
      'PUT',
      `/storage/buckets/${MOSAIC_BUCKET.id}`,
      {
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
      }
    );
  });

  it('fails closed on unknown bucket permission drift', async () => {
    const request = vi.fn(async () =>
      bucket([
        ...MOSAIC_BUCKET.permissions,
        'delete("users")',
      ])
    );
    await expect(
      migrateTaskImagesBucketPermissions({ request })
    ).rejects.toThrow(/neither the Mosaic manifest nor the known/);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('rejects unrelated structural drift before writing', () => {
    expect(() =>
      assertCompatibleTaskImagesBucket({
        ...bucket(),
        encryption: false,
      })
    ).toThrow(/encryption/);
  });
});
