/**
 * Dormant isolated-Scratch owner v2 multi-row REHEARSAL coordinator.
 *
 * No SDK, fetch, actual E2EE rollout, migration acknowledgment, deletes or
 * queue mutation. The caller provides an independently trusted synthetic
 * Function-shaped test port and true owner/MFA/root generation gate. A
 * partial remote test success must NEVER discard any local ciphertext; a
 * subsequent run must retry the exact original durable op IDs.
 *
 * Do not connect to actual HTTP until atomic server root CAS, old-client
 * plaintext writers, complete data scope and server authorization are
 * independently verified. Passing this exercise is not a migration.
 */
import type {Bytes,Owner} from './coreCrypto';
import {SCRATCH_OWNER_V2_PROJECT} from './ownerPrivateV2Contract';
import {listV2OwnerMigrationIntents} from './ownerV2PendingIntentStore';
import {
  rehearsePersistedOwnerV2RoundTrip,
  type OwnerV2CandidatePort,type OwnerV2RehearsalGate,
} from './ownerV2TransportRehearsal';

const MAX_ROWS=500;
const ID=/^p_[a-f0-9]{32}$/;
const KEY=/^k_[a-f0-9]{32}$/;
const OWNER=/^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/;
function blocked():never{
  throw new Error('Incomplete owner ciphertext batch rehearsal; original pending intents retained.');
}
export type OwnerV2BatchRehearsal=Readonly<{
  status:'synthetic-port-readbacks-not-acknowledged';
  rows:number;created:number;duplicates:number;
}>;
/**
 * Iterate one durable owner generation only. No concurrent writes: each
 * injected transport roundtrip must prove ciphertext readback, and an
 * interrupted run can be restarted using the SAME immutable pending plans.
 *
 * This is a convenience rehearsal orchestrator, not a remote atomic batch:
 * if the second row fails, the first may already exist in the synthetic
 * server. The local queue remains entirely untouched for a safe retry.
 */
export async function rehearseSavedOwnerV2Batch(
  root:Bytes,owner:Owner,keyId:string,generation:number,
  port:OwnerV2CandidatePort,gate:OwnerV2RehearsalGate,
):Promise<OwnerV2BatchRehearsal>{
  if(!(root instanceof Uint8Array)||root.byteLength!==32||
     !owner||owner.projectId!==SCRATCH_OWNER_V2_PROJECT||
     typeof owner.ownerId!=='string'||!OWNER.test(owner.ownerId)||
     typeof keyId!=='string'||!KEY.test(keyId)||
     !Number.isSafeInteger(generation)||generation<1||
     generation>2147483647||typeof port?.put!=='function'||
     typeof port.get!=='function'||typeof gate?.assertReady!=='function')
    blocked();
  const key=root.slice(),scope:Owner=Object.freeze({
    projectId:owner.projectId,ownerId:owner.ownerId,
  });
  try{
    await gate.assertReady(scope);
    const plans=await listV2OwnerMigrationIntents(key,scope);
    if(!Array.isArray(plans)||plans.length<1||plans.length>MAX_ROWS)blocked();
    const original=structuredClone(plans);
    const rowIds=new Set<string>(),operationIds=new Set<string>();
    for(const plan of original){
      if(plan.projectId!==scope.projectId||plan.ownerId!==scope.ownerId||
         plan.expectedRevision!==null||plan.expectedGeneration!==generation||
         plan.record?.envelope?.kid!==keyId||!ID.test(plan.rowId)||
         !/^o_[a-f0-9]{32}$/.test(plan.opId)||
         rowIds.has(plan.rowId)||operationIds.has(plan.opId))
        blocked();
      rowIds.add(plan.rowId);operationIds.add(plan.opId);
    }
    original.sort((a,b)=>a.rowId.localeCompare(b.rowId,'en'));
    // No remote port call until EVERY candidate is authenticated and scoped.
    await gate.assertReady(scope);
    let created=0,duplicates=0;
    for(const plan of original){
      await gate.assertReady(scope);
      const result=await rehearsePersistedOwnerV2RoundTrip(
        key,scope,plan.rowId,keyId,generation,port,gate);
      if(result.rowId!==plan.rowId||result.opId!==plan.opId||
         result.revision!==plan.record.envelope.revision||
         result.collection!==plan.collection||
         result.keyGeneration!==generation)blocked();
      if(result.putStatus==='created')created++;
      else if(result.putStatus==='duplicate')duplicates++;
      else blocked();
    }
    const after=await listV2OwnerMigrationIntents(key,scope);
    if(after.length!==original.length)blocked();
    const sorted=structuredClone(after).sort((a,b)=>
      a.rowId.localeCompare(b.rowId,'en'));
    if(JSON.stringify(sorted)!==JSON.stringify(original))blocked();
    await gate.assertReady(scope);
    return {status:'synthetic-port-readbacks-not-acknowledged',
      rows:original.length,created,duplicates};
  }catch{return blocked();}
  finally{key.fill(0);}
}
