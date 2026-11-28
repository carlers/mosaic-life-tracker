import {afterEach,describe,expect,it,vi} from 'vitest';
import {sealCurrentOwnerOfflineRows} from '../../src/lib/e2ee/ownerOfflineRowSnapshot';
import {sealOwnerPendingImages} from '../../src/lib/e2ee/ownerPendingImageRescue';
import {
  assertCompatibleScratchRawOwnerV2Intent,prepareAndStageScratchRawOwnerV2,
} from '../../src/lib/e2ee/ownerRawV2DurableIntent';
import {
  readV2OwnerMigrationIntent,listV2OwnerMigrationIntents,
  stageV2OwnerMigrationIntent,stageV2OwnerMigrationIntentsAtomic,
} from '../../src/lib/e2ee/ownerV2PendingIntentStore';
import {SCRATCH_OWNER_V2_PROJECT} from '../../src/lib/e2ee/ownerPrivateV2Contract';

const owner={projectId:SCRATCH_OWNER_V2_PROJECT,ownerId:'synthetic_migration_root_cleanup'};
const kid='k_'+'a'.repeat(32);
type Proposed=Parameters<typeof stageV2OwnerMigrationIntent>[2];
const deniedGate={assertReady:async()=>{throw new Error('MFA pending');}};

async function assertCopyZeroized(operation:(key:Uint8Array)=>Promise<unknown>){
  const root=Uint8Array.from({length:32},(_,i)=>i+1);
  const original=Array.from(root);
  let copy:Uint8Array|undefined;
  Object.defineProperty(root,'slice',{value:()=>{
    copy=Uint8Array.prototype.slice.call(root);
    return copy;
  }});
  await expect(operation(root)).rejects.toThrow();
  expect(copy).toBeInstanceOf(Uint8Array);
  expect(copy?Array.from(copy):null).toEqual(Array(32).fill(0));
  expect(Array.from(root)).toEqual(original);
}
afterEach(()=>vi.unstubAllGlobals());

describe('dormant owner migration temporary root copies never survive rejected operations',()=>{
  it('wipes row snapshot root when MFA fails before source reads',async()=>{
    const reader={readAll:vi.fn(async()=>[])};
    await assertCopyZeroized(root=>
      sealCurrentOwnerOfflineRows(owner,root,kid,deniedGate,reader));
    expect(reader.readAll).not.toHaveBeenCalled();
  });
  it('wipes image snapshot root when MFA fails before IndexedDB reads',async()=>{
    const reader={readAll:vi.fn(async()=>[])};
    await assertCopyZeroized(root=>
      sealOwnerPendingImages(owner,root,kid,deniedGate,reader));
    expect(reader.readAll).not.toHaveBeenCalled();
  });
  it('wipes raw durable staging root when a source cannot be cloned',async()=>{
    await assertCopyZeroized(root=>
      prepareAndStageScratchRawOwnerV2(
        root,owner,'tasks',{notCloneable:()=>{}},kid,1));
  });
  it('wipes raw compatible comparison root on invalid authenticated ciphertext',async()=>{
    const bogus={
      projectId:owner.projectId,ownerId:owner.ownerId,collection:'tasks',
      rowId:'p_'+'b'.repeat(32),expectedRevision:null,expectedGeneration:1,
      record:{envelope:{kid}},
    } as unknown as Parameters<typeof assertCompatibleScratchRawOwnerV2Intent>[2];
    await assertCopyZeroized(root=>
      assertCompatibleScratchRawOwnerV2Intent(root,owner,bogus,bogus));
  });
  it('wipes local queue stage root when an invalid plan fails validation',async()=>{
    await assertCopyZeroized(root=>
      stageV2OwnerMigrationIntent(root,owner,null as unknown as Proposed));
  });
  it('wipes local queue read root on an invalid opaque row ID',async()=>{
    await assertCopyZeroized(root=>
      readV2OwnerMigrationIntent(root,owner,'not_an_opaque_id'));
  });
  it('wipes atomic batch root when a malformed proposal fails preflight',async()=>{
    await assertCopyZeroized(root=>
      stageV2OwnerMigrationIntentsAtomic(
        root,owner,[null as unknown as Proposed],[]));
  });
  it('wipes local queue listing root when IndexedDB is unavailable',async()=>{
    vi.stubGlobal('indexedDB',undefined);
    await assertCopyZeroized(root=>
      listV2OwnerMigrationIntents(root,owner));
  });
});
