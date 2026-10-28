import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../.github/workflows/', import.meta.url));
const backup = readFileSync(root + 'supabase-fourteen-table-oneoff-backup.yml', 'utf8');
const watch = readFileSync(root + 'supabase-fourteen-table-oneoff-watch.yml', 'utf8');
const source = '2128be03404181bdabd43e3792fc56a8a3b515be';

// The protected one-off workflows are inert PR artifacts until explicitly
// approved and merged into main, then require a second manual confirmation.
describe('fourteen-table post-registry offsite DR safety (#1027)', () => {
  for (const [name, workflow, phrase] of [
    ['encrypted database+media backup', backup, 'SCRATCH_FOURTEEN_TABLE_ONE_OFF_BACKUP'],
    ['independent read-only R2 watch', watch, 'VERIFY_SCRATCH_FOURTEEN_OFFSITE'],
  ] as const) {
    it(name + ' is confirmation-gated and main-only without schedules', () => {
      expect(workflow).toMatch(/^on:\n {2}workflow_dispatch:\n/m);
      for (const automatic of ['schedule:', 'push:', 'pull_request:', 'workflow_run:',
        'repository_dispatch:', 'workflow_call:']) expect(workflow).not.toContain(automatic);
      expect(workflow).toContain("github.ref == 'refs/heads/main'");
      expect(workflow).toContain("github.event_name == 'workflow_dispatch'");
      expect(workflow).toContain("inputs.confirmation == '" + phrase + "'");
      expect(workflow).toContain('permissions:\n  contents: read');
      expect(workflow).toContain('environment: mosaic-supabase-dr');
      expect(workflow).toContain('cancel-in-progress: false');
    });

    it(name + ' pins only the signed isolated recovery source and exact protected Scratch target', () => {
      expect(workflow).toContain('ref: ' + source);
      expect(workflow).toContain("test \"$(git rev-parse HEAD)\" = '" + source + "'");
      expect(workflow).toContain('persist-credentials: false');
      expect(workflow).toContain('SUPABASE_DR_SOURCE_PROJECT: hcxtiifzxoaflhjgoglb');
      expect(workflow).toContain("test \"$SUPABASE_DR_SOURCE_PROJECT\" = 'hcxtiifzxoaflhjgoglb'");
      expect(workflow).toContain("SUPABASE_DR_RECOVERY_PROFILE: 'fourteen-personal-identity'");
      expect(workflow).toContain("test \"$SUPABASE_DR_RECOVERY_PROFILE\" = 'fourteen-personal-identity'");
      expect(workflow).toContain("test \"$SUPABASE_DR_R2_BUCKET\" = 'mosaic-supabase-backups'");
      for (const bad of ['git push', 'supabase db push', 'vercel deploy', 'vercel --prod',
        'docker network prune', 'SUPABASE_DR_PRUNE_ENABLED: \'true\'']) {
        expect(workflow).not.toContain(bad);
      }
    });
  }

  it('backup uses only its protected source credentials and exactly one paired ciphertext publisher', () => {
    expect(backup).toContain("SUPABASE_DR_PRUNE_ENABLED: 'false'");
    expect(backup).toContain("SUPABASE_DR_R2_LOCK_CONFIRMED: 'false'");
    expect(backup).toContain('postgresql-client-17');
    expect(backup).toContain("test \"$SUPABASE_DR_PRUNE_ENABLED\" = 'false'");
    for (const name of ['PGPASSWORD', 'SOURCE_STORAGE_KEY', 'AGE_IDENTITY',
      'R2_WRITE_ACCESS_KEY_ID', 'R2_WRITE_SECRET_ACCESS_KEY']) {
      expect(backup).toContain('secrets.SUPABASE_DR_' + name);
    }
    expect(backup.match(/node supabase-poc\/unified-offsite\.mjs --backup/g)).toHaveLength(1);
    expect(backup).not.toContain('unified-offsite.mjs --watch');
  });

  it('watch has no source database or R2-write secrets and verifies only complete ciphertext', () => {
    for (const forbidden of ['secrets.SUPABASE_DR_PGPASSWORD',
      'secrets.SUPABASE_DR_SOURCE_STORAGE_KEY', 'secrets.SUPABASE_DR_AGE_IDENTITY',
      'secrets.SUPABASE_DR_R2_WRITE_ACCESS_KEY_ID', 'secrets.SUPABASE_DR_R2_WRITE_SECRET_ACCESS_KEY',
      'SUPABASE_DR_ENABLED', 'unified-offsite.mjs --backup', 'unified-offsite.mjs --download']) {
      expect(watch).not.toContain(forbidden);
    }
    expect(watch).toContain('secrets.SUPABASE_DR_R2_READ_ACCESS_KEY_ID');
    expect(watch).toContain('secrets.SUPABASE_DR_R2_READ_SECRET_ACCESS_KEY');
    expect(watch.match(/node supabase-poc\/unified-offsite\.mjs --watch/g)).toHaveLength(1);
  });

  it('ten-table protected backup and watcher remain separate and unchanged', () => {
    expect(backup).not.toContain('SCRATCH_TEN_TABLE_ONE_OFF_BACKUP');
    expect(watch).not.toContain('VERIFY_SCRATCH_OFFSITE\'');
    expect(backup).not.toContain('secrets.SUPABASE_DR_R2_READ_SECRET_ACCESS_KEY');
  });
});
