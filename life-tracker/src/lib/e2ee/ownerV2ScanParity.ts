/**
 * Dormant Scratch-only read-only parity rehearsal for ORIGINAL authenticated
 * IndexedDB migration intents against a prospective owner-v2 scan port.
 *
 * No Appwrite SDK, HTTP, storage mutation, queue ACK, migration completion or
 * claim of transaction-consistent snapshot. Each scan is independently
 * authenticated in memory; new/changed rows behind the opaque cursor may
 * escape both passes under concurrent writes. A real server-serialized owner
 * migration fence and consistent changefeed are mandatory before cutover.
 */
import {type Bytes,type Owner} from './coreCrypto';
import {
  OWNER_V2_COLLECTIONS,SCRATCH_OWNER_V2_PROJECT,
  type OwnerV2Collection,
} from './ownerPrivateV2Contract';
import type {PreparedV1ToV2} from './ownerV1ToV2MigrationPlan';
import {listV2OwnerMigrationIntents} from './ownerV2PendingIntentStore';
import {
  decryptProspectiveOwnerV2ScanPage,
  type OwnerV2ScanPort,
} from './ownerV2ScanPage';
import type {OwnerV2RehearsalGate} from './ownerV2TransportRehearsal';

const ROW=/^p_[a-f0-9]{32}$/,OP=/^o_[a-f0-9]{32}$/,
  KEY=/^k_[a-f0-9]{32}$/,
  OWNER=/^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/;
const MAX_ROWS=500,MAX_PAGE=25;
function blocked():never{
  throw new Error('Owner-v2 ciphertext parity incomplete; original local intents retained.');
}
function exact(value:unknown,keys:readonly string[]):
  value is Record<string,unknown>{
  return !!value&&typeof value==='object'&&!Array.isArray(value)&&
    Object.getPrototypeOf(value)===Object.prototype&&
    Object.keys(value).length===keys.length&&keys.every(k=>Object.hasOwn(value,k));
}
export type OwnerV2TwoPassParity=Readonly<{
  status:'two-pass-original-ciphertext-observed-not-acknowledged';
  rows:number;collections:number;pages:number;complete:false;
}>;

/**
 * A read-only observation, not a remote receipt:
 * 1. Reauthenticate all FIRST-WRITE-WINS IndexedDB ciphertext intents.
 * 2. Validate every per-collection server scan page through local AES-GCM.
 * 3. Compare EVERY returned ciphertext, revision, opId and epoch to the
 *    exact original persisted plan, refusing any extra/missing/duplicate row.
 * 4. Repeat the full scan to detect changed rows/timestamps; reauthenticate
 *    the original local queue after both passes.
 *
 * Two matching scans can still miss a concurrent ABA or a write arriving
 * behind the cursor; NEVER mark an account migrated or release local bytes.
 * The port and MFA/root gate must be trusted separately; mocks prove only
 * the local validation contract.
 */
export async function rehearsePersistedOwnerV2TwoPassParity(
  root:Bytes,owner:Owner,keyId:string,generation:number,pageSize:number,
  port:OwnerV2ScanPort,gate:OwnerV2RehearsalGate,
):Promise<OwnerV2TwoPassParity>{
  if(!(root instanceof Uint8Array)||root.byteLength!==32||
     !owner||owner.projectId!==SCRATCH_OWNER_V2_PROJECT||
     typeof owner.ownerId!=='string'||!OWNER.test(owner.ownerId)||
     typeof keyId!=='string'||!KEY.test(keyId)||
     !Number.isSafeInteger(generation)||generation<1||
     generation>2147483647||!Number.isSafeInteger(pageSize)||
     pageSize<1||pageSize>MAX_PAGE||
     typeof port?.scan!=='function'||typeof gate?.assertReady!=='function')
    blocked();
  const scope:Owner=Object.freeze({
    projectId:owner.projectId,ownerId:owner.ownerId,
  });
  const key=root.slice();
  try{
    await gate.assertReady(scope);
    const initial=await listV2OwnerMigrationIntents(key,scope);
    if(!Array.isArray(initial)||initial.length<1||
       initial.length>MAX_ROWS)blocked();
    // Freeze the entire authenticated queue snapshot before remote I/O. A
    // different tab cannot change what this invocation compares during awaits.
    const saved:readonly PreparedV1ToV2[]=structuredClone(initial);
    const groups=new Map<OwnerV2Collection,Map<string,PreparedV1ToV2>>();
    const ops=new Set<string>(),rowIds=new Set<string>();
    for(const plan of saved){
      if(plan.projectId!==scope.projectId||plan.ownerId!==scope.ownerId||
         !(OWNER_V2_COLLECTIONS as readonly string[]).includes(plan.collection)||
         !ROW.test(plan.rowId)||rowIds.has(plan.rowId)||
         !OP.test(plan.opId)||ops.has(plan.opId)||
         plan.expectedRevision!==null||plan.expectedGeneration!==generation||
         plan.record?.envelope?.kid!==keyId)blocked();
      ops.add(plan.opId);rowIds.add(plan.rowId);
      const collection=plan.collection;
      let byRow=groups.get(collection);
      if(!byRow){byRow=new Map();groups.set(collection,byRow);}
      if(byRow.has(plan.rowId))blocked();
      byRow.set(plan.rowId,plan);
    }
    // Only select collections with authenticated pending local intents. This
    // says nothing about unrelated remote rows or an entire account corpus.
    let pages=0;
    const firstPass=new Map<string,string>();
    for(let pass=0;pass<2;pass++){
      for(const collection of OWNER_V2_COLLECTIONS){
        const expected=groups.get(collection);
        if(!expected)continue;
        const seen=new Set<string>();
        let cursor:string|null=null,exhausted=false;
        for(let calls=0;calls<=expected.size;calls++){
          const trustedPort:OwnerV2ScanPort={
            scan:async request=>{
              const raw=structuredClone(await port.scan(request));
              if(!exact(raw,['status','body'])||raw.status!==200||
                 !exact(raw.body,['ok','rows','nextCursor','complete'])||
                 !Array.isArray(raw.body.rows))blocked();
              for(const value of raw.body.rows){
                if(!value||typeof value!=='object')blocked();
                const row=value as Record<string,unknown>;
                const local=expected.get(String(row.rowId));
                // Byte-identical JSON for original ciphertext envelope,
                // nonce, revision and scoped metadata, not merely plaintext
                // semantic equivalence under a regenerated key/operation.
                if(!local||row.opId!==local.opId||
                   row.keyGeneration!==generation||
                   JSON.stringify(row.record)!==JSON.stringify(local.record))
                  blocked();
              }
              return raw;
            },
          };
          const page=await decryptProspectiveOwnerV2ScanPage(
            key,scope,collection,keyId,generation,pageSize,cursor,
            trustedPort,gate,
          );
          pages++;
          for(const item of page.records){
            if(!expected.has(item.rowId)||seen.has(item.rowId))
              blocked();
            seen.add(item.rowId);
            const keyOf=collection+':'+item.rowId;
            if(pass===0)firstPass.set(keyOf,item.serverUpdatedAt);
            else if(firstPass.get(keyOf)!==item.serverUpdatedAt)blocked();
          }
          cursor=page.nextCursor;
          if(cursor===null){exhausted=true;break;}
        }
        if(!exhausted||seen.size!==expected.size)blocked();
      }
      await gate.assertReady(scope);
    }
    // Authenticated whole-queue re-read prevents an in-flight second tab from
    // silently replacing or inserting a pending row during the two scans.
    const after=await listV2OwnerMigrationIntents(key,scope);
    if(JSON.stringify(after)!==JSON.stringify(initial))blocked();
    await gate.assertReady(scope);
    return Object.freeze({
      status:'two-pass-original-ciphertext-observed-not-acknowledged',
      rows:saved.length,collections:groups.size,pages,complete:false,
    });
  }catch{return blocked();}
  finally{key.fill(0);}
}
