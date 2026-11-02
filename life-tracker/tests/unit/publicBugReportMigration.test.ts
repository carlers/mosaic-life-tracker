import { describe, expect, it, vi } from 'vitest';
import { migratePublicBugReportBackend } from '../../scripts/migrate-public-bug-report.mjs';

const expected = {
  github_issue_url: { key: 'github_issue_url', type: 'varchar', size: 512, required: false, default: '', status: 'available' },
  github_issue_number: { key: 'github_issue_number', type: 'integer', required: false, default: 0, status: 'available' },
  github_publish_started_at: { key: 'github_publish_started_at', type: 'varchar', size: 50, required: false, default: '', status: 'available' },
};
function api() {
  const fields = new Set<string>();
  const request = vi.fn(async (method: string, path: string, data?: { key?: string }) => {
    if (path.endsWith('/tables/bug_reports')) return { $id: 'bug_reports' };
    if (method === 'GET') {
      const key = path.split('/').at(-1) as keyof typeof expected;
      if (!fields.has(key)) throw Object.assign(new Error('not found'), { status: 404 });
      return expected[key];
    }
    if (method === 'POST' && data?.key) { fields.add(data.key); return {}; }
    throw new Error('Unexpected operation');
  });
  return { fields, request };
}
describe('GitHub issue receipt additive migration', () => {
  it('creates three server-only receipt columns and is idempotent', async () => {
    const { fields, request } = api();
    const first = await migratePublicBugReportBackend({ request, sleep: async () => {} });
    expect(first).toHaveLength(3);
    expect(first.every((row: {created: boolean}) => row.created)).toBe(true);
    expect(request.mock.calls.filter(([method]) => method === 'POST')).toHaveLength(3);
    expect(fields.size).toBe(3);
    const second = await migratePublicBugReportBackend({ request, sleep: async () => {} });
    expect(second.every((row: {created: boolean}) => !row.created)).toBe(true);
  });
  it('refuses mismatched existing field rather than modifying it', async () => {
    const { request, fields } = api();
    fields.add('github_issue_url');
    request.mockImplementation(async (method: string, path: string) => {
      if (path.endsWith('/tables/bug_reports')) return { $id: 'bug_reports' };
      if (path.endsWith('/github_issue_url')) return {
        ...expected.github_issue_url, size: 120,
      };
      throw new Error('Unexpected operation');
    });
    await expect(migratePublicBugReportBackend({ request, sleep: async () => {} }))
      .rejects.toThrow('Incompatible issue receipt column');
    expect(request.mock.calls.filter(([method]) => method === 'POST')).toHaveLength(0);
  });
});
