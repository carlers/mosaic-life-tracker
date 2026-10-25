import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

describe('Scratch-only failure alert workflow promotion boundaries', () => {
  const path = fileURLToPath(new URL('../../../.github/workflows/supabase-full-offsite-alert.yml', import.meta.url));
  const workflow = readFileSync(path, 'utf8');

  it('only permits protected main workflow_run after separate alert opt-in', () => {
    expect(workflow).toContain('workflow_run:');
    expect(workflow).toContain('Supabase Scratch Unified Encrypted Offsite Backup');
    expect(workflow).toContain('Supabase Scratch Unified Offsite Recovery Watch');
    expect(workflow).toContain('types: [completed]');
    expect(workflow).toContain("github.ref == 'refs/heads/main'");
    expect(workflow).toContain("vars.SUPABASE_DR_ALERT_ENABLED == 'true'");
    expect(workflow).toContain('environment: mosaic-supabase-dr');
    expect(workflow).toContain('permissions:\n  contents: read');
  });

  it('allows one confirmed manual test without running unreviewed code or touching data', () => {
    expect(workflow).toContain('TEST_SCRATCH_DR_ALERT');
    expect(workflow).toContain('persist-credentials: false');
    expect(workflow).toContain('ref: 1b84c2b66bf0d90170a7b1bafed21dcdd1fd4199');
    expect(workflow).toContain('node supabase-poc/dr-alert.mjs --probe');
    expect(workflow).toContain('node supabase-poc/dr-alert.mjs --event');
    expect(workflow).not.toContain('supabase-poc/unified-offsite.mjs --backup');
    expect(workflow).not.toContain('SUPABASE_DR_PRUNE_ENABLED');
    expect(workflow).not.toContain('secrets.SUPABASE_DR_R2_WRITE');
  });
});
