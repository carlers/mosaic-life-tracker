import { createR2Client } from '../appwrite-functions/dr-backup/r2.mjs';
import {
  parseBackupId,
  parseCompletedMarkerKey,
} from '../appwrite-functions/dr-backup/retention.mjs';

export function readWatchConfig(env = process.env) {
  const required = [
    'R2_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_BUCKET',
  ];
  for (const name of required) {
    if (!env[name]) {
      throw new Error(`Missing required DR watch variable: ${name}`);
    }
  }
  const maxAgeHours = Number(env.DR_MAX_AGE_HOURS || 36);
  if (!Number.isFinite(maxAgeHours) || maxAgeHours <= 0) {
    throw new Error('DR_MAX_AGE_HOURS must be a positive number');
  }
  return {
    r2: {
      accountId: env.R2_ACCOUNT_ID,
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      bucket: env.R2_BUCKET,
    },
    prefix: (env.DR_PREFIX || 'mosaic-dr/v1').replace(/\/+$/, ''),
    maxAgeHours,
  };
}

export function newestCompletedSnapshot(keys, prefix) {
  return (
    keys
      .map((key) => parseCompletedMarkerKey(key, prefix))
      .filter(Boolean)
      .sort()
      .at(-1) || null
  );
}

export async function checkBackupWatch({
  r2,
  prefix,
  maxAgeHours = 36,
  now = new Date(),
}) {
  const keys = await r2.listObjects(`${prefix}/snapshots/`);
  const backupId = newestCompletedSnapshot(keys, prefix);
  if (!backupId) {
    throw new Error('No completed Mosaic DR snapshot exists');
  }

  const markerKey = `${prefix}/snapshots/${backupId}/COMPLETED`;
  const marker = JSON.parse((await r2.getObject(markerKey)).toString('utf8'));
  const expectedManifestKey =
    `${prefix}/snapshots/${backupId}/manifest.json.enc`;
  if (
    marker?.format !== 'mosaic-dr' ||
    marker?.version !== 1 ||
    marker?.backupId !== backupId ||
    marker?.manifestKey !== expectedManifestKey ||
    !/^[a-f0-9]{64}$/.test(marker?.manifestCipherSha256 || '')
  ) {
    throw new Error('Newest Mosaic DR COMPLETED marker is invalid');
  }

  const manifestHead = await r2.headObject(marker.manifestKey);
  if (!manifestHead || manifestHead.size <= 0) {
    throw new Error('Newest Mosaic DR manifest object is missing');
  }
  const metadataHash = manifestHead.metadata?.['cipher-sha256'];
  if (
    metadataHash &&
    metadataHash !== marker.manifestCipherSha256
  ) {
    throw new Error('Newest Mosaic DR manifest metadata hash does not match marker');
  }

  const completedAt =
    typeof marker.completedAt === 'string'
      ? new Date(marker.completedAt)
      : parseBackupId(backupId);
  if (!completedAt || Number.isNaN(completedAt.getTime())) {
    throw new Error('Newest Mosaic DR completion time is invalid');
  }

  const ageMs = now.getTime() - completedAt.getTime();
  const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
  if (ageMs < 0 || ageMs > maxAgeMs) {
    throw new Error(
      `Newest completed Mosaic DR snapshot is stale: ${backupId}`
    );
  }

  return {
    ok: true,
    backupId,
    completedAt: completedAt.toISOString(),
    ageHours: ageMs / 3_600_000,
  };
}

export async function runWatchCli({
  env = process.env,
  log = console.log,
  now = new Date(),
} = {}) {
  const config = readWatchConfig(env);
  const result = await checkBackupWatch({
    r2: createR2Client(config.r2),
    prefix: config.prefix,
    maxAgeHours: config.maxAgeHours,
    now,
  });
  log(JSON.stringify(result));
  return result;
}

const isDirectRun =
  process.argv[1] &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (isDirectRun) {
  runWatchCli().catch((error) => {
    console.error(
      `DR backup watch failed: ${
        error instanceof Error ? error.message : 'unknown error'
      }`
    );
    process.exitCode = 1;
  });
}
