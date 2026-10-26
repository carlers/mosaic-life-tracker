/**
 * #1027 offline age encryption of an already owner-verified history inventory.
 * No plaintext filesystem writes, no remote connections and no overwrite.
 * Not a source-ownership validator: caller must use the signed full-history
 * classifier, independently authenticate its source SHA and counts first.
 */
import { randomBytes, createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { open, readFile, stat, realpath, link, unlink } from 'node:fs/promises';
import { dirname, basename, isAbsolute } from 'node:path';

const SHA = /^[a-f0-9]{64}$/;
const RECIPIENT = /^age1[a-z0-9]{58}$/;
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_LINKS = 250_000;
function validate(payload) {
  if (!payload || payload.format !== 'mosaic-owner-bucket-link-history' ||
      payload.version !== 1 ||
      typeof payload.owner?.legacyUserId !== 'string' || !payload.owner.legacyUserId ||
      typeof payload.owner?.supabaseUserId !== 'string' || !payload.owner.supabaseUserId ||
      !SHA.test(payload.sourceArchiveSha256) || !SHA.test(payload.targetIdentitySha256) ||
      !Array.isArray(payload.links) || payload.links.length > MAX_LINKS ||
      payload.sourceCounts?.links !== payload.links.length)
    throw new Error('Refusing unverified historical owner inventory envelope');
  for (const entry of payload.links) {
    if (!entry?.source || entry.source.userId !== payload.owner.legacyUserId ||
        !['ready', 'tombstone', 'quarantined'].includes(entry.disposition) ||
        !Array.isArray(entry.reasons))
      throw new Error('Historical link source owner or disposition mismatch');
  }
}

/** Exclusive, atomic link() publication of a 0600 age ciphertext only.
 * The destination directory must already be private (0700), owned by the
 * current process and not a symlink. Never emit source records to stdout.
 */
export async function encryptOwnerHistory(payload, options) {
  validate(payload);
  const { recipient, destination } = options ?? {};
  const binary = options?.ageExecutable ?? '/usr/bin/age';
  if (!RECIPIENT.test(recipient) || typeof destination !== 'string' ||
      !isAbsolute(destination) ||
      !/^[A-Za-z0-9_.-]+\.age$/.test(basename(destination)) ||
      !isAbsolute(binary) || basename(binary) !== 'age')
    throw new Error('Invalid age recipient or private ciphertext destination');
  const dir = dirname(destination);
  const info = await stat(dir);
  if (!info.isDirectory() || (info.mode & 0o077) !== 0 ||
      (process.getuid && info.uid !== process.getuid()) ||
      await realpath(dir) !== dir)
    throw new Error('Historical owner ciphertext requires a private real directory');
  const clear = Buffer.from(JSON.stringify(payload), 'utf8');
  if (!clear.length || clear.length > MAX_BYTES) {
    clear.fill(0);
    throw new Error('Historical owner inventory exceeds encrypted ledger limit');
  }
  const temp = dir + '/.mosaic-owner-history-' + randomBytes(12).toString('hex') + '.tmp';
  let file;
  try {
    file = await open(temp, 'wx', 0o600);
    await new Promise((resolve, reject) => {
      const child = spawn(binary, ['-r', recipient], {
        stdio: ['pipe', file.fd, 'ignore'],
        env: { PATH: process.env.PATH ?? '/usr/bin:/bin' },
      });
      child.stdin?.on('error', () => { /* child exit reports failure */ });
      child.once('error', () => reject(new Error('Unable to run private age encryption')));
      child.once('close', code => code === 0 ? resolve() :
        reject(new Error('Private age encryption failed')));
      child.stdin?.end(clear);
    });
    await file.sync();
    await file.close();
    file = undefined;
    const encrypted = await readFile(temp);
    if (encrypted.length < 32 ||
        !encrypted.subarray(0, 25).toString('utf8').startsWith('age-encryption.org/v1'))
      throw new Error('Private archive is not an age ciphertext');
    const sha256 = createHash('sha256').update(encrypted).digest('hex');
    const bytes = encrypted.length;
    // Unlike rename(), link() will not replace an existing destination.
    await link(temp, destination);
    await unlink(temp);
    return { sha256, bytes };
  } finally {
    clear.fill(0);
    if (file) await file.close().catch(() => {});
    await unlink(temp).catch(() => {});
  }
}
