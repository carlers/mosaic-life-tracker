import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('../../supabase-poc/restore-unified-r2.py', import.meta.url));
const tests = fileURLToPath(new URL('../../supabase-poc/tests/test_restore_unified_r2.py', import.meta.url));

describe('exact completed Supabase R2 PostgreSQL + private Storage recovery', () => {
  it('simulates exact read-only R2 retrieval, authenticates both age archives, restores and disposes safely offline', () => {
    const result = spawnSync('python3', [tests], {
      encoding: 'utf8', timeout: 25_000, env: { PATH: process.env.PATH ?? '', HOME: '/nonexistent' },
    });
    expect(result.status, result.stderr || result.error?.message).toBe(0);
    expect(result.stderr).toContain('Ran 16 tests');
    expect(result.stderr).toContain('OK');
  });

  it('documents a no-secret no-network dry-run before Fedora execution', () => {
    const result = spawnSync('python3', [source, '--plan'], {
      encoding: 'utf8', timeout: 10_000, env: { PATH: process.env.PATH ?? '', HOME: '/nonexistent' },
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('MOSAIC_R2_RESTORE_PLAN_NO_CLOUD_OR_SECRETS_PASS');
    expect(result.stdout.match(/MOSAIC_R2_RESTORE_PLAN:/g)).toHaveLength(7);
  });
});
