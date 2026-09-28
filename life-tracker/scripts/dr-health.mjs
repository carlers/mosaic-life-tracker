import { createR2Client } from '../appwrite-functions/dr-backup/r2.mjs';
import {
  decodeMasterKey,
  decryptBuffer,
  sha256Hex,
} from '../appwrite-functions/dr-backup/crypto.mjs';
import {
  parseBackupId,
  parseCompletedMarkerKey,
} from '../appwrite-functions/dr-backup/retention.mjs';

export function readHealthConfig(env = process.env) {
  const required = [
    'R2_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_BUCKET',
    'DR_ENCRYPTION_KEY_B64',
  ];
  for (const name of required) {
    if (!env[name]) {
      throw new Error(`Missing required DR health variable: ${name}`);
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
      endpoint: env.R2_ENDPOINT || undefined,
    },
    encryptionKey: decodeMasterKey(env.DR_ENCRYPTION_KEY_B64),
    prefix: (env.DR_PREFIX || 'mosaic-dr/v1').replace(/\/+$/, ''),
    maxAgeHours,
  };
}

export function newestCompletedSnapshot(keys, prefix) {
  return keys
    .map((key) => parseCompletedMarkerKey(key, prefix))
    .filter(Boolean)
    .sort()
    .at(-1) || null;
}

export async function checkBackupHealth({
  r2,
  prefix,
  encryptionKey,
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
  if (
    marker?.format !== 'mosaic-dr' ||
    marker?.version !== 1 ||
    marker?.backupId !== backupId ||
    typeof marker?.manifestKey !== 'string' ||
    typeof marker?.manifestCipherSha256 !== 'string'
  ) {
    throw new Error('Newest Mosaic DR COMPLETED marker is invalid');
  }

  const manifestCipher = await r2.getObject(marker.manifestKey);
  if (sha256Hex(manifestCipher) !== marker.manifestCipherSha256) {
    throw new Error('Newest Mosaic DR manifest ciphertext hash is invalid');
  }
  const decrypted = decryptBuffer(manifestCipher, {
    key: encryptionKey,
    aad: marker.manifestKey,
  });
  if (decrypted.keyVersion !== marker.keyVersion) {
    throw new Error('Newest Mosaic DR manifest key version is invalid');
  }
  const manifest = JSON.parse(decrypted.plain.toString('utf8'));
  if (
    manifest?.format !== 'mosaic-dr' ||
    manifest?.version !== 1 ||
    manifest?.backupId !== backupId
  ) {
    throw new Error('Newest Mosaic DR manifest is invalid');
  }

  const completedAt =
    typeof manifest.completedAt === 'string'
      ? new Date(manifest.completedAt)
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

export async function runHealthCli({
  env = process.env,
  log = console.log,
  now = new Date(),
} = {}) {
  const config = readHealthConfig(env);
  const result = await checkBackupHealth({
    r2: createR2Client(config.r2),
    prefix: config.prefix,
    encryptionKey: config.encryptionKey,
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
  runHealthCli().catch((error) => {
    console.error(
      `DR health check failed: ${error instanceof Error ? error.message : 'unknown error'}`
    );
    process.exitCode = 1;
  });
}
