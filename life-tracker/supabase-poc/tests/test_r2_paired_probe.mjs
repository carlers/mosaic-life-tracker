import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  checkReadOnlyPair, checkBothPairs, sanitizedError,
} from '../r2-paired-probe.mjs';

const before = 'mosaic-supabase/v1/snapshots/20261028T053525682Z/COMPLETED';
const marker = Buffer.from(JSON.stringify({
  format: 'mosaic-supabase-full-offsite',
  id: '20261028T053525682Z',
  sourceProject: 'hcxtiifzxoaflhjgoglb',
  recoveryProfile: 'ten-personal-bucket-links',
}));

function reader() {
  return {
    async listObjects(prefix) {
      assert.equal(prefix, 'mosaic-supabase/v1/snapshots/');
      return [before];
    },
    async getObject(key) {
      assert.equal(key, before);
      return marker;
    },
    async putObject() { throw Error('PROBE_MUST_NOT_WRITE'); },
    async deleteObject() { throw Error('PROBE_MUST_NOT_DELETE'); },
  };
}

test('read-only paired probe authenticates the exact previous marker without PUT or DELETE', async () => {
  assert.equal(await checkReadOnlyPair(reader()), 'PASS');
});

test('read-only paired probe fails closed on a missing/cross-project marker', async () => {
  assert.equal(await checkReadOnlyPair({ ...reader(), listObjects: async () => [] }),
    'HISTORICAL_MARKER_ABSENT');
  assert.equal(await checkReadOnlyPair({ ...reader(), getObject: async () =>
    Buffer.from('{"format":"wrong"}') }), 'HISTORICAL_MARKER_MISMATCH');
  assert.equal(await checkReadOnlyPair({ ...reader(), getObject: async () => Buffer.alloc(65537) }),
    'HISTORICAL_MARKER_MISMATCH');
});

test('R2 credentials compared independently against the same fixed bucket', async () => {
  const created = [];
  const result = await checkBothPairs({
    accountId: 'a'.repeat(32),
    reader: { id: 'R'.repeat(24), secret: 'reader-secret-123456789' },
    writer: { id: 'W'.repeat(24), secret: 'writer-secret-123456789' },
    clientFactory: options => {
      created.push(options);
      return options.accessKeyId.startsWith('R') ? reader() : {
        ...reader(), listObjects: async () => {
          throw Error('R2 GET failed with HTTP 403 code=SignatureDoesNotMatch');
        },
      };
    },
  });
  assert.deepEqual(result, { reader: 'PASS', writer: 'HTTP_403_SIGNATURE_MISMATCH' });
  assert.deepEqual(created.map(x => x.bucket), ['mosaic-supabase-backups', 'mosaic-supabase-backups']);
  assert.deepEqual(created.map(x => x.accountId), ['a'.repeat(32), 'a'.repeat(32)]);
});

test('bad or shared credential pairs fail before any remote R2 call', async () => {
  let count = 0;
  for (const readerPair of [
    { id: 'R'.repeat(24), secret: 'same-secret-value-1234' },
    { id: 'W'.repeat(24), secret: 'reader-secret-123456789' },
    { id: 'bad', secret: 'reader-secret-123456789' },
  ]) {
    const result = await checkBothPairs({
      accountId: 'a'.repeat(32),
      reader: readerPair,
      writer: { id: 'W'.repeat(24), secret: 'same-secret-value-1234' },
      clientFactory: () => { count++; return reader(); },
    });
    assert.deepEqual(result, { reader: 'UNVERIFIED', writer: 'UNVERIFIED' });
  }
  assert.equal(count, 0);
});

test('privileged provider errors are mapped to fixed codes, not echoed', () => {
  assert.equal(sanitizedError(Error('R2 GET failed with HTTP 403 code=SignatureDoesNotMatch')),
    'HTTP_403_SIGNATURE_MISMATCH');
  assert.equal(sanitizedError(Error('R2 GET failed with HTTP 403 code=AccessDenied')),
    'HTTP_403_ACCESS_DENIED');
  assert.equal(sanitizedError(Error('R2 GET failed with HTTP 403 code=Untrusted-Key-123')),
    'UNVERIFIED');
  assert.equal(sanitizedError(Error('Secret Access Key=example')), 'UNVERIFIED');
});

test('direct CLI without credentials produces only allowlisted not-verified output', () => {
  const file = fileURLToPath(new URL('../r2-paired-probe.mjs', import.meta.url));
  const out = spawnSync(process.execPath, [file, '--run'], {
    encoding: 'utf8', timeout: 10000, env: { PATH: process.env.PATH ?? '' },
  });
  assert.equal(out.status, 1);
  assert.equal(out.stderr, '');
  assert.deepEqual(out.stdout.trim().split('\n'), [
    'MOSAIC_R2_READER_READ_CHECK_UNVERIFIED',
    'MOSAIC_R2_WRITER_READ_CHECK_UNVERIFIED',
    'MOSAIC_R2_CREDENTIAL_PAIR_NOT_VERIFIED',
  ]);
});
