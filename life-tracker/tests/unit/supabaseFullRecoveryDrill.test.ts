import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const testFile = fileURLToPath(new URL('../../supabase-poc/tests/test_full_recovery_drill.py', import.meta.url));
const source = fileURLToPath(new URL('../../supabase-poc/full-recovery-drill.py', import.meta.url));

describe('full encrypted DB + signed privacy + hosted photo one-command drill', () => {
  it('rehearses every stage, failure cleanup, archive checks and destination restrictions completely offline', () => {
    const run = spawnSync('python3', [testFile], {
      encoding: 'utf8', timeout: 25_000,
      env: { PATH: process.env.PATH ?? '', HOME: '/nonexistent' },
    });
    expect(run.status, run.stderr || run.error?.message).toBe(0);
    expect(run.stderr).toContain('Ran 8 tests');
    expect(run.stderr).toContain('OK');
  });

  it('offers a safe plan preview without backend credentials or network', () => {
    const run = spawnSync('python3', [source, '--plan'], {
      encoding: 'utf8', timeout: 10_000,
      env: { PATH: process.env.PATH ?? '', HOME: '/nonexistent' },
    });
    expect(run.status, run.stderr).toBe(0);
    expect(run.stdout).toContain('MOSAIC_FULL_DR_PLAN_NO_CLOUD_OR_SECRETS_PASS');
    expect(run.stdout.match(/MOSAIC_FULL_DR_PLAN:/g)).toHaveLength(7);
    expect(run.stdout).not.toContain('PGPASSWORD');
  });
});
