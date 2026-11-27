import {describe,expect,it} from 'vitest';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {planScratchOwnerRootEpochClaim}=require(
  '../../appwrite-functions/message-action/e2ee-root-epoch-claim-candidate.js'
) as {planScratchOwnerRootEpochClaim:(
  owner:{projectId:string;ownerId:string},expectedGeneration:number,
  proposal:{expectedKeyId:string;nextKeyId:string;operationId:string},
)=>Readonly<{
  claimId:string;ownerId:string;projectId:string;expectedGeneration:number;
  nextGeneration:number;expectedKeyId:string;nextKeyId:string;
  operationId:string;schema:number;
}>};
const {SCRATCH_OWNER_ROOT_EPOCH_CLAIMS}=require(
  '../../appwrite-functions/message-action/e2ee-root-epoch-claim-schema.js'
) as {SCRATCH_OWNER_ROOT_EPOCH_CLAIMS:{
  projectId:string;id:string;permissions:readonly string[];
  enabled:boolean;rowSecurity:boolean;
  columns:readonly {key:string}[];indexes:readonly unknown[];
}};
const project='6b00671500279e901846';
const owner={projectId:project,ownerId:'synthetic_root_owner'};
const proposal={
  expectedKeyId:'k_'+'a'.repeat(32),
  nextKeyId:'k_'+'b'.repeat(32),
  operationId:'o_'+'c'.repeat(32),
};
describe('unwired unique root-epoch claim candidate is NOT backend CAS',()=>{
  it('collides across competing proposals for the same owner and old generation',()=>{
    const one=planScratchOwnerRootEpochClaim(owner,3,proposal);
    const competitor=planScratchOwnerRootEpochClaim({...owner},3,{
      expectedKeyId:'k_'+'f'.repeat(32),
      nextKeyId:'k_'+'d'.repeat(32),
      operationId:'o_'+'e'.repeat(32),
    });
    expect(one.claimId).toBe(competitor.claimId);
    expect(one.claimId).toMatch(/^ec_[a-f0-9]{32}$/);
    expect(one.claimId.length).toBeLessThanOrEqual(36);
    expect(one).toMatchObject({
      projectId:project,ownerId:owner.ownerId,schema:1,
      expectedGeneration:3,nextGeneration:4,
    });
    expect(Object.isFrozen(one)).toBe(true);
    expect(Reflect.set(one,'ownerId','other_account')).toBe(false);
    expect(planScratchOwnerRootEpochClaim({...owner,ownerId:'other_account'},3,
      proposal).claimId).not.toBe(one.claimId);
    expect(planScratchOwnerRootEpochClaim(owner,4,proposal).claimId)
      .not.toBe(one.claimId);
  });
  it('rejects alternative environments and arbitrary client claim IDs',()=>{
    for(const scope of [
      {...owner,projectId:'6ae94a2100014d01f5ed'},
      {...owner,projectId:'6ae9599c002ab812f9c3'},
      {...owner,ownerId:''},{...owner,ownerId:'x'.repeat(260)},
      {...owner,claimId:'ec_attacker_supplied'},
    ]){
      expect(()=>planScratchOwnerRootEpochClaim(scope,3,proposal)).toThrow();
    }
    for(const gen of [0,-1,2147483647,2147483648,1.5,NaN]){
      expect(()=>planScratchOwnerRootEpochClaim(owner,gen,proposal)).toThrow();
    }
    for(const changed of [
      {...proposal,operationId:'o_'+'g'.repeat(32)},
      {...proposal,expectedKeyId:'k_'+'g'.repeat(32)},
      {...proposal,claimId:'ec_attacker_supplied'},
      {...proposal,nextKeyId:''},
    ]){
      expect(()=>planScratchOwnerRootEpochClaim(owner,3,changed)).toThrow();
    }
  });
  it('publishes only a disabled unregistered closed Scratch schema',()=>{
    const table=SCRATCH_OWNER_ROOT_EPOCH_CLAIMS;
    expect(table.projectId).toBe(project);
    expect(table.permissions).toEqual([]);
    expect(table.rowSecurity).toBe(true);
    expect(table.enabled).toBe(false);
    expect(table.id.length).toBeLessThanOrEqual(36);
    const keys=table.columns.map(c=>c.key);
    expect(keys).toContain('from_generation');
    expect(keys).toContain('to_generation');
    expect(keys).toContain('before_envelope_sha256');
    expect(keys).toContain('after_envelope_sha256');
    expect(keys).not.toContain('root');
    expect(keys).not.toContain('plaintext');
  });
});
