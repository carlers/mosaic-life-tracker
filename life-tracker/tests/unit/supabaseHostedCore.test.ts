import { describe, expect, it, vi } from 'vitest';
import { assertProject, connect, inspect, isCasConflict, PROJECT,
  PERSONAL_TABLES, sixDomainFixtureRows } from '../../supabase-poc/hosted-core.mjs';
import { exerciseHostedUi } from '../../supabase-poc/hosted-core-ui.mjs';
import { assertCredentialFreeEmailTemplates, inspectEmailPolicy, previewEmailPolicy, EMAIL_ROUTES, EMAIL_TEMPLATES, EMAIL_PREVIEW, EMAIL_PREVIEW_SHA, requireDeployedPreviewAccess } from '../../supabase-poc/email-policy.mjs';

const project = { id: PROJECT, name: 'mosaic-dev', status: 'ACTIVE_HEALTHY' };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });

describe('hosted core verification safety boundary', () => {
  it('six-domain hosted fixtures remain separate, marker-derived, owner-bound and FK-consistent', () => {
    const run = 'a'.repeat(24);
    const alice = '11111111-1111-4111-8111-111111111111';
    const bob = '22222222-2222-4222-8222-222222222222';
    const a = sixDomainFixtureRows(run, 'a', alice, `ht_${run}_a`);
    const b = sixDomainFixtureRows(run, 'b', bob, `ht_${run}_b`);
    expect(PERSONAL_TABLES).toEqual([
      'tasks','categories','diary','settings','buckets','bucket_task_links',
    ]);
    expect(a.map(([domain]) => domain)).toEqual(PERSONAL_TABLES.slice(2));
    expect(b.map(([domain]) => domain)).toEqual(PERSONAL_TABLES.slice(2));
    for (const [rows, owner, suffix] of [[a,alice,'a'],[b,bob,'b']] as const) {
      const ids = rows.map(([,row]) => row.id);
      expect(new Set(ids).size).toBe(4);
      expect(rows.every(([,row]) => row.owner_id === owner &&
        row.id.endsWith('_' + suffix) && row.id.length <= 36 &&
        row.is_deleted === false)).toBe(true);
      expect(rows[3][1]).toMatchObject({
        bucket_list_id: rows[2][1].id, task_id: `ht_${run}_${suffix}`,
      });
    }
    expect(new Set([...a,...b].map(([,row]) => row.id)).size).toBe(8);
    expect(() => sixDomainFixtureRows(run, 'a', bob, `ht_${run}_b`))
      .toThrow('Invalid six-domain fixture identity');
    expect(() => sixDomainFixtureRows('unmarked', 'a', alice, `ht_${run}_a`))
      .toThrow('Invalid six-domain fixture identity');
  });
  it('limits email policy edits to the isolated callbacks and preserves existing redirect entries', () => {
    // Explicitly bind policy to the independently accepted immutable Preview, not the stale alias.
    expect(EMAIL_ROUTES).toEqual([
      'https://mosaic-life-tracker-6luuatyml-carls-projects-72516fde.vercel.app/auth/confirm',
      'https://mosaic-life-tracker-6luuatyml-carls-projects-72516fde.vercel.app/reset-password',
    ]);
    const current = { site_url: 'http://localhost:3000', mailer_autoconfirm: false,
      uri_allow_list: 'http://localhost:3000/reset-password', smtp_pass: 'never-display' };
    const patch = previewEmailPolicy(current);
    expect(Object.keys(patch).sort()).toEqual(['mailer_templates_confirmation_content',
      'mailer_templates_recovery_content', 'site_url', 'uri_allow_list']);
    expect(patch.uri_allow_list.split(',')).toEqual([current.uri_allow_list, ...EMAIL_ROUTES]);
    for (const template of [patch.mailer_templates_confirmation_content, patch.mailer_templates_recovery_content]) {
      expect(template).toContain('{{ .Token }}');
      expect(template).not.toContain('TokenHash');
      const links = [...template.matchAll(/href="([^"]+)"/g)].map(match => new URL(match[1]));
      expect(links).toHaveLength(1);
      expect(links[0].search).toBe('');
      expect(links[0].hash).toBe('');
    }
    expect(inspectEmailPolicy({ ...current, ...patch })).toMatchObject({
      confirmationRequired: true, siteReady: true, redirectsReady: true, templatesReady: true,
    });
    expect(JSON.stringify(inspectEmailPolicy(current))).not.toContain('never-display');
    expect(inspectEmailPolicy({ ...current, smtp_host: 'smtp-relay.brevo.com',
      smtp_admin_email: 'private@example.org', smtp_pass: 'never-display' })).toMatchObject({
      customSmtpConfigured: true, brevoRelayConfigured: true, smtpSenderConfigured: true,
    });
    expect(JSON.stringify(inspectEmailPolicy({ ...current, smtp_host: 'smtp-relay.brevo.com',
      smtp_admin_email: 'private@example.org', smtp_pass: 'never-display' })))
      .not.toContain('private@example.org');
    expect(assertCredentialFreeEmailTemplates()).toBe(true);
    expect(() => assertCredentialFreeEmailTemplates({
      ...EMAIL_TEMPLATES,
      mailer_templates_confirmation_content: EMAIL_TEMPLATES.mailer_templates_confirmation_content
        .replace('/auth/confirm"', '/auth/confirm#marker=secret"'),
    })).toThrow('credential-free exact routes');
    expect(() => assertCredentialFreeEmailTemplates({
      ...EMAIL_TEMPLATES,
      mailer_templates_recovery_content: EMAIL_TEMPLATES.mailer_templates_recovery_content
        .replace('{{ .Token }}', '{{ .TokenHash }}'),
    })).toThrow('must use a code');
    expect(() => assertCredentialFreeEmailTemplates({
      ...EMAIL_TEMPLATES,
      mailer_templates_confirmation_content: EMAIL_TEMPLATES.mailer_templates_confirmation_content
        .replace('/auth/confirm"', '/auth/confirm#token_hash=secret"'),
    })).toThrow('must use a code');
    for (const change of [{ mailer_autoconfirm: true },
      { site_url: 'https://production.example' },
      { site_url: 'https://mosaic-supabase-core-preview.vercel.app' }])
      expect(() => previewEmailPolicy({ ...current, ...change })).toThrow('Unexpected isolated');
  });
  it('requires a scoped temporary share link and exact deployment before hosted browser activity', () => {
    const preview = { origin: EMAIL_PREVIEW, sha: EMAIL_PREVIEW_SHA };
    const share = EMAIL_PREVIEW + '/?_vercel_share=' + 'a'.repeat(32);
    expect(requireDeployedPreviewAccess(preview, share)).toBe(share);
    for (const bad of [undefined, 'https://mosaic-supabase-core-preview.vercel.app/?_vercel_share=' + 'a'.repeat(32),
      EMAIL_PREVIEW + '/login?_vercel_share=' + 'a'.repeat(32), share + '&next=other',
      share + '#type=recovery', EMAIL_PREVIEW + '/?token_hash=' + 'a'.repeat(32)])
      expect(() => requireDeployedPreviewAccess(preview, bad)).toThrow('scoped temporary share URL');
    expect(() => requireDeployedPreviewAccess({ ...preview, sha: 'a'.repeat(40) }, share))
      .toThrow('reviewed immutable origin');
    expect(() => requireDeployedPreviewAccess({ ...preview, origin: 'https://production.example' }, share))
      .toThrow('reviewed immutable origin');
  });
  it('generates email grants only for the exact server-marked disposable account', async () => {
    const id = '11111111-1111-4111-8111-111111111111';
    const runId = 'a'.repeat(24);
    const user = { id, email: `mosaic-hosted-${runId}-email-b@example.org`,
      app_metadata: { mosaic_disposable_run: runId }, email_confirmed_at: null };
    const fetcher = vi.fn(async (url: string) => {
      if (url.endsWith(PROJECT)) return json(project);
      if (url.includes('/api-keys')) return json([
        { type: 'publishable', api_key: 'sb_publishable_test' },
        { type: 'secret', api_key: 'sb_secret_fixture' },
      ]);
      if (url.endsWith('/admin/users/' + id)) return json(user);
      if (url.endsWith('/admin/generate_link')) return json({ id, hashed_token: 'b'.repeat(64), email_otp: '123456' });
      throw Error('Unexpected operation');
    });
    const client = await connect({ token: 'test-management-credential', fetcher });
    await expect(client.fixtureEmailLink({ id, runId, type: 'signup', password: 'synthetic disposable password' }))
      .resolves.toEqual({ tokenHash: 'b'.repeat(64), code: '123456' });
    user.app_metadata.mosaic_disposable_run = 'different-run';
    fetcher.mockClear();
    await expect(client.fixtureEmailLink({ id, runId, type: 'recovery' }))
      .rejects.toThrow('exact server-marked');
    expect(fetcher.mock.calls.some(([url]) => url.endsWith('/generate_link'))).toBe(false);
    await expect(client.dataApi('/auth/v1/admin/generate_link', { admin: true, body: {} }))
      .rejects.toThrow('Admin key limited');
  });
  it('refuses an unbound Preview before retrieving keys or launching credential-bearing browsers', async () => {
    const client = { management: vi.fn() };
    for (const preview of [
      { origin: 'https://other.vercel.app', sha: 'a'.repeat(40) },
      { origin: 'https://mosaic-supabase-core-preview.vercel.app', sha: '' },
    ]) await expect(exerciseHostedUi(client, [], 'https://' + PROJECT + '.supabase.co', preview))
      .rejects.toThrow('reviewed immutable origin');
    await expect(exerciseHostedUi(client, [], 'https://' + PROJECT + '.supabase.co', null, '.*'))
      .rejects.toThrow('Unknown hosted core browser contract');
    expect(client.management).not.toHaveBeenCalled();
  });
  it('accepts typed SQL null conflicts but never partial or mixed row responses', () => {
    const typedNull = { owner_id: null, id: null, change_seq: null, is_deleted: null, title: null };
    expect(isCasConflict(null)).toBe(true);
    expect(isCasConflict(typedNull)).toBe(true);
    for (const malformed of [{ id: null }, [], { ...typedNull, title: 'foreign' },
      { ...typedNull, is_deleted: false }]) expect(isCasConflict(malformed)).toBe(false);
  });
  it('refuses an unexpected project before any key, SQL or Auth operation', async () => {
    for (const override of [{ id: 'production' }, { name: 'production' }, { status: 'INACTIVE' }]) {
      const fetcher = vi.fn(async () => json({ ...project, ...override }));
      await expect(connect({ token: 'test-management-credential', fetcher }))
        .rejects.toThrow('Expected healthy isolated');
      expect(fetcher).toHaveBeenCalledTimes(1);
    }
    expect(() => assertProject(project)).not.toThrow();
  });

  it('inspection uses only read-only SQL and does not retrieve keys or expose Auth secrets', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetcher = async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      if (url.endsWith(PROJECT)) return json(project);
      if (url.endsWith('/config/auth'))
        return json({ disable_signup: false, smtp_pass: 'never-display', jwt_secret: 'never-display' });
      if (url.endsWith('/advisors/security')) return json({ lints: [] });
      if (url.endsWith('/database/query/read-only'))
        return json(String(init.body).includes('count(*)') ? [{ users: 0 }] : []);
      throw new Error('Unexpected operation');
    };
    const client = await connect({ token: 'test-management-credential', fetcher });
    const result = await inspect(client);
    expect(result.auth.disable_signup).toBe(false);
    expect(JSON.stringify(result)).not.toContain('never-display');
    expect(calls.every(c => c.init.redirect === 'error')).toBe(true);
    expect(calls.filter(c => c.init.method === 'POST')
      .every(c => c.url.endsWith('/database/query/read-only'))).toBe(true);
    expect(calls.some(c => c.url.includes('/api-keys') || c.url.includes('/admin/users'))).toBe(false);
  });

  it('does not leak provider responses or network causes into errors', async () => {
    await expect(connect({ token: 'test-management-credential',
      fetcher: async () => json({ message: 'credential-in-provider-response' }, 403),
    })).rejects.toThrow(/^Project inspection: HTTP 403$/);
    await expect(connect({ token: 'test-management-credential',
      fetcher: async () => { throw new Error('credential-in-network-cause'); },
    })).rejects.toThrow(/^Isolated Supabase request failed \(network or redirect\)$/);
  });
});
