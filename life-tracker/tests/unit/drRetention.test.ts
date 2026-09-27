import { describe, expect, it } from 'vitest';
import {
  parseCompletedMarkerKey,
  selectRetainedSnapshotIds,
} from '../../appwrite-functions/dr-backup/retention.mjs';

function id(iso: string) {
  return iso.replace(/[-:.]/g, '').replace('Z', 'Z');
}

describe('DR snapshot retention', () => {
  it('parses only completed snapshot markers under the configured prefix', () => {
    expect(
      parseCompletedMarkerKey(
        'mosaic-dr/v1/snapshots/20260927T010000000Z/COMPLETED',
        'mosaic-dr/v1'
      )
    ).toBe('20260927T010000000Z');
    expect(
      parseCompletedMarkerKey(
        'mosaic-dr/v1/snapshots/20260927T010000000Z/manifest.enc',
        'mosaic-dr/v1'
      )
    ).toBeNull();
  });

  it('keeps recent locked snapshots plus daily, weekly, and monthly tiers', () => {
    const now = new Date('2026-09-27T12:00:00.000Z');
    const snapshots: string[] = [];
    for (let day = 0; day < 80; day++) {
      snapshots.push(id(new Date(now.getTime() - day * 86_400_000).toISOString()));
    }
    for (let month = 3; month <= 8; month++) {
      snapshots.push(id(new Date(Date.UTC(2026, month - 1, 1, 1)).toISOString()));
    }

    const kept = selectRetainedSnapshotIds(snapshots, {
      now,
      daily: 7,
      weekly: 4,
      monthly: 6,
      lockDays: 30,
    });

    const recentCutoff = now.getTime() - 30 * 86_400_000;
    for (const snapshotId of snapshots) {
      const parsed = new Date(
        snapshotId.replace(
          /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(\d{3})Z$/,
          '$1-$2-$3T$4:$5:$6.$7Z'
        )
      );
      if (parsed.getTime() >= recentCutoff) {
        expect(kept.has(snapshotId)).toBe(true);
      }
    }

    expect(kept.size).toBeGreaterThanOrEqual(30);
    expect(kept.size).toBeLessThan(snapshots.length);
  });
});
