import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const testFile = fileURLToPath(new URL('../../supabase-poc/tests/test_private_media_offsite.mjs', import.meta.url));

describe('Supabase offsite private photo ciphertext, watchdog and retention', () => {
  it('enforces committed-only restores, exact readback, no-prune on incomplete, and retained recoverable generations', () => {
    const result = spawnSync(process.execPath, ['--test', testFile], {
      encoding: 'utf8', timeout: 20_000,
      env: { PATH: process.env.PATH ?? '', HOME: '/nonexistent' },
    });
    expect(result.status, result.stderr || result.stdout || result.error?.message).toBe(0);
    expect(result.stdout).toContain('# pass 6');
    expect(result.stdout).toContain('# fail 0');
  });
});
