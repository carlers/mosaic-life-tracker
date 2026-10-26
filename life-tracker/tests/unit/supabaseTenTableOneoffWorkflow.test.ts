import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Do not use the protected app's secret-bearing workflow as code input:
// verify declarative safety before ANY default-branch deployment.
const workflow = readFileSync(fileURLToPath(
  new URL('../../../.github/workflows/supabase-ten-table-oneoff-backup.yml',
    import.meta.url)), 'utf8');

describe('mosaic-dev ten-table encrypted offsite workflow boundaries (#1027)', () => {
  it('is a single human-confirmed main-only event, never a schedule', () => {
    expect(workflow).toMatch(/^on:\n  workflow_dispatch:\n/m);
    for (const automatic of [
      'schedule:', 'push:', 'pull_request:', 'workflow_run:',
      'repository_dispatch:', 'workflow_call:',
    ]) {
      expect(workflow).not.toContain(automatic);
    }
    expect(workflow).toContain('SCRATCH_TEN_TABLE_ONE_OFF_BACKUP');
    expect(workflow).toContain("github.ref == 'refs/heads/main'");
    expect(workflow).toContain("github.event_name == 'workflow_dispatch'");
    expect(workflow).toContain("inputs.confirmation == 'SCRATCH_TEN_TABLE_ONE_OFF_BACKUP'");
    expect(workflow).toContain('  cancel-in-progress: false');
  });

  it('requires protected credentials and a fixed non-production database and R2 target', () => {
    expect(workflow).toContain('environment: mosaic-supabase-dr');
    expect(workflow).toContain('permissions:\n  contents: read');
    expect(workflow).toContain('SUPABASE_DR_SOURCE_PROJECT: hcxtiifzxoaflhjgoglb');
    expect(workflow).toContain("SUPABASE_DR_RECOVERY_PROFILE: 'ten-personal-bucket-links'");
    expect(workflow).toContain("test \"$SUPABASE_DR_SOURCE_PROJECT\" = 'hcxtiifzxoaflhjgoglb'");
    expect(workflow).toContain("test \"$SUPABASE_DR_RECOVERY_PROFILE\" = 'ten-personal-bucket-links'");
    expect(workflow).toContain("test \"$SUPABASE_DR_R2_BUCKET\" = 'mosaic-supabase-backups'");
    for (const confidential of [
      'secrets.SUPABASE_DR_PGPASSWORD',
      'secrets.SUPABASE_DR_SOURCE_STORAGE_KEY',
      'secrets.SUPABASE_DR_AGE_IDENTITY',
      'secrets.SUPABASE_DR_R2_WRITE_ACCESS_KEY_ID',
      'secrets.SUPABASE_DR_R2_WRITE_SECRET_ACCESS_KEY',
    ]) expect(workflow).toContain(confidential);
    expect(workflow).toContain("SUPABASE_DR_PRUNE_ENABLED: 'false'");
    expect(workflow).toContain("SUPABASE_DR_R2_LOCK_CONFIRMED: 'false'");
    expect(workflow).toContain("test \"$SUPABASE_DR_PRUNE_ENABLED\" = 'false'");
  });

  it('executes only CI-accepted recovery code with one complete paired age/R2 publication', () => {
    const pinned = '51e5b1b4a5077f6ffce2e93fa151709a67c3022b';
    expect(workflow).toContain('ref: ' + pinned);
    expect(workflow).toContain("test \"$(git rev-parse HEAD)\" = '" + pinned + "'");
    expect(workflow).toContain('persist-credentials: false');
    expect(workflow).toContain('postgresql-client-17');
    expect(workflow.match(/node supabase-poc\/unified-offsite\.mjs --backup/g)).toHaveLength(1);
    for (const forbidden of [
      'git push', 'vercel deploy', 'vercel --prod', 'supabase db push',
      'SUPABASE_DR_PRUNE_ENABLED: \'true\'',
    ]) expect(workflow).not.toContain(forbidden);
  });
});
