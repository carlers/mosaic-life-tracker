import { Buffer } from 'node:buffer';
import {
  putEncrypted,
  readBackupConfig,
  stringifyBackupJson,
} from './backup.mjs';
import { sha256Hex } from './crypto.mjs';
import { createR2Client } from './r2.mjs';

const USER_ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,35}$/;

export function privacyDeletionKey(prefix, userId) {
  const digest = sha256Hex(Buffer.from(userId, 'utf8'));
  return `${prefix}/privacy-deletions/${digest}.json.enc`;
}

export async function recordPrivacyDeletion(
  userId,
  {
    config = readBackupConfig(),
    r2: injectedR2,
    now = new Date(),
  } = {}
) {
  if (typeof userId !== 'string' || !USER_ID_RE.test(userId)) {
    throw new Error('Invalid privacy deletion user ID');
  }

  const r2 = injectedR2 || createR2Client(config.r2);
  const key = privacyDeletionKey(config.prefix, userId);
  const plain = Buffer.from(
    stringifyBackupJson({
      format: 'mosaic-dr-privacy-deletion',
      version: 1,
      userId,
      deletedAt: now.toISOString(),
    }),
    'utf8'
  );

  await putEncrypted(r2, key, plain, {
    encryptionKey: config.encryptionKey,
    keyVersion: config.keyVersion,
    compress: true,
    stagePrefix: 'privacy_deletion',
  });

  return { ok: true, key };
}
