/**
 * #1027 explicit SIX-domain Supabase owner-private preview runner.
 * NOT imported from the shipped app. Never infer readiness from feature flags.
 * Existing core-only app still starts only tasks/categories/Diary.
 *
 * A future protected caller must provide genuine server-authenticated guards,
 * an isolated PORTABLE Settings collection (not the shared avatar/social
 * Settings collection), full original-owner escrow, all six hosted tables
 * with independent DR, and independently verified Bucket task references.
 */
import type { RxCollection } from 'rxdb';
import type {
  TaskDocument, CategoryDocument, DiaryDocument, SettingsDocument,
  BucketListDocument, BucketTaskLinkDocument,
} from '../src/db/schema';
import {
  assertSingleCloudWriter, type DomainWriter,
} from '../src/lib/backendCapabilities';
import type { SyncProgress } from '../src/lib/syncStatus';
import { validateCandidateIdentity, type CandidateIdentity } from './candidateMapping';
import {
  CandidateAuthError, createCandidateHttpTransport,
  type CandidateSessionProvider, type CandidateVerifiedSession,
} from './candidateHttpTransport';
import { createCandidateCasTransport } from './candidateCasTransport';
import { createCandidateCreateTransport } from './candidateCreateTransport';
import {
  createCandidateRxdbPilot, type CandidateReplicaScan,
  type CandidateVerifiedBucketLinkTargets,
} from './candidateRxdbPilot';
import type { CandidateCoreGuard, CandidateCoreWriterLease } from './candidateCoreRuntime';

type Domain = 'tasks' | 'categories' | 'diary' | 'settings' | 'buckets' | 'bucket_task_links';
export const PERSONAL_SOURCE_DOMAINS: readonly Domain[] = Object.freeze([
  'tasks','categories','diary','settings','buckets','bucket_task_links',
]);
type Run = {
  state: {awaitInitialReplication():Promise<unknown>;awaitInSync():Promise<unknown>};
  resync():void;
  stop():Promise<unknown>;
};

export interface CandidatePersonalGuard extends CandidateCoreGuard {
  /** Server-reviewed hosted SQL/RLS/Storage and complete independent DR. */
  assertHostedSixDomainRecoveryReady(owner: CandidateIdentity): Promise<void>;
  /** Complete independently authenticated owner history and deferred media,
   * Settings and offline outbox MUST be durably preserved before any writer. */
  assertOriginalOwnerEscrowAndOutboxReady(owner: CandidateIdentity): Promise<void>;
  /** Attests this is a distinct filtered owner-private, portable-only RxDB
   * Settings collection, never the shared avatar/social Settings collection. */
  assertPortableSettingsIsolated(owner: CandidateIdentity): Promise<void>;
}
export interface CandidatePersonalRuntimeOptions {
  selectedBackend: 'supabase';
  featureProfile: 'personal-review-only';
  baseUrl: string;
  publishableKey: string;
  identity: CandidateIdentity;
  session: CandidateSessionProvider;
  guard: CandidatePersonalGuard;
  /** Caller MUST provide separate, owner-scoped portable Settings storage. */
  collections: {
    tasks: RxCollection<TaskDocument>;
    categories: RxCollection<CategoryDocument>;
    diary: RxCollection<DiaryDocument>;
    portableSettings: RxCollection<SettingsDocument>;
    bucketList: RxCollection<BucketListDocument>;
    bucketTaskLinks: RxCollection<BucketTaskLinkDocument>;
  };
  verifyBucketLinkTargets: (doc: BucketTaskLinkDocument) =>
    Promise<CandidateVerifiedBucketLinkTargets>;
  fetcher?: typeof fetch;
}

/** Runs in a separate reviewed harness only; old client/runtime stays intact. */
export function createCandidatePersonalRuntime(options: CandidatePersonalRuntimeOptions) {
  if(!options || options.selectedBackend!=='supabase' ||
     options.featureProfile!=='personal-review-only')
    throw new Error('Six-domain personal runner requires explicit review-only profile');
  validateCandidateIdentity(options.identity);
  const { guard, collections, identity }=options;
  if(!guard ||
     !['verifyLegacyMapping','assertAppwriteWritersFenced',
       'acquireExclusiveLease','assertHostedSixDomainRecoveryReady',
       'assertOriginalOwnerEscrowAndOutboxReady',
       'assertPortableSettingsIsolated'].every(name=>
         typeof guard[name as keyof CandidatePersonalGuard]==='function') ||
     !collections ||
     !Object.values(collections).every(c=>c!==null&&typeof c==='object') ||
     new Set(Object.values(collections)).size!==6 ||
     typeof options.verifyBucketLinkTargets!=='function')
    throw new Error('Six-domain owner runner needs six isolated collections and all trusted guards');

  const changes=createCandidateHttpTransport(options);
  const writer=createCandidateCreateTransport(options);
  const cas=createCandidateCasTransport(options);
  const args={identity,session:options.session,changes,writer,cas};
  function make<D extends TaskDocument | CategoryDocument | DiaryDocument |
    SettingsDocument | BucketListDocument | BucketTaskLinkDocument>(
    domain:Domain,collection:RxCollection<D>,
    extra: {verifyBucketLinkTargets?: CandidatePersonalRuntimeOptions['verifyBucketLinkTargets']}={},
  ){
    const pilot=createCandidateRxdbPilot<D>({domain,collection,...args,...extra});
    return {
      domain,
      start:()=>pilot.start(collection),
      verify:(onScan:(x:CandidateReplicaScan)=>void)=>pilot.verifyLocalReplica(onScan),
      conflicts:()=>pilot.listPendingConflicts().length,
    };
  }
  const specs=[
    make('tasks',collections.tasks),
    make('categories',collections.categories),
    make('diary',collections.diary),
    make('settings',collections.portableSettings),
    make('buckets',collections.bucketList),
    make('bucket_task_links',collections.bucketTaskLinks,{
      verifyBucketLinkTargets:options.verifyBucketLinkTargets,
    }),
  ];
  let phase:'idle'|'starting'|'active'|'paused'|'blocked'='idle';
  let authority:{
    lease:CandidateCoreWriterLease;
    signed:CandidateVerifiedSession;
    runs:Run[];
  }|null=null;

  async function checkedOwner():Promise<CandidateVerifiedSession>{
    const signed=await options.session.getVerifiedSession();
    if(!signed || signed.userId!==identity.supabaseUserId ||
       typeof signed.accessToken!=='string'||!signed.accessToken ||
       !Number.isSafeInteger(signed.sessionEpoch)||signed.sessionEpoch<0)
      throw new CandidateAuthError('Six-domain Supabase account is not verified');
    return signed;
  }
  const unchanged=(a:CandidateVerifiedSession,b:CandidateVerifiedSession)=>
    a.userId===b.userId&&a.accessToken===b.accessToken&&
    a.sessionEpoch===b.sessionEpoch;
  async function assertSession(before:CandidateVerifiedSession,lease?:CandidateCoreWriterLease){
    const current=await checkedOwner();
    if(!unchanged(before,current) || lease && !lease.isCurrent())
      throw new CandidateAuthError('Six-domain Supabase owner, session or lease changed');
  }
  async function start(){
    if(phase!=='idle')throw new Error('Six-domain personal runner already started or blocked');
    phase='starting';
    let lease:CandidateCoreWriterLease|null=null;
    const runs:Run[]=[];
    try{
      const before=await checkedOwner();
      // Every awaited preflight rechecks Auth: a stale signed-in owner cannot
      // acquire or reuse the next account's backend writer/escrow authority.
      const preflights=[
        ()=>guard.verifyLegacyMapping(identity),
        ()=>guard.assertAppwriteWritersFenced(identity),
        ()=>guard.assertHostedSixDomainRecoveryReady(identity),
        ()=>guard.assertOriginalOwnerEscrowAndOutboxReady(identity),
        ()=>guard.assertPortableSettingsIsolated(identity),
      ];
      for(const preflight of preflights){
        await preflight();
        await assertSession(before);
      }
      lease=await guard.acquireExclusiveLease(identity);
      await assertSession(before,lease);
      const domainClaims:DomainWriter[]=PERSONAL_SOURCE_DOMAINS.map(domain=>({
        domain,canonicalOwnerId:identity.legacyUserId,
        ownerId:identity.supabaseUserId,target:'supabase-cloud',
        deploymentId:new URL(options.baseUrl).origin,
      }));
      assertSingleCloudWriter(domainClaims);
      for(const item of specs){
        await assertSession(before,lease);
        runs.push(item.start());
      }
      await assertSession(before,lease);
      authority={lease,signed:before,runs};
      phase='active';
      const owned=authority;
      const confirm=async()=>{
        if(phase!=='active'||authority!==owned||!owned.lease.isCurrent())
          throw new Error('Six-domain personal runner no longer owns writer');
        await assertSession(owned.signed,owned.lease);
        if(phase!=='active'||authority!==owned)
          throw new Error('Six-domain runner stopped during verification');
      };
      const pause=async()=>{
        if(authority!==owned||phase!=='active')
          throw new Error('Six-domain personal writer is not active');
        // Shut down ALL local RxDB writers before release; no rollback or
        // competing provider is permitted if even one cancellation fails.
        phase='blocked';
        const stopped=await Promise.allSettled(owned.runs.map(run=>run.stop()));
        if(stopped.some(r=>r.status==='rejected'))
          throw new Error('Six-domain RxDB cancellation unconfirmed; writer lease retained');
        phase='paused';
      };
      const stop=async()=>{
        if(authority!==owned)throw new Error('Six-domain writer no longer current');
        if(phase==='active')await pause();
        if(phase!=='paused')throw new Error('Six-domain writer lease retained after unsafe stop');
        phase='blocked';
        await owned.lease.release();
        authority=null;
        phase='idle';
      };
      return {
        async awaitInitialReplication(){
          await confirm();
          for(const run of owned.runs)await run.state.awaitInitialReplication();
          await confirm();
        },
        async resync(){
          await confirm();
          for(const run of owned.runs)run.resync();
          await confirm();
        },
        /**
         * Read-only full owner anti-entropy, including tombstones. Never
         * advances to 100 if any pending conflict or group drift remains.
         */
        async verifyLocalReplica(onProgress:(value:SyncProgress)=>void){
          await confirm();
          if(specs.some(spec=>spec.conflicts()))
            throw new Error('Six-domain local conflicts require review before verification');
          const total=specs.length;
          let completed=0;
          const emit=(phase:'refresh'|'verify'|'finalize',label:string,
            scan?:CandidateReplicaScan,domain?:string)=>{
            onProgress({
              phase,completed,total:total*3,
              percent:Math.round(completed/(total*3)*100),label,
              groupTotal:total,
              ...(phase==='verify'?{
                activeGroup:domain??null,verifiedGroups:completed-total,
                scannedPages:scan?.pages,scannedRows:scan?.rows,
                localChecked:scan?.phase==='local'?scan.checked:undefined,
                localTotal:scan?.total,
              }:{pendingGroups:specs.map(x=>x.domain)}),
            });
          };
          emit('refresh','Refreshing six personal data groups');
          for(let i=0;i<total;i++){
            await confirm();
            owned.runs[i].resync();
            await owned.runs[i].state.awaitInitialReplication();
            await owned.runs[i].state.awaitInSync();
            await confirm();
            completed++;
            emit('refresh',specs[i].domain+' synced');
          }
          for(const spec of specs){
            await confirm();
            await spec.verify(scan=>emit('verify','Verifying '+spec.domain,scan,spec.domain));
            await confirm();
            completed++;
            emit('verify',spec.domain+' verified',undefined,spec.domain);
          }
          for(let i=0;i<total;i++){
            await confirm();
            owned.runs[i].resync();
            await owned.runs[i].state.awaitInSync();
            await confirm();
            completed++;
            emit('finalize','Confirming '+specs[i].domain+' freshness');
          }
          if(specs.some(spec=>spec.conflicts()))
            throw new Error('Six-domain personal conflicts remain unresolved');
          await confirm();
        },
        pause, stop,
        getPendingConflictCounts(){
          return Object.fromEntries(specs.map(x=>[x.domain,x.conflicts()]));
        },
      };
    }catch(error){
      const stopped=await Promise.allSettled(runs.map(run=>run.stop()));
      if(stopped.some(r=>r.status==='rejected')){
        phase='blocked';
        throw new Error('Six-domain startup cleanup unconfirmed; writer lease retained',{cause:error});
      }
      if(lease){
        try{await lease.release();}
        catch(releaseError){
          phase='blocked';
          throw new Error('Six-domain startup remote lease release failed',{cause:releaseError});
        }
      }
      phase='idle';
      throw error;
    }
  }
  return {start,getPhase:()=>phase};
}
