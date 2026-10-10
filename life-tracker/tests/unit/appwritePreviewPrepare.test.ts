import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  SCRATCH_ID, SCRATCH_ENDPOINT, assertScratchPreviewTarget,
  classifyScratchDrift, runPreviewPrepare,
} from '../../scripts/appwrite-preview-prepare.mjs';
afterEach(() => { process.exitCode = 0; });
const target = { projectId: SCRATCH_ID, endpoint: SCRATCH_ENDPOINT };
const argv = ['--project', SCRATCH_ID, '--endpoint', SCRATCH_ENDPOINT];
const env = { APPWRITE_API_KEY: 'test-key' };
const clean = {
  diffs: [], legacyTables: [],
  functionObservations: [{ name: 'message-action', deploymentId: 'reviewed' }],
};
describe('scratch-only Preview backend preparation', () => {
  it('rejects production or implicit targets and requires double-confirmation for writes', () => {
    expect(() => assertScratchPreviewTarget(argv, target)).not.toThrow();
    expect(() => assertScratchPreviewTarget(['--project', 'prod', '--endpoint', SCRATCH_ENDPOINT], target)).toThrow(/scratch/);
    expect(() => assertScratchPreviewTarget(['--project', SCRATCH_ID], target)).toThrow(/scratch/);
    expect(() => assertScratchPreviewTarget([...argv, '--apply'], target)).toThrow(/confirm-project/);
    expect(() => assertScratchPreviewTarget([...argv, '--apply', '--confirm-project', SCRATCH_ID], target)).not.toThrow();
  });
  it('only auto-reconciles known additive migrations', () => {
    expect(classifyScratchDrift([
      'table diary.created_at: missing column',
      'table account_deletions: missing',
      'table messages.idx_sender_id: missing index',
    ])).toEqual([]);
    expect(classifyScratchDrift([
      'table diary.created_at size: expected 50, got 36',
      'table tasks: missing', 'bucket task_images permissions differ',
      'function message-action variable DR_PRIVACY_DELETION_REQUIRED: missing',
    ])).toHaveLength(4);
  });
  it('runs a read-only check and never migrates without --apply', async () => {
    const migrate = vi.fn();
    const report = await runPreviewPrepare({
      argv, env, readDefinitions: async () => ({}),
      inspect: async () => clean, migrate, fetchImpl: vi.fn(), log: vi.fn(),
    });
    expect(report.diffs).toEqual([]);
    expect(migrate).not.toHaveBeenCalled();
  });
  it('applies approved migrations in order and rechecks managed drift', async () => {
    const inspect = vi.fn()
      .mockResolvedValueOnce({ ...clean, diffs: ['table diary.created_at: missing column'] })
      .mockResolvedValueOnce(clean);
    const migrate = vi.fn();
    await runPreviewPrepare({
      argv: [...argv, '--apply', '--confirm-project', SCRATCH_ID],
      env, readDefinitions: async () => ({}), inspect, migrate,
      fetchImpl: vi.fn(), log: vi.fn(),
    });
    const migrations = migrate.mock.calls[0][0].migrations.map((m: {id: string}) => m.id);
    expect(migrations).toEqual(['001-account-deletion','002-diary-created-at','004-notifications','005-notification-retention','006-push-details','007-task-shares']);
    expect(inspect).toHaveBeenCalledTimes(2);
  });
  it('rejects unreviewed drift before any mutation', async () => {
    const migrate = vi.fn();
    await expect(runPreviewPrepare({
      argv: [...argv, '--apply', '--confirm-project', SCRATCH_ID],
      env, readDefinitions: async () => ({}),
      inspect: async () => ({ ...clean, diffs: ['table diary.created_at size incompatible'] }),
      migrate, fetchImpl: vi.fn(), log: vi.fn(),
    })).rejects.toThrow(/unreviewed drift/);
    expect(migrate).not.toHaveBeenCalled();
  });
  it('fails closed if the active Function is not the reviewed deployment', async () => {
    const log = vi.fn();
    const result = await runPreviewPrepare({
      argv: [...argv, '--expected-deployment', 'other'],
      env, readDefinitions: async () => ({}),
      inspect: async () => ({ ...clean, diffs: [] }),
      fetchImpl: vi.fn(), log,
    });
    expect(result.diffs).toContain('message-action: active deployment does not match --expected-deployment');
    expect(process.exitCode).toBe(2);
  });
});
