import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppSupabasePersonalBootstrap } from '../../src/lib/supabasePersonalBootstrap';

const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const mocks = vi.hoisted(() => ({
  driver: 'supabase' as 'supabase' | 'appwrite',
  waitForDatabaseReady: vi.fn(async () => {}),
  getDatabase: vi.fn(),
  createRuntime: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(async () => {}),
  pause: vi.fn(async () => {}),
  ready: vi.fn(async () => {}),
  resync: vi.fn(async () => {}),
  verify: vi.fn(async () => {}),
  conflicts: vi.fn(() => ({tasks:0,categories:0,diary:0,settings:0,buckets:0,bucket_task_links:0})),
}));
vi.mock('../../src/lib/coreBackendConfig', () => ({
  CORE_BACKEND: { get driver() { return mocks.driver; } },
}));
vi.mock('../../src/lib/databaseBootstrap', () => ({
  waitForDatabaseReady: mocks.waitForDatabaseReady,
}));
vi.mock('../../src/db/database', () => ({
  getDatabase: mocks.getDatabase,
}));
vi.mock('../../supabase-poc/candidatePersonalRuntime', () => ({
  createCandidatePersonalRuntime: mocks.createRuntime,
}));

const run = {
  awaitInitialReplication: mocks.ready,
  resync: mocks.resync,
  verifyLocalReplica: mocks.verify,
  getPendingConflictCounts: mocks.conflicts,
  stop: mocks.stop,
  pause: mocks.pause,
};
const localDatabase = {};
const makeCollection = (name: string) => ({
  name, database: localDatabase,
  insert: vi.fn(() => { throw new Error('Unexpected local copy'); }),
  find: vi.fn(() => { throw new Error('Unexpected local read'); }),
});
function dbFixture() {
  return {
    tasks: makeCollection('tasks'),
    categories: makeCollection('categories'),
    diary: makeCollection('diary'),
    settings: makeCollection('settings'),
    portableSettings: makeCollection('portableSettings'),
    bucketList: makeCollection('bucketList'),
    bucketTaskLinks: makeCollection('bucketTaskLinks'),
  };
}
function fixture() {
  let signed = {userId:OWNER,accessToken:'synthetic-owner-token',sessionEpoch:3};
  const session = {getVerifiedSession:vi.fn(async () => signed)};
  const guard = {
    verifyLegacyMapping:vi.fn(async () => {}),
    assertAppwriteWritersFenced:vi.fn(async () => {}),
    assertHostedSixDomainRecoveryReady:vi.fn(async () => {}),
    assertOriginalOwnerEscrowAndOutboxReady:vi.fn(async () => {}),
    assertPortableSettingsIsolated:vi.fn(async () => {}),
    acquireExclusiveLease:vi.fn(async () => ({isCurrent:() => true,release:vi.fn()})),
  };
  const assertLocalAppwriteStopped = vi.fn(async () => {});
  const verifyBucketLinkTargets = vi.fn(async () => ({
    bucket:{ownerId:OWNER,isDeleted:false},
    task:{ownerId:OWNER,isDeleted:false},
  }));
  const options = {
    selectedBackend: 'supabase-cloud' as const,
    featureProfile: 'personal-review-only' as const,
    baseUrl: 'https://isolated.test.supabase.co',
    publishableKey:'sb_publishable_synthetic_only',
    identity:{legacyUserId:'sb_original_owner',supabaseUserId:OWNER},
    session,guard,assertLocalAppwriteStopped,verifyBucketLinkTargets,
  };
  const bootstrap = createAppSupabasePersonalBootstrap(options);
  return {bootstrap,options,guard,session,assertLocalAppwriteStopped,verifyBucketLinkTargets,
    switchUser:() => {signed={...signed,userId:OTHER};},
    rotateToken:() => {signed={...signed,sessionEpoch:4,accessToken:'rotated'};},
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.driver = 'supabase';
  mocks.getDatabase.mockReturnValue(dbFixture());
  mocks.waitForDatabaseReady.mockResolvedValue(undefined);
  mocks.pause.mockResolvedValue(undefined);
  mocks.stop.mockResolvedValue(undefined);
  mocks.start.mockResolvedValue(run);
  mocks.createRuntime.mockReturnValue({start:mocks.start});
});

describe('passive six-domain Mosaic app bridge (#1027)', () => {
  it('is inert until explicit start; after two local writer stops selects real owner-private collections',async () => {
    const f=fixture();
    expect(f.bootstrap.getPhase()).toBe('idle');
    expect(mocks.getDatabase).not.toHaveBeenCalled();
    expect(mocks.createRuntime).not.toHaveBeenCalled();
    const started=await f.bootstrap.start();
    const db=mocks.getDatabase.mock.results[0].value;
    expect(f.assertLocalAppwriteStopped).toHaveBeenCalledTimes(2);
    expect(mocks.waitForDatabaseReady).toHaveBeenCalledOnce();
    expect(mocks.createRuntime).toHaveBeenCalledWith(expect.objectContaining({
      selectedBackend:'supabase',featureProfile:'personal-review-only',
      guard:f.guard,session:f.session,verifyBucketLinkTargets:f.verifyBucketLinkTargets,
      collections:{
        tasks:db.tasks,categories:db.categories,diary:db.diary,
        portableSettings:db.portableSettings,
        bucketList:db.bucketList,bucketTaskLinks:db.bucketTaskLinks,
      },
    }));
    expect(mocks.createRuntime.mock.calls[0][0].collections.portableSettings).not.toBe(db.settings);
    expect(db.settings.find).not.toHaveBeenCalled();
    expect(db.settings.insert).not.toHaveBeenCalled();
    expect(db.portableSettings.find).not.toHaveBeenCalled();
    await started.awaitInitialReplication();
    await started.resync();
    await started.verifyLocalReplica(() => {});
    expect(started.getPendingConflictCounts()).toMatchObject({settings:0,buckets:0});
    await started.stop();
    expect(mocks.pause).toHaveBeenCalledOnce();
    expect(mocks.stop).toHaveBeenCalledOnce();
    expect(f.bootstrap.getPhase()).toBe('idle');
    await expect(started.resync()).rejects.toThrow(/no longer owns/);
  });

  it('rejects unsigned foreign identity before touching existing Appwrite or RxDB',async () => {
    const f=fixture();
    f.switchUser();
    await expect(f.bootstrap.start()).rejects.toThrow(/matching verified owner/);
    expect(f.assertLocalAppwriteStopped).not.toHaveBeenCalled();
    expect(mocks.getDatabase).not.toHaveBeenCalled();
    expect(mocks.createRuntime).not.toHaveBeenCalled();
    expect(f.bootstrap.getPhase()).toBe('idle');
  });

  it('requires every server escrow, old-writer and Bucket reference guard even when constructed', () => {
    const f=fixture();
    expect(() => createAppSupabasePersonalBootstrap({
      ...f.options,guard:{...f.guard,assertOriginalOwnerEscrowAndOutboxReady:undefined} as never,
    })).toThrow(/signed owner/);
    expect(() => createAppSupabasePersonalBootstrap({
      ...f.options,verifyBucketLinkTargets:undefined as never,
    })).toThrow(/signed owner/);
    expect(() => createAppSupabasePersonalBootstrap({
      ...f.options,assertLocalAppwriteStopped:undefined as never,
    })).toThrow(/signed owner/);
    expect(() => createAppSupabasePersonalBootstrap({
      ...f.options,featureProfile:'core-diary' as never,
    })).toThrow(/personal review profile/);
  });

  it('refuses Appwrite provider and shared Settings even when other owner checks pass',async () => {
    const f=fixture();
    mocks.driver='appwrite';
    await expect(f.bootstrap.start()).rejects.toThrow(/isolated Supabase backend/);
    expect(mocks.createRuntime).not.toHaveBeenCalled();
    mocks.driver='supabase';
    const db=dbFixture();
    db.portableSettings=db.settings;
    mocks.getDatabase.mockReturnValue(db);
    await expect(f.bootstrap.start()).rejects.toThrow(/distinct Supabase-only/);
    expect(mocks.createRuntime).not.toHaveBeenCalled();
  });

  it('refuses a hosted prerelease before any local writer attempt or lease',async () => {
    const f=fixture();
    f.guard.assertHostedSixDomainRecoveryReady.mockRejectedValueOnce(Error('Release evidence absent'));
    await expect(f.bootstrap.start()).rejects.toThrow('Release evidence absent');
    expect(f.bootstrap.getPhase()).toBe('idle');
    expect(mocks.waitForDatabaseReady).not.toHaveBeenCalled();
    expect(mocks.createRuntime).not.toHaveBeenCalled();
    expect(f.guard.acquireExclusiveLease).not.toHaveBeenCalled();
  });

  it('stops before opening RxDB when the in-tab Appwrite writer has not stopped',async () => {
    const f=fixture();
    f.assertLocalAppwriteStopped.mockRejectedValueOnce(Error('Appwrite writer still active'));
    await expect(f.bootstrap.start()).rejects.toThrow('Appwrite writer still active');
    expect(mocks.waitForDatabaseReady).not.toHaveBeenCalled();
    expect(mocks.createRuntime).not.toHaveBeenCalled();
  });

  it('rejects an auth token rotation during DB opening and never acquires a lease',async () => {
    const f=fixture();
    let release!: () => void;
    let entered!: () => void;
    const ready=new Promise<void>(resolve => {entered=resolve;});
    mocks.waitForDatabaseReady.mockImplementationOnce(() => {
      entered();
      return new Promise<void>(resolve => {release=resolve;});
    });
    const pending=f.bootstrap.start();
    await ready;
    f.rotateToken();
    release();
    await expect(pending).rejects.toThrow(/owner changed while opening/);
    expect(mocks.getDatabase).not.toHaveBeenCalled();
    expect(mocks.createRuntime).not.toHaveBeenCalled();
    expect(f.bootstrap.getPhase()).toBe('idle');
  });

  it('rechecks local Appwrite writer after awaited database initialization',async () => {
    const f=fixture();
    f.assertLocalAppwriteStopped.mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(Error('old writer restarted'));
    await expect(f.bootstrap.start()).rejects.toThrow(/old writer restarted/);
    expect(mocks.getDatabase).toHaveBeenCalledOnce();
    expect(mocks.createRuntime).not.toHaveBeenCalled();
  });

  it('refuses two startup attempts while opening local storage',async () => {
    const f=fixture();
    let release!: () => void;
    let entered!: () => void;
    const ready=new Promise<void>(resolve => {entered=resolve;});
    mocks.waitForDatabaseReady.mockImplementationOnce(() => {
      entered();
      return new Promise<void>(resolve => {release=resolve;});
    });
    const pending=f.bootstrap.start();
    await ready;
    await expect(f.bootstrap.start()).rejects.toThrow(/already running/);
    release();
    const active=await pending;
    await active.stop();
    expect(mocks.start).toHaveBeenCalledOnce();
  });

  it('stops the created candidate if its session is replaced before returning ownership',async () => {
    const f=fixture();
    mocks.start.mockImplementationOnce(async () => {
      f.switchUser();
      return run;
    });
    await expect(f.bootstrap.start()).rejects.toThrow(/matching verified owner/);
    expect(mocks.stop).toHaveBeenCalledOnce();
    expect(f.bootstrap.getPhase()).toBe('blocked');
    await expect(f.bootstrap.start()).rejects.toThrow(/already running/);
  });

  it('never issues a fresh lease after startup cleanup cannot be proven',async () => {
    const f=fixture();
    mocks.start.mockImplementationOnce(async () => {f.switchUser();return run;});
    mocks.stop.mockRejectedValueOnce(Error('shutdown ambiguous'));
    await expect(f.bootstrap.start()).rejects.toThrow(/cleanup unconfirmed/);
    expect(f.bootstrap.getPhase()).toBe('blocked');
    await expect(f.bootstrap.start()).rejects.toThrow(/already running/);
  });

  it('holds the writer blocked on uncertain local pause, and retries release only on same run',async () => {
    const a=fixture();
    const active=await a.bootstrap.start();
    mocks.pause.mockRejectedValueOnce(Error('writer stop uncertain'));
    await expect(active.stop()).rejects.toThrow(/writer stop uncertain/);
    expect(a.bootstrap.getPhase()).toBe('blocked');
    await expect(a.bootstrap.start()).rejects.toThrow(/already running/);
    await expect(active.resync()).rejects.toThrow(/no longer owns/);
  });

  it('after safe pause keeps the same lease through failed release and retries without new start',async () => {
    const f=fixture();
    const active=await f.bootstrap.start();
    await active.pause();
    expect(f.bootstrap.getPhase()).toBe('paused');
    await expect(active.resync()).rejects.toThrow(/no longer owns/);
    mocks.stop.mockRejectedValueOnce(Error('release offline'));
    await expect(active.stop()).rejects.toThrow(/release offline/);
    expect(f.bootstrap.getPhase()).toBe('paused');
    await active.stop();
    expect(mocks.pause).toHaveBeenCalledOnce();
    expect(mocks.start).toHaveBeenCalledOnce();
    expect(f.bootstrap.getPhase()).toBe('idle');
  });
});
