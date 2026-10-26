import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const fixture = fileURLToPath(new URL('../../supabase-poc/tests/test_restore_unified_r2.py', import.meta.url));

describe('Supabase unified R2 exact generation seven/eight/ten-table independent restoration', () => {
  it('refuses mismatched marker/profile and insecure inputs before restoring any owner data', () => {
    const result = spawnSync('python3', [fixture], {
      encoding: 'utf8', timeout: 30_000,
      env: { PATH: process.env.PATH ?? '', HOME: '/nonexistent' },
    });
    expect(result.status, result.stderr || result.stdout || result.error?.message).toBe(0);
    expect(result.stderr).toContain('Ran 13 tests');
    expect(result.stderr).toContain('OK');
  });
});
