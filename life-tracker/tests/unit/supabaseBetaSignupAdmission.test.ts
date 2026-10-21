import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const migration = readFileSync(new URL(
  '../../supabase-poc/migrations/20261021_beta_signup_invite_gate.sql', import.meta.url), 'utf8');
const probe = readFileSync(new URL(
  '../../supabase-poc/validation/20261021_beta_signup_invite_probe.sql', import.meta.url), 'utf8');

describe('unapplied Supabase invite-only beta gate (#1027)', () => {
  it('retains a private, expiring allowlist and rejects uninvited signups', () => {
    expect(migration).toContain('mosaic_candidate_private.beta_signup_invitations');
    expect(migration).toMatch(/revoke all on mosaic_candidate_private\.beta_signup_invitations\s+from public, anon, authenticated, supabase_auth_admin/i);
    expect(migration).toMatch(/language plpgsql security definer set search_path = ''/i);
    expect(migration).toMatch(/grant execute on function mosaic_candidate_private\.beta_before_user_created\(jsonb\)\s+to supabase_auth_admin/i);
    expect(migration).toContain("event #>> '{user,email}'");
    expect(migration).toContain("event #>> '{metadata,name}'");
    expect(migration).toContain('expires_at > clock_timestamp()');
    expect(migration).toContain('revoked_at is null');
    expect(migration).toContain('http_code');
    expect(migration).toContain('403');
    expect(migration).not.toContain("event #>> '{user,user_metadata}'");
    expect(migration).not.toMatch(/grant\s+(select|insert|update|delete|all)\s+on\s+.*beta_signup_invitations\s+to\s+(anon|authenticated|public)/i);
  });
  it('includes a scratch-only rollback probe with positive and negative cases', () => {
    expect(probe).toMatch(/begin;[\s\S]*rollback;\s*$/i);
    for (const value of ['ALLOWED@example.invalid', 'outsider@example.invalid',
      'revoked@example.invalid', 'expired@example.invalid', 'unknown-hook'])
      expect(probe).toContain(value);
    expect(probe).toContain('beta_before_user_created');
    expect(probe).toContain('set local role supabase_auth_admin');
    expect(probe).toContain('has_table_privilege');
  });
});
