import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const pythonTest = fileURLToPath(new URL('../../supabase-poc/tests/test_private_photo_snapshot.py', import.meta.url));

describe('Supabase private Storage encrypted snapshot safety', () => {
  it('verifies byte-exact archive, inventory fence, tamper refusal and secret-key headers offline', () => {
    const result = spawnSync('python3', [pythonTest], {
      encoding: 'utf8', timeout: 15_000,
      env: { PATH: process.env.PATH ?? '', HOME: '/nonexistent' },
    });
    expect(result.status, result.stderr || result.error?.message).toBe(0);
    expect(result.stderr).toContain('Ran 6 tests');
    expect(result.stderr).toContain('OK');
  });
});
