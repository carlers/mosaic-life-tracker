import { describe, expect, it, vi } from 'vitest';
import { assertProject, connect, inspect, isCasConflict, PROJECT } from '../../supabase-poc/hosted-core.mjs';

const project = { id: PROJECT, name: 'mosaic-dev', status: 'ACTIVE_HEALTHY' };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });

describe('hosted core verification safety boundary', () => {
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
