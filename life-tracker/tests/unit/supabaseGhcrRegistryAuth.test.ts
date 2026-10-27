import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** #1027 GHCR pull retries must be authorized without widening CI write grants. */
const labs = [
  ['supabase-core-app.yml', 'Configure disposable Supabase with core authority'],
  ['supabase-real-gotrue-restore.yml', 'Exercise real local Auth account recovery'],
  ['supabase-eight-table-restore.yml', 'Prove age-encrypted nonempty personal Settings 8-table restore with signed GoTrue'],
  ['supabase-ten-table-restore.yml', 'Prove PG17 age-encrypted ten-table exact-copy restore and signed two-owner RLS'],
] as const;

describe('disposable Supabase labs authenticate rate-limited GHCR pulls', () => {
  it.each(labs)('%s authenticates before the first local stack test, without write grants', (name, exercise) => {
    const source = readFileSync(new URL('../../../.github/workflows/' + name, import.meta.url), 'utf8');
    expect(source).toMatch(/permissions:\s*\n\s*contents: read\s*\n\s*packages: read/);
    expect(source).not.toMatch(/packages:\s*write/);
    const setup = source.indexOf('uses: supabase/setup-cli@v1');
    const login = source.indexOf('uses: docker/login-action@v4');
    const exerciseStep = source.indexOf('- name: ' + exercise);
    expect(setup).toBeGreaterThan(-1);
    expect(login).toBeGreaterThan(setup);
    expect(exerciseStep).toBeGreaterThan(login);
    const authStep = source.slice(source.lastIndexOf('- name:', login), source.indexOf('\n      - name:', login));
    expect(authStep).toContain('registry: ghcr.io');
    expect(authStep).toContain('username: ${{ github.actor }}');
    expect(authStep).toContain('password: ${{ secrets.GITHUB_TOKEN }}');
    expect(authStep).not.toMatch(/(?:run:|echo\s+.*(?:TOKEN|password)|packages:\s*write)/i);
    expect(source).not.toContain('secrets.GHCR_PAT');
  });
});
