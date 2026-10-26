// Disposable synthetic owner-history age encryption + real decrypt verification.
import assert from 'node:assert/strict';
import { mkdtemp, chmod, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { encryptOwnerHistory } from '../encrypted-owner-history.mjs';
import { verifyEncryptedOwnerHistory } from '../verify-encrypted-owner-history.mjs';

assert.equal(process.env.GITHUB_ACTIONS, 'true');
assert.match(process.env.RUNNER_TEMP ?? '', /^\/home\/runner\/work\/_temp$/);
const tmp = await mkdtemp(join(process.env.RUNNER_TEMP, 'mosaic-link-ledger-'));
await chmod(tmp, 0o700);
const check = (args, input) => {
  const p = spawnSync(args[0], args.slice(1), {
    input, encoding: null, maxBuffer: 4 * 1024 * 1024,
  });
  assert.equal(p.status, 0, 'Disposable age command failed');
  return p.stdout;
};
const now = '2026-10-26T00:00:00Z';
const source = (id, taskId, isDeleted) => ({
  id, userId: 'synthetic_owner', bucketListId: 'goal_1', taskId,
  createdAt: now, updatedAt: now, isDeleted,
});
const payload = {
  format: 'mosaic-owner-bucket-link-history', version: 1,
  owner: { legacyUserId: 'synthetic_owner',
    supabaseUserId: '11111111-1111-4111-8111-111111111111' },
  sourceArchiveSha256: 'a'.repeat(64),
  targetIdentitySha256: 'b'.repeat(64),
  sourceCounts: { tasks: 2, buckets: 1, links: 3 },
  links: [
    { source: source('link_1', 'task_1', false), disposition: 'ready', reasons: [] },
    { source: source('link_2', 'task_2', true), disposition: 'tombstone', reasons: [] },
    { source: source('link_3', 't'.repeat(255), true), disposition: 'quarantined',
      reasons: ['long-task-reference'] },
  ],
};
try {
  const key = join(tmp, 'synthetic.agekey');
  check(['/usr/bin/age-keygen', '-o', key]);
  const recipient = check(['/usr/bin/age-keygen', '-y', key]).toString('utf8').trim();
  const out = join(tmp, 'synthetic-history.age');
  const result = await encryptOwnerHistory(payload, { recipient, destination: out });
  const cipher = await readFile(out);
  assert.equal(result.sha256, createHash('sha256').update(cipher).digest('hex'));
  assert.equal(result.bytes, cipher.length);
  assert.equal((await stat(out)).mode & 0o777, 0o600);
  const decrypted = check(['/usr/bin/age', '-d', '-i', key, out]);
  assert.deepEqual(decrypted, Buffer.from(JSON.stringify(payload), 'utf8'));
  assert.equal(JSON.parse(decrypted.toString('utf8')).links[2].source.taskId.length, 255);
  const expectedManifestSha256 = createHash('sha256')
    .update(Buffer.from(JSON.stringify(payload), 'utf8')).digest('hex');
  const proof = {
    archivePath: out, identityPath: key,
    expectedCipherSha256: result.sha256,
    expectedManifestSha256,
    expectedSourceArchiveSha256: payload.sourceArchiveSha256,
    expectedTargetIdentitySha256: payload.targetIdentitySha256,
    expectedOwner: payload.owner, expectedCounts: payload.sourceCounts,
  };
  const verified = await verifyEncryptedOwnerHistory(proof);
  assert.deepEqual(verified.counts, payload.sourceCounts);
  assert.deepEqual(verified.dispositionCounts, {
    ready: 1, tombstone: 1, quarantined: 1,
  });
  await assert.rejects(verifyEncryptedOwnerHistory({
    ...proof, expectedManifestSha256: '0'.repeat(64),
  }), /manifest/);
  await assert.rejects(verifyEncryptedOwnerHistory({
    ...proof, expectedOwner: { ...payload.owner, legacyUserId: 'foreign_owner' },
  }), /source witness/);
  await assert.rejects(verifyEncryptedOwnerHistory({
    ...proof, expectedSourceArchiveSha256: '1'.repeat(64),
  }), /source witness/);
  await assert.rejects(verifyEncryptedOwnerHistory({
    ...proof, expectedTargetIdentitySha256: '1'.repeat(64),
  }), /source witness/);
  await assert.rejects(verifyEncryptedOwnerHistory({
    ...proof, expectedCounts: { ...payload.sourceCounts, links: 2 },
  }), /source witness/);
  const duplicate = {
    ...payload,
    links: [payload.links[0], payload.links[1], {
      ...payload.links[0], source: { ...payload.links[0].source },
    }],
  };
  const dupePath = join(tmp, 'duplicate-history.age');
  const dupeResult = await encryptOwnerHistory(duplicate, {
    recipient, destination: dupePath,
  });
  await assert.rejects(verifyEncryptedOwnerHistory({
    ...proof, archivePath: dupePath,
    expectedCipherSha256: dupeResult.sha256,
    expectedManifestSha256: createHash('sha256')
      .update(Buffer.from(JSON.stringify(duplicate),'utf8')).digest('hex'),
  }), /duplicate/);
  await rm(dupePath);
  // No extra decrypted files, source records or private identifiers are
  // persisted by the readback tool, even for rejected archives.
  await assert.rejects(encryptOwnerHistory(payload, {
    recipient, destination: out,
  }), { code: 'EEXIST' });
  assert.deepEqual(await readFile(out), cipher);
  await assert.rejects(encryptOwnerHistory({
    ...payload, links: [{ ...payload.links[0],
      source: { ...payload.links[0].source, userId: 'foreign' } }],
    sourceCounts: { ...payload.sourceCounts, links: 1 },
  }, { recipient, destination: join(tmp, 'bad-owner.age') }), /owner/);
  await assert.rejects(encryptOwnerHistory({
    ...payload, sourceCounts: { ...payload.sourceCounts, links: 2 },
  }, { recipient, destination: join(tmp, 'partial.age') }), /inventory/);
  await assert.rejects(encryptOwnerHistory(payload, {
    recipient: 'bad-recipient', destination: join(tmp, 'bad-key.age'),
  }), /recipient/);
  await assert.rejects(encryptOwnerHistory(payload, {
    recipient, destination: join(tmp, 'missing-age.age'),
    ageExecutable: '/not-found/age',
  }), /age encryption/);
  const names = await readdir(tmp);
  assert.deepEqual(names.sort(), ['synthetic-history.age', 'synthetic.agekey'].sort());
  console.log('MOSAIC_OWNER_HISTORY_AGE_ENCRYPTED_DECRYPTED_PASS');
} finally {
  await rm(tmp, { recursive: true, force: true });
}
