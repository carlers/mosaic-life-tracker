import { describe, expect, it, vi } from 'vitest';
import { MOSAIC_TABLES } from '../../infrastructure/mosaic-backend.mjs';
import { assertErasurePolicyCoversManifest } from '../../infrastructure/account-erasure-policy.mjs';
import { migrateBugReportsBackend } from '../../scripts/migrate-bug-reports.mjs';
import { selectMigrations } from '../../scripts/appwrite-migrate.mjs';

const reportTable = MOSAIC_TABLES.find(table => table.id === 'bug_reports');
function missing() { return Object.assign(new Error('Not found'), { status: 404 }); }

describe('private bug report backend contract', () => {
  it('allows no direct browser table grants and is covered by account-erasure policy', () => {
    expect(reportTable?.permissions).toEqual([]);
    expect(reportTable?.rowSecurity).toBe(true);
    expect(assertErasurePolicyCoversManifest()).toBe(true);
    expect(reportTable?.indexes?.some(index => index.attributes.includes('expires_at'))).toBe(true);
  });

  it('creates the private table only when absent', async () => {
    const request = vi.fn(async (method: string) => {
      if (method === 'GET') throw missing();
      return {};
    });
    expect(await migrateBugReportsBackend({ request })).toEqual({ created: true });
    const created = request.mock.calls.find(([method]) => method === 'POST');
    expect(created?.[2]).toMatchObject({
      tableId: 'bug_reports', permissions: [], rowSecurity: true,
    });
    expect(selectMigrations(['--only', '018-bug-reports'])).toHaveLength(1);
  });

  it('does not weaken permissions of an existing table', async () => {
    const request = vi.fn().mockResolvedValue({
      ...reportTable, $id: 'bug_reports', $permissions: ['read("users")'],
    });
    await expect(migrateBugReportsBackend({ request }))
      .rejects.toThrow(/permissions/);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('recognizes matching existing schema without modifying it', async () => {
    const request = vi.fn().mockResolvedValue({
      ...reportTable, $id: 'bug_reports', $permissions: [],
    });
    expect(await migrateBugReportsBackend({ request })).toEqual({ created: false });
    expect(request).toHaveBeenCalledTimes(1);
  });
});
