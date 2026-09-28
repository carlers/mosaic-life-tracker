import { describe, expect, it, vi } from 'vitest';
import {
  checkBackupWatch,
  newestCompletedSnapshot,
} from '../../scripts/dr-watch.mjs';

function fixture({
  completedAt = '2026-09-27T10:00:00.000Z',
  metadataHash = 'a'.repeat(64),
} = {}) {
  const prefix = 'mosaic-dr/v1';
  const backupId = '20260927T100000000Z';
  const manifestKey =
    `${prefix}/snapshots/${backupId}/manifest.json.enc`;
  const markerKey = `${prefix}/snapshots/${backupId}/COMPLETED`;
  const marker = Buffer.from(
    JSON.stringify({
      format: 'mosaic-dr',
      version: 1,
      backupId,
      keyVersion: 'v1',
      completedAt,
      manifestKey,
      manifestCipherSha256: 'a'.repeat(64),
    })
  );
  return {
    prefix,
    backupId,
    markerKey,
    manifestKey,
    r2: {
      listObjects: vi.fn(async () => [markerKey, manifestKey]),
      getObject: vi.fn(async (key: string) => {
        if (key !== markerKey) throw new Error('unexpected object read');
        return marker;
      }),
      headObject: vi.fn(async (key: string) => {
        if (key !== manifestKey) return null;
        return {
          size: 123,
          metadata: { 'cipher-sha256': metadataHash },
        };
      }),
    },
  };
}

describe('DR external backup watch', () => {
  it('selects only the newest completed snapshot marker', () => {
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

  it('passes without the backup encryption key when marker and manifest metadata agree', async () => {
    const x = fixture();
    await expect(
      checkBackupWatch({
        r2: x.r2,
        prefix: x.prefix,
        maxAgeHours: 36,
        now: new Date('2026-09-27T12:00:00.000Z'),
      })
    ).resolves.toMatchObject({
      ok: true,
      backupId: x.backupId,
      ageHours: 2,
    });
  });

  it('fails for stale completed snapshots', async () => {
    const x = fixture({ completedAt: '2026-09-20T10:00:00.000Z' });
    await expect(
      checkBackupWatch({
        r2: x.r2,
        prefix: x.prefix,
        maxAgeHours: 36,
        now: new Date('2026-09-27T12:00:00.000Z'),
      })
    ).rejects.toThrow(/stale/);
  });

  it('fails when the manifest object is missing or its stored hash disagrees', async () => {
    const missing = fixture();
    missing.r2.headObject = vi.fn(async () => null);
    await expect(
      checkBackupWatch({
        r2: missing.r2,
        prefix: missing.prefix,
        now: new Date('2026-09-27T12:00:00.000Z'),
      })
    ).rejects.toThrow(/manifest object is missing/);

    const mismatch = fixture({ metadataHash: 'b'.repeat(64) });
    await expect(
      checkBackupWatch({
        r2: mismatch.r2,
        prefix: mismatch.prefix,
        now: new Date('2026-09-27T12:00:00.000Z'),
      })
    ).rejects.toThrow(/metadata hash/);
  });
});
