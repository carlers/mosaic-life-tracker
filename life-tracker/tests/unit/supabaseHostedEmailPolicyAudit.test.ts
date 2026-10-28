import { describe, expect, it } from 'vitest';
import {
  summarizeHostedEmailPolicy, emailPolicyGate, EMAIL_POLICY_FLAGS,
} from '../../supabase-poc/hosted-email-audit.mjs';
import { EMAIL_PREVIEW, EMAIL_ROUTES, EMAIL_TEMPLATES } from '../../supabase-poc/email-policy.mjs';

function fixture() {
  return {
    mailer_autoconfirm: false, site_url: EMAIL_PREVIEW,
    uri_allow_list: EMAIL_ROUTES.join(','), ...EMAIL_TEMPLATES,
    smtp_host: 'smtp-relay.brevo.com',
    smtp_admin_email: 'private-sender@example.org',
    smtp_pass: 'private-secret-DO-NOT-PRINT',
    smtp_user: 'private-user-DO-NOT-PRINT',
    rate_limit_email_sent: 30,
  };
}

describe('protected hosted read-only email policy audit', () => {
  it('projects only known safe readiness values, never private SMTP fields', () => {
    const summary = summarizeHostedEmailPolicy(fixture());
    expect(EMAIL_POLICY_FLAGS.every(key => summary[key] === true)).toBe(true);
    expect(summary.emailRateLimit).toBe(30);
    expect(Object.keys(summary).sort()).toEqual(
      [...EMAIL_POLICY_FLAGS, 'emailRateLimit'].sort());
    const gate = emailPolicyGate(summary);
    expect(gate.ready).toBe(true);
    const stdout = gate.markers.join('\n');
    expect(stdout).toContain('MOSAIC_HOSTED_EMAIL_REVIEWED_PREVIEW_POLICY_READY');
    expect(stdout).toContain('MOSAIC_HOSTED_EMAIL_REAL_INBOX_DELIVERY_NOT_TESTED');
    expect(stdout).not.toContain('private-secret');
    expect(stdout).not.toContain('private-sender');
    expect(stdout).not.toContain('smtp-relay.brevo.com');
    expect(stdout).not.toContain(EMAIL_PREVIEW);
  });

  it('fails closed and distinguishes missing SMTP, redirects, templates and confirmation', () => {
    for (const [field, changed] of [
      ['smtp_host', null], ['smtp_admin_email', ''],
      ['mailer_autoconfirm', true], ['uri_allow_list', 'http://localhost:3000'],
      ['mailer_templates_recovery_content', '<p>Unexpected</p>'],
    ] as const) {
      const summary = summarizeHostedEmailPolicy({ ...fixture(), [field]: changed });
      const gate = emailPolicyGate(summary);
      expect(gate.ready).toBe(false);
      expect(gate.markers.at(-1)).toBe('MOSAIC_HOSTED_EMAIL_REVIEWED_PREVIEW_POLICY_NOT_READY');
    }
  });

  it('does not emit arbitrary objects, URLs, credentials or malformed rate limits', () => {
    const malformed = {
      ...fixture(),
      rate_limit_email_sent: 'private-secret-DO-NOT-PRINT',
      irrelevant: { token: 'never-echo-this' },
    };
    const safe = summarizeHostedEmailPolicy(malformed);
    expect(safe.emailRateLimit).toBeNull();
    expect(emailPolicyGate(safe).markers.join('\n')).not.toContain('never-echo-this');
    expect(() => emailPolicyGate({ ...safe, confirmationRequired: 'yes' })).toThrow('Unsafe email policy');
    expect(() => summarizeHostedEmailPolicy(null)).toThrow('Invalid');
  });
});
