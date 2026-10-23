import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppSupabaseCoreBootstrap } from '../../src/lib/supabaseCoreBootstrap';

const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const mocks = vi.hoisted(() => ({
  waitForDatabaseReady: vi.fn(async () => {}),
  getDatabase: vi.fn(() => ({ tasks: { domain: 'real-tasks' }, categories: { domain: 'real-categories' }, diary: { domain: 'real-diary' } })),
  createCandidateCoreRuntime: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(async () => {}),
  pause: vi.fn(async () => {}),
  ready: vi.fn(async () => {}),
  resync: vi.fn(async () => {}),
  verify: vi.fn(async () => {}),
  conflicts: vi.fn(() => ({ tasks: [], categories: [] })),
}));
vi.mock('../../src/lib/databaseBootstrap', () => ({
  waitForDatabaseReady: mocks.waitForDatabaseReady,
}));
vi.mock('../../src/db/database', () => ({
  getDatabase: mocks.getDatabase,
}));
vi.mock('../../supabase-poc/candidateCoreRuntime', () => ({
  createCandidateCoreRuntime: mocks.createCandidateCoreRuntime,
}));

const run = {
  taskState: { domain: 'task-state' },
  categoryState: { domain: 'category-state' },
  awaitInitialReplication: mocks.ready,
  resync: mocks.resync,
  verifyLocalReplica: mocks.verify,
  getPendingConflicts: mocks.conflicts,
  stop: mocks.stop,
  pause: mocks.pause,
};

function fixture() {
  let signed = { userId: OWNER, accessToken: 'verified-access-a', sessionEpoch: 5 };
  const session = { getVerifiedSession: vi.fn(async () => signed) };
  const guard = {
    verifyLegacyMapping: vi.fn(async () => {}),
    assertAppwriteWritersFenced: vi.fn(async () => {}),
    acquireExclusiveLease: vi.fn(async () => ({ isCurrent: () => true, release: vi.fn() })),
  };
  const assertLocalAppwriteStopped = vi.fn(async () => {});
  const options = {
    selectedBackend: 'supabase-cloud' as const,
    featureProfile: 'core-only' as const,
    baseUrl: 'https://isolated.test.supabase.co',
    publishableKey: 'sb_publishable_synthetic_only',
    identity: { legacyUserId: 'existing_mosaic_owner', supabaseUserId: OWNER },
    session,
    guard,
    assertLocalAppwriteStopped,
  };
  const controller = createAppSupabaseCoreBootstrap(options);
  return {
    options, controller, session, guard, assertLocalAppwriteStopped,
    useOtherOwner: () => { signed = { ...signed, userId: OTHER }; },
    rotateToken: () => { signed = { ...signed, sessionEpoch: signed.sessionEpoch + 1, accessToken: 'verified-access-b' }; },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.waitForDatabaseReady.mockResolvedValue(undefined);
  mocks.stop.mockResolvedValue(undefined);
  mocks.pause.mockResolvedValue(undefined);
  mocks.start.mockResolvedValue(run);
  mocks.createCandidateCoreRuntime.mockReturnValue({ start: mocks.start });
});

describe('app-owned Supabase core RxDB bridge (#1027)', () => {
  it('is passive by default, then uses the real Mosaic task/category collections after both local writer checks', async () => {
    const f = fixture();
    expect(f.controller.getPhase()).toBe('idle');
    expect(f.assertLocalAppwriteStopped).not.toHaveBeenCalled();
    expect(mocks.getDatabase).not.toHaveBeenCalled();
    const started = await f.controller.start();
    expect(f.assertLocalAppwriteStopped).toHaveBeenCalledTimes(2);
    expect(mocks.waitForDatabaseReady).toHaveBeenCalledOnce();
    expect(mocks.getDatabase).toHaveBeenCalledOnce();
    expect(mocks.createCandidateCoreRuntime).toHaveBeenCalledWith(expect.objectContaining({
      identity: f.options.identity,
      guard: f.guard,
      session: f.session,
      selectedBackend: 'supabase',
      featureProfile: 'core-only',
      collections: {
        tasks: { domain: 'real-tasks' },
        categories: { domain: 'real-categories' },
      },
    }));
    expect(f.controller.getPhase()).toBe('active');
    await started.awaitInitialReplication();
    await started.resync();
    await started.verifyLocalReplica(() => {});
    expect(mocks.verify).toHaveBeenCalledOnce();
    expect(started.getPendingConflicts()).toEqual({ tasks: [], categories: [] });
    await started.stop();
    expect(mocks.stop).toHaveBeenCalledOnce();
    expect(f.controller.getPhase()).toBe('idle');
    await expect(started.resync()).rejects.toThrow('no longer owns');
  });

  it('passes the explicit private Diary profile and real diary collection to the guarded runtime', async () => {
    const f = fixture();
    const controller = createAppSupabaseCoreBootstrap({
      ...f.options,
      featureProfile: 'core-diary',
    });
    const active = await controller.start();
    expect(f.assertLocalAppwriteStopped).toHaveBeenCalledTimes(2);
    expect(mocks.createCandidateCoreRuntime).toHaveBeenCalledWith(expect.objectContaining({
      selectedBackend: 'supabase',
      featureProfile: 'core-diary',
      collections: {
        tasks: { domain: 'real-tasks' },
        categories: { domain: 'real-categories' },
        diary: { domain: 'real-diary' },
      },
    }));
    await active.stop();
  });

  it('refuses unsigned/foreign Supabase owner before any Appwrite or database work', async () => {
    const f = fixture();
    f.useOtherOwner();
    await expect(f.controller.start()).rejects.toThrow('server-verified account');
    expect(f.assertLocalAppwriteStopped).not.toHaveBeenCalled();
    expect(mocks.waitForDatabaseReady).not.toHaveBeenCalled();
    expect(mocks.createCandidateCoreRuntime).not.toHaveBeenCalled();
    expect(f.controller.getPhase()).toBe('idle');
  });

  it('fails before RxDB if old Appwrite in-tab writer is not stopped', async () => {
    const f = fixture();
    f.assertLocalAppwriteStopped.mockRejectedValueOnce(Error('Appwrite sync active'));
    await expect(f.controller.start()).rejects.toThrow('Appwrite sync active');
    expect(mocks.waitForDatabaseReady).not.toHaveBeenCalled();
    expect(mocks.createCandidateCoreRuntime).not.toHaveBeenCalled();
  });

  it('denies a new signed session or rotated token while local DB loads', async () => {
    const f = fixture();
    let release!: () => void;
    let entered!: () => void;
    const called = new Promise<void>(resolve => { entered = resolve; });
    mocks.waitForDatabaseReady.mockImplementationOnce(() => {
      entered();
      return new Promise<void>(resolve => { release = resolve; });
    });
    const pending = f.controller.start();
    await called;
    f.rotateToken();
    release();
    await expect(pending).rejects.toThrow('account changed during local database');
    expect(mocks.getDatabase).not.toHaveBeenCalled();
    expect(mocks.createCandidateCoreRuntime).not.toHaveBeenCalled();
    expect(f.controller.getPhase()).toBe('idle');
  });

  it('rechecks Appwrite in-tab writer after DB import and rejects reacquisition', async () => {
    const f = fixture();
    f.assertLocalAppwriteStopped.mockResolvedValueOnce(undefined).mockRejectedValueOnce(Error('Appwrite restarted'));
    await expect(f.controller.start()).rejects.toThrow('Appwrite restarted');
    expect(f.assertLocalAppwriteStopped).toHaveBeenCalledTimes(2);
    expect(mocks.createCandidateCoreRuntime).not.toHaveBeenCalled();
    expect(f.controller.getPhase()).toBe('idle');
  });

  it('refuses concurrent starts while the database is opening', async () => {
    const f = fixture();
    let release!: () => void;
    let entered!: () => void;
    const called = new Promise<void>(resolve => { entered = resolve; });
    mocks.waitForDatabaseReady.mockImplementationOnce(() => {
      entered();
      return new Promise<void>(resolve => { release = resolve; });
    });
    const pending = f.controller.start();
    await called;
    await expect(f.controller.start()).rejects.toThrow('already running or blocked');
    release();
    const started = await pending;
    await started.stop();
    expect(mocks.start).toHaveBeenCalledOnce();
  });

  it('locks the controller on an uncertain candidate start, preventing two leases', async () => {
    const f = fixture();
    mocks.start.mockRejectedValueOnce(Error('Candidate core shutdown unconfirmed; writer lease retained'));
    await expect(f.controller.start()).rejects.toThrow('writer lease retained');
    expect(f.controller.getPhase()).toBe('blocked');
    await expect(f.controller.start()).rejects.toThrow('already running or blocked');
    expect(mocks.start).toHaveBeenCalledOnce();
  });

  it('never restarts after a failed stop, and invalidates previously returned handles', async () => {
    const f = fixture();
    const active = await f.controller.start();
    mocks.pause.mockRejectedValueOnce(Error('RxDB stop unconfirmed'));
    await expect(active.stop()).rejects.toThrow('RxDB stop unconfirmed');
    expect(f.controller.getPhase()).toBe('blocked');
    await expect(active.resync()).rejects.toThrow('no longer owns');
    await expect(f.controller.start()).rejects.toThrow('already running or blocked');
  });

  it('retains paused ownership across an ambiguous lease-release failure', async () => {
    const f = fixture();
    const active = await f.controller.start();
    await active.pause();
    expect(mocks.stop).not.toHaveBeenCalled();
    await expect(active.resync()).rejects.toThrow('no longer owns');
    await expect(f.controller.start()).rejects.toThrow('already running');
    mocks.stop.mockRejectedValueOnce(Error('release network outage'));
    await expect(active.stop()).rejects.toThrow('network outage');
    expect(f.controller.getPhase()).toBe('paused');
    await active.stop();
    expect(mocks.pause).toHaveBeenCalledOnce();
    expect(f.controller.getPhase()).toBe('idle');
  });

  it('releases an established candidate if authentication changes immediately after start', async () => {
    const f = fixture();
    mocks.start.mockImplementationOnce(async () => {
      f.useOtherOwner();
      return run;
    });
    await expect(f.controller.start()).rejects.toThrow('server-verified account');
    expect(mocks.stop).toHaveBeenCalledOnce();
    expect(f.controller.getPhase()).toBe('blocked');
  });

  it('never accepts wrong targets, missing security callbacks or unverified legacy mappings', () => {
    const f = fixture();
    expect(() => createAppSupabaseCoreBootstrap({
      ...f.options, selectedBackend: 'appwrite-cloud' as never,
    })).toThrow('explicit provider');
    expect(() => createAppSupabaseCoreBootstrap({
      ...f.options, assertLocalAppwriteStopped: undefined as never,
    })).toThrow('requires local and server');
    expect(() => createAppSupabaseCoreBootstrap({
      ...f.options, guard: {} as never,
    })).toThrow('requires local and server');
    expect(() => createAppSupabaseCoreBootstrap({
      ...f.options, identity: { ...f.options.identity, supabaseUserId: 'not-a-uuid' },
    })).toThrow('Expected a verified Supabase Auth UUID');
  });
});
