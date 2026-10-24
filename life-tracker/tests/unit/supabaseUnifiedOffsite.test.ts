import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const fixture = fileURLToPath(new URL('../../supabase-poc/tests/test_unified_offsite.mjs', import.meta.url));

describe('Supabase unified encrypted PostgreSQL + private Storage offsite recovery', () => {
  it('requires one complete commit, verified independent readback, safe recovery and retention', () => {
    const result = spawnSync(process.execPath, ['--test', fixture], {
      encoding: 'utf8', timeout: 30_000,
      env: { PATH: process.env.PATH ?? '', HOME: '/nonexistent' },
    });
    expect(result.status, result.stderr || result.stdout || result.error?.message).toBe(0);
    expect(result.stdout).toContain('# pass 8');
    expect(result.stdout).toContain('# fail 0');
  });
});
