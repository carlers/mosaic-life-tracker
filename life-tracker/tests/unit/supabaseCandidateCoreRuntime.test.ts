import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCandidateCoreRuntime } from '../../supabase-poc/candidateCoreRuntime';

const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const mocks = vi.hoisted(() => ({
  started: [] as string[],
  tasksStop: vi.fn(async () => {}),
  categoriesStop: vi.fn(async () => {}),
  diaryStop: vi.fn(async () => {}),
  taskResync: vi.fn(),
  categoryResync: vi.fn(),
  diaryResync: vi.fn(),
  taskReady: vi.fn(async () => {}),
  categoryReady: vi.fn(async () => {}),
  diaryReady: vi.fn(async () => {}),
  taskSettled: vi.fn(async () => {}),
  categorySettled: vi.fn(async () => {}),
  diarySettled: vi.fn(async () => {}),
  verify: vi.fn(async () => ({ pages: 1, rows: 1, localTotal: 1, localChecked: 1 })),
  refreshConflict: vi.fn(async () => ({ state: 'unchanged' })),
  keepLocalConflict: vi.fn(async () => ({ state: 'applied' })),
  failCategories: false,
  failDiary: false,
}));
vi.mock('../../supabase-poc/candidateRxdbPilot', () => ({
  createCandidateRxdbPilot: (opts: { domain: string }) => ({
    start: () => {
      mocks.started.push(opts.domain);
      if (opts.domain === 'categories' && mocks.failCategories)
        throw new Error('Synthetic category start failed');
      if (opts.domain === 'diary' && mocks.failDiary)
        throw new Error('Synthetic Diary start failed');
      return {
        state: {
          awaitInitialReplication:
            opts.domain === 'tasks' ? mocks.taskReady :
              opts.domain === 'categories' ? mocks.categoryReady : mocks.diaryReady,
          awaitInSync: opts.domain === 'tasks' ? mocks.taskSettled :
            opts.domain === 'categories' ? mocks.categorySettled : mocks.diarySettled,
        },
        resync: opts.domain === 'tasks' ? mocks.taskResync :
          opts.domain === 'categories' ? mocks.categoryResync : mocks.diaryResync,
        stop: opts.domain === 'tasks' ? mocks.tasksStop :
          opts.domain === 'categories' ? mocks.categoriesStop : mocks.diaryStop,
      };
    },
    verifyLocalReplica: mocks.verify,
    listPendingConflicts: () => [],
    refreshPendingConflict: mocks.refreshConflict,
    resolveKeepLocal: mocks.keepLocalConflict,
    conflictEvents$: { subscribe: () => ({ unsubscribe: vi.fn() }) },
  }),
}));

function fixture(withDiary = false) {
  let owner = OWNER;
  let validLease = true;
  const guard = {
    verifyLegacyMapping: vi.fn(async () => {}),
    assertAppwriteWritersFenced: vi.fn(async () => {}),
    acquireExclusiveLease: vi.fn(async () => ({
      isCurrent: () => validLease,
      release: vi.fn(async () => {}),
    })),
  };
  const session = {
    getVerifiedSession: vi.fn(async () => ({
      userId: owner, sessionEpoch: 3, accessToken: 'signed-token-a',
    })),
  };
  const runtime = createCandidateCoreRuntime({
    baseUrl: 'https://isolated.test.supabase.co',
    publishableKey: 'sb_publishable_synthetic_only',
    identity: { legacyUserId: 'legacy_owner', supabaseUserId: OWNER },
    selectedBackend: 'supabase', featureProfile: withDiary ? 'core-diary' : 'core-only',
    collections: { tasks: {} as never, categories: {} as never,
      ...(withDiary ? { diary: {} as never } : {}) },
    session, guard,
  });
  return {
    guard, session, runtime,
    switchTo(other: string) { owner = other; },
    revokeLease() { validLease = false; },
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.started.length = 0;
  mocks.failCategories = false;
  mocks.tasksStop.mockResolvedValue(undefined);
  mocks.categoriesStop.mockResolvedValue(undefined);
  mocks.diaryStop.mockResolvedValue(undefined);
  mocks.failDiary = false;
});

describe('isolated signed two-domain core sync lifecycle (#1027)', () => {
  it('starts task and category replication only after identity, Appwrite and lease fences', async () => {
    const f = fixture();
    const run = await f.runtime.start();
    expect(f.guard.verifyLegacyMapping).toHaveBeenCalledOnce();
    expect(f.guard.assertAppwriteWritersFenced).toHaveBeenCalledOnce();
    expect(f.guard.acquireExclusiveLease).toHaveBeenCalledOnce();
    expect(mocks.started).toEqual(['tasks', 'categories']);
    await run.awaitInitialReplication();
    expect(mocks.taskReady).toHaveBeenCalledOnce();
    expect(mocks.categoryReady).toHaveBeenCalledOnce();
    await run.resync();
    expect(mocks.taskResync).toHaveBeenCalledOnce();
    expect(mocks.categoryResync).toHaveBeenCalledOnce();
    expect(run.getPendingConflicts()).toEqual({ tasks: [], categories: [] });
    await run.stop();
    expect(mocks.tasksStop).toHaveBeenCalledOnce();
    expect(mocks.categoriesStop).toHaveBeenCalledOnce();
    const lease = await f.guard.acquireExclusiveLease.mock.results[0].value;
    expect(lease.release).toHaveBeenCalledOnce();
  });

  it('manually verifies signed tasks/categories/Diary in three real phases and never reports 100 early', async () => {
    const f = fixture(true);
    const run = await f.runtime.start();
    const values: Array<{ phase?: string; percent: number; label: string }> = [];
    await run.verifyLocalReplica(p => values.push(p));
    expect(mocks.verify).toHaveBeenCalledTimes(3);
    expect(mocks.taskSettled).toHaveBeenCalledTimes(2);
    expect(mocks.categorySettled).toHaveBeenCalledTimes(2);
    expect(mocks.diarySettled).toHaveBeenCalledTimes(2);
    expect(values.some(v => v.phase === 'verify')).toBe(true);
    expect(values.at(-1)).toMatchObject({ phase: 'finalize', percent: 100 });
    expect(values.slice(0, -1).every(v => v.percent < 100)).toBe(true);
    await run.stop();
  });

  it('does not finalize local proof or mutate remote state when a signed owner audit finds drift', async () => {
    const f = fixture(true);
    const run = await f.runtime.start();
    mocks.verify.mockRejectedValueOnce(new Error('local/cloud verification found a difference'));
    const values: Array<{ phase?: string; percent: number }> = [];
    await expect(run.verifyLocalReplica(p => values.push(p)))
      .rejects.toThrow(/local\/cloud/);
    expect(values.at(-1)?.percent).toBeLessThan(100);
    expect(mocks.taskSettled).toHaveBeenCalledTimes(1);
    await run.stop();
    mocks.verify.mockReset();
    mocks.verify.mockResolvedValue({ pages: 1, rows: 1, localTotal: 1, localChecked: 1 });
  });

  it('blocks foreign owner and identity mapping failures before any remote writer starts', async () => {
    const foreign = fixture();
    foreign.switchTo(OTHER);
    await expect(foreign.runtime.start()).rejects.toThrow('not verified');
    expect(foreign.guard.acquireExclusiveLease).not.toHaveBeenCalled();
    expect(mocks.started).toEqual([]);

    const invalid = fixture();
    invalid.guard.verifyLegacyMapping.mockRejectedValue(Error('Legacy identity unverified'));
    await expect(invalid.runtime.start()).rejects.toThrow('Legacy identity unverified');
    expect(invalid.guard.acquireExclusiveLease).not.toHaveBeenCalled();
    expect(mocks.started).toEqual([]);
  });

  it('drains an in-flight reviewed write before cancellation/release and rejects queued reviews', async () => {
    const f = fixture();
    const run = await f.runtime.start();
    let finish!: () => void;
    mocks.keepLocalConflict.mockImplementationOnce(() => new Promise(resolve => {
      finish = () => resolve({ state: 'applied' });
    }));
    const resolving = run.keepLocalConflict('tasks', 'task_one', '7');
    await vi.waitFor(() => expect(mocks.keepLocalConflict).toHaveBeenCalledOnce());
    const stopping = run.stop();
    const late = run.refreshConflict('tasks', 'task_one');
    const lateDenied = expect(late).rejects.toThrow('no longer active');
    expect(mocks.tasksStop).not.toHaveBeenCalled();
    finish();
    await resolving;
    await stopping;
    await lateDenied;
    expect(mocks.tasksStop).toHaveBeenCalledOnce();
    expect(mocks.refreshConflict).not.toHaveBeenCalled();
  });

  it('refuses a reviewed write after owner replacement or lease revocation', async () => {
    const f = fixture();
    const run = await f.runtime.start();
    f.switchTo(OTHER);
    await expect(run.keepLocalConflict('tasks', 'task_one', '7')).rejects.toThrow('not verified');
    expect(mocks.keepLocalConflict).not.toHaveBeenCalled();
    f.switchTo(OWNER);
    f.revokeLease();
    await expect(run.keepLocalConflict('tasks', 'task_one', '7')).rejects.toThrow('no longer active');
    expect(mocks.keepLocalConflict).not.toHaveBeenCalled();
    await run.stop();
  });

  it('refuses Appwrite writer coexistence without acquiring a Supabase lease', async () => {
    const f = fixture();
    f.guard.assertAppwriteWritersFenced.mockRejectedValue(Error('Appwrite still owns tasks'));
    await expect(f.runtime.start()).rejects.toThrow('Appwrite still owns tasks');
    expect(f.guard.acquireExclusiveLease).not.toHaveBeenCalled();
    expect(mocks.started).toEqual([]);
  });

  it('fails closed after session replacement or revoked lease and requires an explicit restart', async () => {
    const f = fixture();
    const run = await f.runtime.start();
    f.switchTo(OTHER);
    await expect(run.resync()).rejects.toThrow('not verified');
    expect(mocks.taskResync).not.toHaveBeenCalled();
    await run.stop();

    const leaseFixture = fixture();
    const leaseRun = await leaseFixture.runtime.start();
    leaseFixture.revokeLease();
    await expect(leaseRun.resync()).rejects.toThrow('no longer active');
    expect(mocks.taskResync).not.toHaveBeenCalled();
    await leaseRun.stop();
  });

  it('rolls back partially started task replication and releases lease if category start fails', async () => {
    const f = fixture();
    mocks.failCategories = true;
    await expect(f.runtime.start()).rejects.toThrow('Synthetic category start failed');
    expect(mocks.started).toEqual(['tasks', 'categories']);
    expect(mocks.tasksStop).toHaveBeenCalledOnce();
    const lease = await f.guard.acquireExclusiveLease.mock.results[0].value;
    expect(lease.release).toHaveBeenCalledOnce();
  });

  it('never releases writer lease if stopping either replication remains unconfirmed', async () => {
    const f = fixture();
    const run = await f.runtime.start();
    mocks.tasksStop.mockRejectedValueOnce(Error('Synthetic RxDB cancellation failure'));
    await expect(run.stop()).rejects.toThrow('writer lease retained');
    const lease = await f.guard.acquireExclusiveLease.mock.results[0].value;
    expect(lease.release).not.toHaveBeenCalled();
    await expect(f.runtime.start()).rejects.toThrow('already started');
    await expect(run.stop()).rejects.toThrow('writer lease retained');
    expect(lease.release).not.toHaveBeenCalled();
  });

  it('pauses both writers without remote Auth, retaining the lease until signed release', async () => {
    const f = fixture();
    const run = await f.runtime.start();
    const lease = await f.guard.acquireExclusiveLease.mock.results[0].value;
    f.session.getVerifiedSession.mockRejectedValue(Error('JWT expired'));
    await run.pause();
    await run.pause();
    expect(mocks.tasksStop).toHaveBeenCalledOnce();
    expect(mocks.categoriesStop).toHaveBeenCalledOnce();
    expect(lease.release).not.toHaveBeenCalled();
    await expect(run.resync()).rejects.toThrow('no longer active');
    await expect(f.runtime.start()).rejects.toThrow('already started');
    lease.release.mockRejectedValueOnce(Error('release response lost'));
    await expect(run.stop()).rejects.toThrow('response lost');
    await expect(f.runtime.start()).rejects.toThrow('already started');
    await run.stop();
    expect(mocks.tasksStop).toHaveBeenCalledOnce();
    expect(lease.release).toHaveBeenCalledTimes(2);
  });

  it('fences a resync whose Auth verification returns after the local pause', async () => {
    const f = fixture();
    const run = await f.runtime.start();
    let resolve!: (signed: { userId: string; accessToken: string; sessionEpoch: number }) => void;
    f.session.getVerifiedSession.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const pending = run.resync();
    await run.pause();
    resolve({ userId: OWNER, accessToken: 'signed-token-a', sessionEpoch: 3 });
    await expect(pending).rejects.toThrow('no longer active');
    expect(mocks.taskResync).not.toHaveBeenCalled();
    expect(mocks.categoryResync).not.toHaveBeenCalled();
    await run.stop();
  });

  it('denies concurrent starts and rejects runtime creation without safety guards', async () => {
    const f = fixture();
    const run = await f.runtime.start();
    await expect(f.runtime.start()).rejects.toThrow('already started');
    await run.stop();
    expect(() => createCandidateCoreRuntime({
      baseUrl: 'https://isolated.test.supabase.co',
      publishableKey: 'sb_publishable_synthetic_only',
      identity: { legacyUserId: 'legacy_owner', supabaseUserId: OWNER },
      selectedBackend: 'supabase', featureProfile: 'core-only',
      collections: { tasks: {} as never, categories: {} as never },
      session: f.session, guard: {} as never,
    })).toThrow('requires all migration safety guards');
  });
  it('starts Diary only under explicit personal profile, sharing the SAME owner lease', async () => {
    const f = fixture(true);
    const run = await f.runtime.start();
    expect(f.guard.verifyLegacyMapping).toHaveBeenCalledOnce();
    expect(f.guard.assertAppwriteWritersFenced).toHaveBeenCalledOnce();
    expect(f.guard.acquireExclusiveLease).toHaveBeenCalledOnce();
    expect(mocks.started).toEqual(['tasks', 'categories', 'diary']);
    expect(run).toHaveProperty('diaryState');
    await run.awaitInitialReplication();
    expect(mocks.taskReady).toHaveBeenCalledOnce();
    expect(mocks.categoryReady).toHaveBeenCalledOnce();
    expect(mocks.diaryReady).toHaveBeenCalledOnce();
    await run.resync();
    expect(mocks.diaryResync).toHaveBeenCalledOnce();
    expect(run.getPendingConflicts()).toEqual({ tasks: [], categories: [], diary: [] });
    await run.stop();
    expect(mocks.tasksStop).toHaveBeenCalledOnce();
    expect(mocks.categoriesStop).toHaveBeenCalledOnce();
    expect(mocks.diaryStop).toHaveBeenCalledOnce();
    const lease = await f.guard.acquireExclusiveLease.mock.results[0].value;
    expect(lease.release).toHaveBeenCalledOnce();
  });

  it('stops both original writers and releases the single lease on Diary startup failure', async () => {
    const f = fixture(true);
    mocks.failDiary = true;
    await expect(f.runtime.start()).rejects.toThrow('Synthetic Diary start failed');
    expect(mocks.started).toEqual(['tasks', 'categories', 'diary']);
    expect(mocks.tasksStop).toHaveBeenCalledOnce();
    expect(mocks.categoriesStop).toHaveBeenCalledOnce();
    const lease = await f.guard.acquireExclusiveLease.mock.results[0].value;
    expect(lease.release).toHaveBeenCalledOnce();
  });

  it('does not construct a Diary writer under core-only even when starting normally', async () => {
    const f = fixture();
    const run = await f.runtime.start();
    expect(mocks.started).toEqual(['tasks', 'categories']);
    expect(run).not.toHaveProperty('diaryState');
    expect(run.getPendingConflicts()).not.toHaveProperty('diary');
    await run.stop();
  });

});
