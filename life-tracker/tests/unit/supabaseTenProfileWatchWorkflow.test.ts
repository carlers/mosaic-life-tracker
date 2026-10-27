import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const workflow = readFileSync(fileURLToPath(
  new URL('../../../.github/workflows/supabase-full-offsite-watch.yml',
    import.meta.url)), 'utf8');

describe('protected ten-table Supabase offsite watch boundaries (#1027)', () => {
  it('retains existing manual-main fence and disabled-by-default schedule', () => {
    expect(workflow).toContain('schedule:');
    expect(workflow).toContain("vars.SUPABASE_DR_ENABLED == 'true'");
    expect(workflow).toContain("github.ref == 'refs/heads/main'");
    expect(workflow).toContain("github.event_name == 'workflow_dispatch'");
    expect(workflow).toContain("inputs.confirmation == 'VERIFY_SCRATCH_OFFSITE'");
    expect(workflow).toContain('environment: mosaic-supabase-dr');
    expect(workflow).toContain('permissions:\n  contents: read');
  });

  it('pins a reviewed exact recovery source and enforces only ten-table freshness', () => {
    const pinned = '8d161c958864283d8a50c454f35dc4e27f9d02cc';
    expect(workflow).toContain('ref: ' + pinned);
    expect(workflow).toContain("test \"$(git rev-parse HEAD)\" = '" + pinned + "'");
    expect(workflow).toContain('persist-credentials: false');
    expect(workflow).toContain('SUPABASE_DR_SOURCE_PROJECT: hcxtiifzxoaflhjgoglb');
    expect(workflow).toContain("SUPABASE_DR_RECOVERY_PROFILE: 'ten-personal-bucket-links'");
    expect(workflow).toContain("test \"$SUPABASE_DR_SOURCE_PROJECT\" = 'hcxtiifzxoaflhjgoglb'");
    expect(workflow).toContain("test \"$SUPABASE_DR_RECOVERY_PROFILE\" = 'ten-personal-bucket-links'");
    expect(workflow).toContain("test \"$SUPABASE_DR_R2_BUCKET\" = 'mosaic-supabase-backups'");
    expect(workflow.match(/node supabase-poc\/unified-offsite\.mjs --watch/g)).toHaveLength(1);
  });

  it('uses only dedicated R2 read permissions and never writes databases, R2 or Production', () => {
    expect(workflow).toContain('secrets.SUPABASE_DR_R2_READ_ACCESS_KEY_ID');
    expect(workflow).toContain('secrets.SUPABASE_DR_R2_READ_SECRET_ACCESS_KEY');
    for (const forbidden of [
      'secrets.SUPABASE_DR_R2_WRITE_ACCESS_KEY_ID',
      'secrets.SUPABASE_DR_R2_WRITE_SECRET_ACCESS_KEY',
      'secrets.SUPABASE_DR_PGPASSWORD',
      'secrets.SUPABASE_DR_SOURCE_STORAGE_KEY',
      'secrets.SUPABASE_DR_AGE_IDENTITY',
      'supabase db push', 'vercel deploy', 'git push',
      'unified-offsite.mjs --backup', 'unified-offsite.mjs --download',
    ]) expect(workflow).not.toContain(forbidden);
  });
});
