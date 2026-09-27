import { describe, expect, it, vi } from 'vitest';
import {
  checkBackupHealth,
  newestCompletedSnapshot,
} from '../../scripts/dr-health.mjs';
import {
  encryptBuffer,
  sha256Hex,
} from '../../appwrite-functions/dr-backup/crypto.mjs';

function fixture(completedAt = '2026-09-27T10:00:00.000Z') {
  const prefix = 'mosaic-dr/v1';
  const backupId = '20260927T100000000Z';
  const key = Buffer.alloc(32, 3);
  const manifestKey = `${prefix}/snapshots/${backupId}/manifest.json.enc`;
  const manifest = Buffer.from(
    JSON.stringify({
      format: 'mosaic-dr',
      version: 1,
      backupId,
      completedAt,
    })
  );
  const manifestCipher = encryptBuffer(manifest, {
    key,
    keyVersion: 'v1',
    aad: manifestKey,
    compress: true,
  });
  const markerKey = `${prefix}/snapshots/${backupId}/COMPLETED`;
  const marker = Buffer.from(
    JSON.stringify({
      format: 'mosaic-dr',
      version: 1,
      backupId,
      keyVersion: 'v1',
      manifestKey,
      manifestCipherSha256: sha256Hex(manifestCipher),
    })
  );
  const objects = new Map([
    [markerKey, marker],
    [manifestKey, manifestCipher],
  ]);
  return {
    prefix,
    backupId,
    key,
    objects,
    r2: {
      listObjects: vi.fn(async () => [...objects.keys()]),
      getObject: vi.fn(async (objectKey: string) => {
        const value = objects.get(objectKey);
        if (!value) throw new Error('missing');
        return value;
      }),
    },
  };
}

describe('DR stale-backup detection', () => {
  it('selects the newest completed marker only', () => {
    expect(
      newestCompletedSnapshot(
        [
          'mosaic-dr/v1/snapshots/20260926T100000000Z/COMPLETED',
          'mosaic-dr/v1/snapshots/20260927T100000000Z/manifest.json.enc',
          'mosaic-dr/v1/snapshots/20260927T100000000Z/COMPLETED',
        ],
        'mosaic-dr/v1'
      )
    ).toBe('20260927T100000000Z');
  });

  it('accepts a committed authenticated snapshot inside the age window', async () => {
    const x = fixture();
    await expect(
      checkBackupHealth({
        r2: x.r2,
        prefix: x.prefix,
        encryptionKey: x.key,
        maxAgeHours: 36,
        now: new Date('2026-09-27T12:00:00.000Z'),
      })
    ).resolves.toMatchObject({ ok: true, backupId: x.backupId });
  });

  it('fails closed for stale or tampered snapshots', async () => {
    const stale = fixture('2026-09-20T10:00:00.000Z');
    await expect(
      checkBackupHealth({
        r2: stale.r2,
        prefix: stale.prefix,
        encryptionKey: stale.key,
        maxAgeHours: 36,
        now: new Date('2026-09-27T12:00:00.000Z'),
      })
    ).rejects.toThrow(/stale/);

    const tampered = fixture();
    const manifestKey = `${tampered.prefix}/snapshots/${tampered.backupId}/manifest.json.enc`;
    tampered.objects.set(manifestKey, Buffer.from('tampered'));
    await expect(
      checkBackupHealth({
        r2: tampered.r2,
        prefix: tampered.prefix,
        encryptionKey: tampered.key,
        maxAgeHours: 36,
        now: new Date('2026-09-27T12:00:00.000Z'),
      })
    ).rejects.toThrow(/ciphertext hash/);
  });
});
