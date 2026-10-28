import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const runner = fileURLToPath(new URL('../../supabase-poc/operator-fourteen-offsite.py', import.meta.url));
const testFile = fileURLToPath(new URL('../../supabase-poc/tests/test_operator_fourteen_offsite.py', import.meta.url));

describe('fourteen-table post-registry one-pass offsite DR (owner-only, source-pinned)', () => {
  it('rehearses source, key separation, complete R2 backup/watch/restore, and exact cleanup offline', () => {
    const out = spawnSync('python3', [testFile, '-q'], {
      encoding: 'utf8', timeout: 25000,
      env: { PATH: process.env.PATH ?? '', HOME: '/nonexistent' },
    });
    expect(out.status, out.stderr || out.error?.message).toBe(0);
    expect(out.stderr).toContain('Ran 23 tests');
    expect(out.stderr).toContain('OK');
  });

  it('validates the read-only paired R2 credential probe and fixed secret-safe results offline', () => {
    const python = fileURLToPath(new URL('../../supabase-poc/tests/test_operator_r2_paired_probe.py', import.meta.url));
    const node = fileURLToPath(new URL('../../supabase-poc/tests/test_r2_paired_probe.mjs', import.meta.url));
    const env = { PATH: process.env.PATH ?? '', HOME: '/nonexistent' };
    const py = spawnSync('python3', [python, '-q'], { encoding: 'utf8', timeout: 25000, env });
    expect(py.status, py.stderr || py.error?.message).toBe(0);
    expect(py.stderr).toContain('Ran 6 tests');
    const js = spawnSync('node', ['--test', node], { encoding: 'utf8', timeout: 30000, env });
    expect(js.status, js.stderr || js.error?.message || js.stdout).toBe(0);
    expect(js.stdout).toContain('pass 6');
  });

  it('provides a six-stage plan with no network or credential prompts', () => {
    const out = spawnSync('python3', [runner, '--plan'], {
      encoding: 'utf8', timeout: 10000,
      env: { PATH: process.env.PATH ?? '', HOME: '/nonexistent' },
    });
    expect(out.status, out.stderr || out.error?.message).toBe(0);
    expect(out.stdout.match(/MOSAIC_FOURTEEN_R2_PLAN:/g)).toHaveLength(6);
    expect(out.stdout).toContain('MOSAIC_FOURTEEN_R2_PLAN_NO_CLOUD_OR_SECRETS_PASS');
    expect(out.stdout).not.toContain('AGE-SECRET-KEY-');
  });
});
