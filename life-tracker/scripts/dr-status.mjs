import { createR2Client } from '../appwrite-functions/dr-backup/r2.mjs';
import {
  parseBackupId,
  parseCompletedMarkerKey,
} from '../appwrite-functions/dr-backup/retention.mjs';

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing DR status variable: ${name}`);
  return value;
}

const prefix = (process.env.DR_PREFIX || 'mosaic-dr/v1').replace(/\/+$/, '');
const staleHours = Number.parseFloat(process.env.DR_STALE_HOURS || '36');

try {
  if (!Number.isFinite(staleHours) || staleHours <= 0) {
    throw new Error('DR_STALE_HOURS must be a positive number');
  }
  const r2 = createR2Client({
    accountId: required('R2_ACCOUNT_ID'),
    accessKeyId: required('R2_ACCESS_KEY_ID'),
    secretAccessKey: required('R2_SECRET_ACCESS_KEY'),
    bucket: required('R2_BUCKET'),
  });
  const keys = await r2.listObjects(`${prefix}/snapshots/`);
  const candidates = keys
    .map((key) => parseCompletedMarkerKey(key, prefix))
    .filter(Boolean)
    .sort()
    .reverse();

  let latest = null;
  for (const snapshotId of candidates) {
    const markerKey = `${prefix}/snapshots/${snapshotId}/COMPLETED`;
    try {
      const marker = JSON.parse((await r2.getObject(markerKey)).toString('utf8'));
      const manifestHead = await r2.headObject(marker.manifestKey);
      if (
        marker.backupId === snapshotId &&
        manifestHead &&
        manifestHead.metadata['cipher-sha256'] === marker.manifestCipherSha256
      ) {
        latest = snapshotId;
        break;
      }
    } catch {
      // Invalid/incomplete markers do not count as a healthy restore point.
    }
  }

  if (!latest) throw new Error('No valid completed disaster backup found');
  const completedAt = parseBackupId(latest);
  const ageHours = (Date.now() - completedAt.getTime()) / 3_600_000;
  if (ageHours > staleHours) {
    throw new Error(
      `Latest completed backup is stale: ${latest} (${ageHours.toFixed(1)}h)`
    );
  }
  console.log(
    JSON.stringify({
      ok: true,
      latestBackupId: latest,
      ageHours: Number(ageHours.toFixed(2)),
    })
  );
} catch (error) {
  console.error(
    JSON.stringify({
      ok: false,
      error: error instanceof Error ? error.message : 'DR status check failed',
    })
  );
  process.exitCode = 1;
}
