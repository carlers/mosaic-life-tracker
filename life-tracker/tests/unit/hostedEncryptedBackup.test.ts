import { afterEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('../../supabase-poc/hosted-encrypted-backup.sh', import.meta.url));
const created: string[] = [];
afterEach(() => {
  for (const root of created.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'mosaic-encrypted-backup-test-'));
  created.push(root);
  const bin = join(root, 'bin');
  const archiveDir = join(root, 'archives');
  const key = join(root, 'private.agekey');
  mkdirSync(bin);
  mkdirSync(archiveDir);
  writeFileSync(key, 'mock private key');
  const binaries: Record<string, string> = {
    pg_dump: '#!/usr/bin/env bash\nhead -c 4000000 /dev/zero\n',
    age: [
      '#!/usr/bin/env bash',
      'if [[ "$1" == "--encrypt" ]]; then cat',
      'elif [[ "$MOCK_AGE_CORRUPT" == 1 ]]; then exit 3',
      'else cat "$4"; fi',
      '',
    ].join('\n'),
    pg_restore: [
      '#!/usr/bin/env bash',
      'if [[ "$MOCK_RESTORE_BAD" == 1 ]]; then exit 7; fi',
      '# Only read an archive header; the decrypt producer gets SIGPIPE.',
      'head -c 128 > /dev/null',
      '',
    ].join('\n'),
  };
  for (const [name, source] of Object.entries(binaries)) {
    const path = join(bin, name);
    writeFileSync(path, source);
    chmodSync(path, 0o700);
  }
  const env = {
    ...process.env,
    PATH: bin + ':' + process.env.PATH,
    PGHOST: 'aws-0-ap-southeast-1.pooler.supabase.com',
    PGUSER: 'postgres.hcxtiifzxoaflhjgoglb',
    PGDATABASE: 'postgres',
    PGPASSWORD: 'fixture-only',
    MOSAIC_AGE_IDENTITY_FILE: key,
    MOSAIC_AGE_RECIPIENT: 'age1fixture',
  };
  const run = (name: string, overrides: Record<string, string> = {}) => {
    const out = join(archiveDir, name);
    const proc = spawnSync('bash', [SCRIPT, out], {
      env: { ...env, ...overrides }, encoding: 'utf8', timeout: 15_000,
    });
    return { ...proc, out };
  };
  return { run };
}

describe('mosaic-dev encrypted backup safety', () => {
  it('publishes a private ciphertext archive despite expected metadata-reader SIGPIPE', () => {
    const { run } = fixture();
    const result = run('valid.age');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Encrypted snapshot created');
    expect(existsSync(result.out)).toBe(true);
    expect(statSync(result.out).size).toBe(4_000_000);
    expect(statSync(result.out).mode & 0o777).toBe(0o600);

    const again = run('valid.age');
    expect(again.status).not.toBe(0);
    expect(statSync(result.out).size).toBe(4_000_000);
  });

  it('never publishes ciphertext when complete decryption fails', () => {
    const { run } = fixture();
    const result = run('bad-decrypt.age', { MOCK_AGE_CORRUPT: '1' });
    expect(result.status).not.toBe(0);
    expect(existsSync(result.out)).toBe(false);
  });

  it('never publishes ciphertext when pg_restore metadata validation fails', () => {
    const { run } = fixture();
    const result = run('bad-archive.age', { MOCK_RESTORE_BAD: '1' });
    expect(result.status).not.toBe(0);
    expect(existsSync(result.out)).toBe(false);
  });

  it('rejects non-mosaic-dev database hosts before reading a source', () => {
    const { run } = fixture();
    const result = run('wrong-source.age', { PGHOST: 'db.other.supabase.co' });
    expect(result.status).toBe(2);
    expect(existsSync(result.out)).toBe(false);
  });
});
