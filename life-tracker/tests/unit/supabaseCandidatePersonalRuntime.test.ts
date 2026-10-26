import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createCandidatePersonalRuntime, PERSONAL_SOURCE_DOMAINS,
  type CandidatePersonalRuntimeOptions,
} from '../../supabase-poc/candidatePersonalRuntime';

const OWNER='11111111-1111-4111-8111-111111111111';
const OTHER='22222222-2222-4222-8222-222222222222';
const mocks=vi.hoisted(()=>({
  starts:[] as string[],
  stops:[] as string[],
  resyncs:[] as string[],
  verifies:[] as string[],
  startsFailOn:'',
  stopFailOn:'',
  verifyFailOn:'',
  conflicts:new Set<string>(),
  waitSync:vi.fn(async()=>{}),
}));
vi.mock('../../supabase-poc/candidateRxdbPilot',()=>({
  createCandidateRxdbPilot: (options:{domain:string;verifyBucketLinkTargets?:unknown})=>({
    start:()=>{
      mocks.starts.push(options.domain);
      if(mocks.startsFailOn===options.domain)throw new Error('Synthetic start denied '+options.domain);
      if(options.domain==='bucket_task_links'&&!options.verifyBucketLinkTargets)
        throw new Error('Missing independently verified task links');
      return {
        state:{
          awaitInitialReplication:mocks.waitSync,
          awaitInSync:mocks.waitSync,
        },
        resync:()=>{mocks.resyncs.push(options.domain);},
        stop:async()=>{
          mocks.stops.push(options.domain);
          if(mocks.stopFailOn===options.domain)
            throw new Error('Synthetic RxDB stop failed '+options.domain);
        },
      };
    },
    verifyLocalReplica:async (callback:(x:unknown)=>void)=>{
      mocks.verifies.push(options.domain);
      if(mocks.verifyFailOn===options.domain)
        throw new Error('Synthetic owner replica drift '+options.domain);
      callback({phase:'remote',pages:1,rows:1,checked:0,total:1});
      callback({phase:'local',pages:1,rows:1,checked:1,total:1});
      return {pages:1,rows:1,localChecked:1,localTotal:1};
    },
    listPendingConflicts:()=>mocks.conflicts.has(options.domain)?[{id:'dirty'}]:[],
  }),
}));
function fixture(){
  let owner=OWNER,epoch=4,token='signed-personal-token',leaseValid=true;
  const released=vi.fn(async()=>{});
  const guard={
    verifyLegacyMapping:vi.fn(async()=>{}),
    assertAppwriteWritersFenced:vi.fn(async()=>{}),
    assertHostedSixDomainRecoveryReady:vi.fn(async()=>{}),
    assertOriginalOwnerEscrowAndOutboxReady:vi.fn(async()=>{}),
    assertPortableSettingsIsolated:vi.fn(async()=>{}),
    acquireExclusiveLease:vi.fn(async()=>({
      isCurrent:()=>leaseValid,release:released,
    })),
  };
  const session={
    getVerifiedSession:vi.fn(async()=>({userId:owner,sessionEpoch:epoch,accessToken:token})),
  };
  const collections={
    tasks:{},categories:{},diary:{},portableSettings:{},
    bucketList:{},bucketTaskLinks:{},
  };
  const references=vi.fn(async()=>({
    bucket:{ownerId:OWNER,isDeleted:false},
    task:{ownerId:OWNER,isDeleted:false},
  }));
  const options:CandidatePersonalRuntimeOptions={
    selectedBackend:'supabase',
    featureProfile:'personal-review-only',
    identity:{legacyUserId:'sb_original_owner',supabaseUserId:OWNER},
    baseUrl:'https://isolated.test.supabase.co',
    publishableKey:'sb_publishable_synthetic_only',
    session,guard,
    collections:{
      tasks:collections.tasks as never,
      categories:collections.categories as never,
      diary:collections.diary as never,
      portableSettings:collections.portableSettings as never,
      bucketList:collections.bucketList as never,
      bucketTaskLinks:collections.bucketTaskLinks as never,
    },
    verifyBucketLinkTargets:references as never,
  };
  const runtime=createCandidatePersonalRuntime(options);
  return {
    runtime,guard,released,session,options,references,
    switchUser(next=OTHER){owner=next;epoch++;token='replaced-token';},
    revokeLease(){leaseValid=false;},
  };
}
beforeEach(()=>{
  vi.clearAllMocks();
  mocks.starts.length=0;
  mocks.stops.length=0;
  mocks.resyncs.length=0;
  mocks.verifies.length=0;
  mocks.conflicts.clear();
  mocks.startsFailOn='';
  mocks.stopFailOn='';
  mocks.verifyFailOn='';
});
describe('gated six-domain original owner Supabase personal runner (#1027)',()=>{
  it('shares exactly one fenced owner authority across ALL six personal domains',async()=>{
    const f=fixture();
    const run=await f.runtime.start();
    expect(f.guard.verifyLegacyMapping).toHaveBeenCalledOnce();
    expect(f.guard.assertAppwriteWritersFenced).toHaveBeenCalledOnce();
    expect(f.guard.assertHostedSixDomainRecoveryReady).toHaveBeenCalledOnce();
    expect(f.guard.assertOriginalOwnerEscrowAndOutboxReady).toHaveBeenCalledOnce();
    expect(f.guard.assertPortableSettingsIsolated).toHaveBeenCalledOnce();
    expect(f.guard.acquireExclusiveLease).toHaveBeenCalledOnce();
    expect(mocks.starts).toEqual([...PERSONAL_SOURCE_DOMAINS]);
    await run.awaitInitialReplication();
    await run.resync();
    expect(mocks.resyncs).toEqual([...PERSONAL_SOURCE_DOMAINS]);
    await run.stop();
    expect(mocks.stops).toEqual([...PERSONAL_SOURCE_DOMAINS]);
    expect(f.released).toHaveBeenCalledOnce();
    expect(f.runtime.getPhase()).toBe('idle');
  });
  it('refuses missing required guards, duplicate shared collection, or undocumented profile',()=>{
    const f=fixture();
    expect(()=>createCandidatePersonalRuntime({...f.options,
      guard:{...f.guard,assertHostedSixDomainRecoveryReady:undefined} as never,
    })).toThrow(/guards/);
    expect(()=>createCandidatePersonalRuntime({...f.options,
      collections:{...f.options.collections,
        portableSettings:f.options.collections.tasks} as never,
    })).toThrow(/isolated/);
    expect(()=>createCandidatePersonalRuntime({...f.options,
      featureProfile:'core-diary' as never,
    })).toThrow(/review-only/);
    expect(()=>createCandidatePersonalRuntime({...f.options,
      verifyBucketLinkTargets:undefined as never,
    })).toThrow(/guards/);
    expect(mocks.starts).toEqual([]);
  });
  it('never starts a partial writer before ALL signed preflight checks pass',async()=>{
    for(const key of [
      'verifyLegacyMapping','assertAppwriteWritersFenced',
      'assertHostedSixDomainRecoveryReady',
      'assertOriginalOwnerEscrowAndOutboxReady',
      'assertPortableSettingsIsolated',
    ] as const){
      const f=fixture();
      f.guard[key].mockRejectedValueOnce(new Error('Source readiness denied '+key));
      await expect(f.runtime.start()).rejects.toThrow('Source readiness denied '+key);
      expect(f.guard.acquireExclusiveLease).not.toHaveBeenCalled();
      expect(mocks.starts).toEqual([]);
      expect(f.runtime.getPhase()).toBe('idle');
    }
  });
  it('rejects account switch during asynchronous preflight without acquiring lease',async()=>{
    const f=fixture();
    f.guard.assertHostedSixDomainRecoveryReady.mockImplementationOnce(async()=>{
      f.switchUser();
    });
    await expect(f.runtime.start()).rejects.toThrow(/account|owner|session/i);
    expect(f.guard.acquireExclusiveLease).not.toHaveBeenCalled();
    expect(mocks.starts).toEqual([]);
  });
  it('fails closed on old PWA authority or session replacement after lease acquisition',async()=>{
    const a=fixture();
    a.revokeLease();
    await expect(a.runtime.start()).rejects.toThrow(/session or lease/);
    expect(a.released).toHaveBeenCalledOnce();
    expect(mocks.starts).toEqual([]);
    const b=fixture();
    b.guard.acquireExclusiveLease.mockImplementationOnce(async()=>{
      b.switchUser();
      return {isCurrent:()=>true,release:b.released};
    });
    await expect(b.runtime.start()).rejects.toThrow(/account|owner|session/);
    expect(b.released).toHaveBeenCalledOnce();
    expect(mocks.starts).toEqual([]);
  });
  it('on startup failure cancels all already-started writers and releases verified lease',async()=>{
    const f=fixture();
    mocks.startsFailOn='settings';
    await expect(f.runtime.start()).rejects.toThrow(/Synthetic start denied settings/);
    expect(mocks.starts).toEqual(['tasks','categories','diary','settings']);
    expect(mocks.stops).toEqual(['tasks','categories','diary']);
    expect(f.released).toHaveBeenCalledOnce();
    expect(f.runtime.getPhase()).toBe('idle');
  });
  it('retains exclusive remote writer lease when any local RxDB stop is uncertain',async()=>{
    const f=fixture();
    const run=await f.runtime.start();
    mocks.stopFailOn='settings';
    await expect(run.stop()).rejects.toThrow(/lease retained/);
    expect(f.released).not.toHaveBeenCalled();
    expect(f.runtime.getPhase()).toBe('blocked');
    await expect(f.runtime.start()).rejects.toThrow(/blocked/);
  });
  it('requires fresh successful signed remote lease release after pausing local writers',async()=>{
    const f=fixture(),run=await f.runtime.start();
    await run.pause();
    expect(f.released).not.toHaveBeenCalled();
    expect(f.runtime.getPhase()).toBe('paused');
    await expect(run.resync()).rejects.toThrow(/no longer owns/);
    await run.stop();
    expect(f.released).toHaveBeenCalledOnce();
    expect(f.runtime.getPhase()).toBe('idle');
  });
  it('reports 100 only after all six owner replicas independently verify and settle',async()=>{
    const f=fixture(),run=await f.runtime.start();
    const progress:Array<{phase?:string;percent:number}>=[];
    await run.verifyLocalReplica(x=>progress.push(x));
    expect(mocks.verifies).toEqual([...PERSONAL_SOURCE_DOMAINS]);
    expect(progress.at(-1)).toMatchObject({phase:'finalize',percent:100});
    expect(progress.slice(0,-1).every(x=>x.percent<100)).toBe(true);
    await run.stop();
  });
  it('leaves local offline drafts alone and cannot finalize if a domain drifts or conflicts',async()=>{
    const f=fixture(),run=await f.runtime.start();
    mocks.verifyFailOn='bucket_task_links';
    const progress:Array<{phase?:string;percent:number}>=[];
    await expect(run.verifyLocalReplica(x=>progress.push(x))).rejects.toThrow(/replica drift/);
    expect(progress.at(-1)?.percent).toBeLessThan(100);
    mocks.verifyFailOn='';
    mocks.conflicts.add('settings');
    await expect(run.verifyLocalReplica(()=>{})).rejects.toThrow(/conflicts/);
    await run.stop();
  });
  it('never emits 100 if a conflict arrives during the last group settlement',async()=>{
    const f=fixture(),run=await f.runtime.start();
    // Six initial + six refresh awaitInSync + six final awaitInSync.
    // Only the last settlement produces a late Bucket link conflict.
    for(let i=0;i<17;i++)mocks.waitSync.mockImplementationOnce(async()=>{});
    mocks.waitSync.mockImplementationOnce(async()=>{
      mocks.conflicts.add('bucket_task_links');
    });
    const progress:Array<{phase?:string;percent:number}>=[];
    await expect(run.verifyLocalReplica(x=>progress.push(x))).rejects.toThrow(
      /conflicts remain unresolved/
    );
    expect(mocks.verifies).toEqual([...PERSONAL_SOURCE_DOMAINS]);
    expect(progress.length).toBeGreaterThan(0);
    expect(progress.every(x=>x.percent<100)).toBe(true);
    await run.stop();
  });
  it('never emits 100 when the signed owner changes in the final settlement',async()=>{
    const f=fixture(),run=await f.runtime.start();
    for(let i=0;i<17;i++)mocks.waitSync.mockImplementationOnce(async()=>{});
    mocks.waitSync.mockImplementationOnce(async()=>f.switchUser());
    const progress:Array<{percent:number}>=[];
    await expect(run.verifyLocalReplica(x=>progress.push(x))).rejects.toThrow(
      /account|owner|session/i
    );
    expect(progress.length).toBeGreaterThan(0);
    expect(progress.every(x=>x.percent<100)).toBe(true);
    await run.stop();
  });
  it('refuses refresh after owner change, old lease expiry and repeated startup',async()=>{
    const f=fixture(),run=await f.runtime.start();
    await expect(f.runtime.start()).rejects.toThrow(/already started/);
    f.switchUser();
    await expect(run.resync()).rejects.toThrow(/account|owner/i);
    expect(mocks.resyncs).toEqual([]);
    await run.stop();
    const g=fixture(),run2=await g.runtime.start();
    g.revokeLease();
    await expect(run2.resync()).rejects.toThrow(/no longer owns/);
    await run2.stop();
  });
});
