import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const lock = fileURLToPath(new URL('../../supabase-poc/tests/test_r2_lock_audit.py', import.meta.url));
const lockCli = fileURLToPath(new URL('../../supabase-poc/r2-lock-audit.py', import.meta.url));
const alerts = fileURLToPath(new URL('../../supabase-poc/tests/test_dr_alert.mjs', import.meta.url));

describe('Supabase Scratch R2 native lock and failure email safeguards', () => {
  it('rejects insufficient Cloudflare lock rules and never mutates the provider', () => {
    const result = spawnSync('python3', [lock], {
      encoding: 'utf8', timeout: 20_000,
      env: { PATH: process.env.PATH ?? '', HOME: '/nonexistent' },
    });
    expect(result.status, result.stderr || result.error?.message).toBe(0);
    expect(result.stderr).toContain('Ran 8 tests');
    expect(result.stderr).toContain('OK');
  });

  it('offers safe no-network native bucket lock plan', () => {
    const result = spawnSync('python3', [lockCli, '--plan'], {
      encoding: 'utf8', timeout: 10_000,
      env: { PATH: process.env.PATH ?? '', HOME: '/nonexistent' },
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('MOSAIC_SUPABASE_R2_LOCK_PLAN_GET_ONLY_NO_WRITES_PASS');
  });

  it('requires a protected, SHA-pinned default-branch alert job and opt-in automated delivery', () => {
    const workflow = readFileSync(
      fileURLToPath(new URL('../../../.github/workflows/supabase-full-offsite-alert.yml', import.meta.url)),
      'utf8',
    );
    expect(workflow).toContain('workflow_run:');
    expect(workflow).toContain('Supabase Scratch Unified Encrypted Offsite Backup');
    expect(workflow).toContain('Supabase Scratch Unified Offsite Recovery Watch');
    expect(workflow).toContain('types: [completed]');
    expect(workflow).toContain("github.ref == 'refs/heads/main'");
    expect(workflow).toContain("vars.SUPABASE_DR_ALERT_ENABLED == 'true'");
    expect(workflow).toContain('environment: mosaic-supabase-dr');
    expect(workflow).toContain('ref: 1b84c2b66bf0d90170a7b1bafed21dcdd1fd4199');
    expect(workflow).toContain('persist-credentials: false');
    expect(workflow).toContain('permissions:\\n  contents: read'.replace('\\n', '\n'));
    expect(workflow).toContain('TEST_SCRATCH_DR_ALERT');
    expect(workflow).not.toContain('supabase-poc/unified-offsite.mjs --backup');
    expect(workflow).not.toContain('deleteObject');
  });

  it('only emits provider email for trusted failed main run or confirmed synthetic probe', () => {
    const result = spawnSync(process.execPath, ['--test', alerts], {
      encoding: 'utf8', timeout: 20_000,
      env: { PATH: process.env.PATH ?? '', HOME: '/nonexistent' },
    });
    expect(result.status, result.stderr || result.stdout || result.error?.message).toBe(0);
    expect(result.stdout).toContain('# pass 10');
    expect(result.stdout).toContain('# fail 0');
  });
});
