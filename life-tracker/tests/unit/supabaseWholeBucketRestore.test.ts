import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const testPath = fileURLToPath(new URL('../../supabase-poc/tests/test_restore_private_photo_snapshot.py', import.meta.url));

describe('isolated full private Storage object-byte restore', () => {
  it('rehearses multiple owners, empty bucket, encrypted file tampering, local-only target and nonempty fallback', () => {
    const result = spawnSync('python3', [testPath], {
      encoding: 'utf8', timeout: 25_000,
      env: { PATH: process.env.PATH ?? '', HOME: '/nonexistent' },
    });
    expect(result.status, result.stderr || result.error?.message).toBe(0);
    expect(result.stderr).toContain('Ran 6 tests');
    expect(result.stderr).toContain('OK');
  });
});
