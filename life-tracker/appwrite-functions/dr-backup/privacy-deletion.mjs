import { Buffer } from 'node:buffer';
import {
  parseBackupJson,
  putEncrypted,
  readBackupConfig,
  stringifyBackupJson,
} from './backup.mjs';
import {
  decryptBuffer,
  readEnvelopeKeyVersion,
  sha256Hex,
} from './crypto.mjs';
import { createR2Client } from './r2.mjs';

const USER_ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,35}$/;

export function privacyDeletionKey(prefix, userId) {
  const digest = sha256Hex(Buffer.from(userId, 'utf8'));
  return `${prefix}/privacy-deletions/${digest}.json.enc`;
}

async function verifyExistingPrivacyDeletion(r2, key, userId, config) {
  const encrypted = await r2.getObject(key);
  const keyVersion = readEnvelopeKeyVersion(encrypted);
  const verificationKey =
    config.encryptionKeys?.get?.(keyVersion) ||
    (keyVersion === config.keyVersion ? config.encryptionKey : null);
  if (!verificationKey) {
    throw new Error(
      `Missing DR encryption key for privacy marker version ${keyVersion}`
    );
  }
  const decrypted = decryptBuffer(encrypted, {
    key: verificationKey,
    aad: key,
  });
  const marker = parseBackupJson(decrypted.plain.toString('utf8'));
  if (
    marker?.format !== 'mosaic-dr-privacy-deletion' ||
    marker?.version !== 1 ||
    marker?.userId !== userId ||
    typeof marker?.deletedAt !== 'string' ||
    !marker.deletedAt
  ) {
    throw new Error('Existing privacy deletion marker is invalid');
  }
  return {
    ok: true,
    key,
    reused: true,
    keyVersion: decrypted.keyVersion,
  };
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

  // Privacy markers sit under the object-lock prefix and use a deterministic
  // key. Retries must verify/reuse the immutable marker rather than overwrite
  // it, otherwise a successful first write can make every later retry fail
  // with an R2 object-lock conflict.
  if (await r2.headObject(key)) {
    return verifyExistingPrivacyDeletion(r2, key, userId, config);
  }

  const plain = Buffer.from(
    stringifyBackupJson({
      format: 'mosaic-dr-privacy-deletion',
      version: 1,
      userId,
      deletedAt: now.toISOString(),
    }),
    'utf8'
  );

  try {
    await putEncrypted(r2, key, plain, {
      encryptionKey: config.encryptionKey,
      keyVersion: config.keyVersion,
      compress: true,
      stagePrefix: 'privacy_deletion',
    });
  } catch (error) {
    // Two accepted retries may race after both observe the marker as missing.
    // If another writer won, authenticate its marker and treat this retry as
    // success. If no valid marker exists, preserve the original failure.
    if (await r2.headObject(key).catch(() => null)) {
      return verifyExistingPrivacyDeletion(r2, key, userId, config);
    }
    throw error;
  }

  return { ok: true, key, reused: false };
}
