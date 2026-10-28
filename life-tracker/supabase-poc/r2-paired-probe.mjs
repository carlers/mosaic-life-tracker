#!/usr/bin/env node
/**
 * #1027 trusted, read-only R2 S3 credential-pair differential check.
 *
 * No Supabase, Docker, PostgreSQL, R2 PUT/DELETE, source capture or object
 * publication. Reuses the exact proven AWS SigV4 client. Emits only fixed
 * safe result tokens; NEVER log errors, responses, keys or object content.
 */
import { createR2Client } from '../appwrite-functions/dr-backup/r2.mjs';
import { safeR2HttpClass } from './unified-offsite.mjs';

const BUCKET = 'mosaic-supabase-backups';
const ACCOUNT = /^[a-f0-9]{32}$/;
const ACCESS = /^[A-Za-z0-9]{16,128}$/;
const BEFORE = 'mosaic-supabase/v1/snapshots/20261028T053525682Z/COMPLETED';
const PREFIX = 'mosaic-supabase/v1/snapshots/';
const ALLOWED = new Set([
  'HTTP_403_SIGNATURE_MISMATCH', 'HTTP_403_ACCESS_DENIED',
  'HTTP_401_UNAUTHORIZED', 'HTTP_404_BUCKET_NOT_FOUND',
  'HTTP_403_EXPIRED', 'HTTP_429_RATE_LIMIT',
  'HTTP_500_SERVER_ERROR', 'HTTP_503_SERVICE_UNAVAILABLE',
]);

export function sanitizedError(error) {
  const code = safeR2HttpClass(error);
  return ALLOWED.has(code) ? code : 'UNVERIFIED';
}

export async function checkReadOnlyPair(r2) {
  try {
    const keys = await r2.listObjects(PREFIX);
    if (!keys.includes(BEFORE)) return 'HISTORICAL_MARKER_ABSENT';
    const raw = await r2.getObject(BEFORE);
    if (raw.length > 65536) return 'HISTORICAL_MARKER_MISMATCH';
    const marker = JSON.parse(raw.toString('utf8'));
    return marker?.format === 'mosaic-supabase-full-offsite' &&
      marker?.id === '20261028T053525682Z' &&
      marker?.sourceProject === 'hcxtiifzxoaflhjgoglb' &&
      marker?.recoveryProfile === 'ten-personal-bucket-links'
      ? 'PASS' : 'HISTORICAL_MARKER_MISMATCH';
  } catch (error) {
    return sanitizedError(error);
  }
}

export async function checkBothPairs({ accountId, reader, writer, clientFactory = createR2Client }) {
  if (!ACCOUNT.test(accountId || '') ||
      !ACCESS.test(reader?.id || '') || !ACCESS.test(writer?.id || '') ||
      !reader?.secret || !writer?.secret ||
      reader.id === writer.id || reader.secret === writer.secret) {
    return { reader: 'UNVERIFIED', writer: 'UNVERIFIED' };
  }
  const result = {};
  for (const [role, pair] of [['reader', reader], ['writer', writer]]) {
    try {
      const r2 = clientFactory({
        accountId, bucket: BUCKET, accessKeyId: pair.id,
        secretAccessKey: pair.secret,
      });
      result[role] = await checkReadOnlyPair(r2);
    } catch (error) {
      result[role] = sanitizedError(error);
    }
  }
  return result;
}

async function main() {
  if (process.argv.slice(2).join(' ') !== '--run') {
    process.stdout.write('MOSAIC_R2_PAIRED_PROBE_USAGE_STOP\n');
    process.exitCode = 1;
    return;
  }
  const env = process.env;
  const result = await checkBothPairs({
    accountId: env.MOSAIC_R2_ACCOUNT_ID,
    reader: { id: env.MOSAIC_R2_READER_ACCESS_KEY_ID, secret: env.MOSAIC_R2_READER_SECRET_ACCESS_KEY },
    writer: { id: env.MOSAIC_R2_WRITER_ACCESS_KEY_ID, secret: env.MOSAIC_R2_WRITER_SECRET_ACCESS_KEY },
  });
  process.stdout.write('MOSAIC_R2_READER_READ_CHECK_' + result.reader + '\n');
  process.stdout.write('MOSAIC_R2_WRITER_READ_CHECK_' + result.writer + '\n');
  if (result.reader === 'PASS' && result.writer === 'PASS') {
    process.stdout.write('MOSAIC_R2_BOTH_CREDENTIAL_PAIRS_READ_ONLY_PASS\n');
  } else {
    process.stdout.write('MOSAIC_R2_CREDENTIAL_PAIR_NOT_VERIFIED\n');
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  main().catch(() => {
    process.stdout.write('MOSAIC_R2_PAIRED_PROBE_NOT_VERIFIED\n');
    process.exitCode = 1;
  });
}
