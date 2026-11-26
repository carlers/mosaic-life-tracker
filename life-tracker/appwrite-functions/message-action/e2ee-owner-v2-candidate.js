'use strict';
/**
 * UNWIRED isolated Scratch owner-private v2 *candidate* writer.
 * This module MUST NOT be imported into main.js or enabled until the
 * separately reviewed v2 table migration and per-account writer floor.
 * Existing v1 service, ciphertext and routing remain untouched.
 */
const crypto=require('node:crypto');
const {Query,Permission,Role}=require('node-appwrite');
const {validateV2PrivateOwnerRecord,OWNER_V2_DOMAINS}=require('./e2ee-owner-v2-policy');
const {OWNER_PRIVATE_V2_SCRATCH_TABLE}=require('./e2ee-owner-v2-schema');

const PROJECT='6b00671500279e901846';
const TABLE=OWNER_PRIVATE_V2_SCRATCH_TABLE.id;
const ROOT_TABLE='account_crypto_roots_v2';
const DATABASE='life_tracker';
const OP=/^o_[a-f0-9]{32}$/;
const REV=/^r_[a-f0-9]{32}$/;
const OWNER=/^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/;
const b64=(s,bytes)=>typeof s==='string'&&/^[A-Za-z0-9_-]+$/.test(s)&&
  Buffer.from(s,'base64url').length===bytes&&
  Buffer.from(s,'base64url').toString('base64url')===s;
function response(status,body){return {status,body};}
function denied(status){return response(status,{error:'Encrypted owner operation unavailable'});}
function rootId(callerId){
  return 'kr_'+crypto.createHash('sha256')
    .update('mosaic-e2ee-owner-v2|'+callerId).digest('hex').slice(0,32);
}
function exactOwnerReadAcl(row,ownerId){
  return Array.isArray(row?.$permissions)&&row.$permissions.length===1&&
    row.$permissions[0]===Permission.read(Role.user(ownerId));
}
function parseRoot(row,ownerId,kid,generation) {
  if(!row||row.$id!==rootId(ownerId)||!exactOwnerReadAcl(row,ownerId)||
     row.user_id!==ownerId||row.key_id!==kid||
     row.generation!==generation||!Number.isSafeInteger(row.generation)||
     generation<1||generation>2147483647)return false;
  let value;
  try{value=JSON.parse(row.envelope);}catch{return false;}
  return value&&typeof value==='object'&&!Array.isArray(value)&&
    Object.keys(value).length===5&&
    ['v','alg','kid','iv','ct'].every(k=>Object.hasOwn(value,k))&&
    value.v===1&&value.alg==='A256GCM'&&value.kid===kid&&
    b64(value.iv,12)&&b64(value.ct,48);
}
async function rootReady(db,owner,kid,generation) {
  let row;
  try{
    row=await db.getRow({databaseId:DATABASE,tableId:ROOT_TABLE,rowId:rootId(owner)});
  }catch(e){if(Number(e?.code)===404)return false;throw e;}
  return parseRoot(row,owner,kid,generation);
}
function rowValid(row,owner,record){
  if(row?.$id!==record.rowId||!exactOwnerReadAcl(row,owner)||
     row.user_id!==owner||row.collection!==record.collection||
     row.policy_version!==2||row.key_generation!==record.keyGeneration||
     row.key_id!==record.envelope.kid||!OP.test(row.op_id||''))return false;
  let envelope,routing;
  try{envelope=JSON.parse(row.envelope);routing=JSON.parse(row.routing_json);}
  catch{return false;}
  return row.revision===envelope?.revision&&row.key_id===envelope?.kid&&
    row.deleted===routing?.isDeleted&&validateV2PrivateOwnerRecord({
      policy:'owner-private-v2',schemaVersion:2,projectId:PROJECT,ownerId:owner,
      rowId:row.$id,collection:row.collection,domain:OWNER_V2_DOMAINS[row.collection],
      envelope,routing,published:{},
    },owner);
}
/**
 * Each invocation rechecks exact project, allowlist and a REQUIRED completed
 * MFA session verification capability. There is no permissive fallback.
 * An explicit opt-in flag defaults OFF, and NO live Function dispatches here.
 * A v2 private owner route is not an alternative to sharing/chat authorization.
 */
async function handleProspectiveOwnerV2Put(db,callerId,payload,sessionJwt,
    verifySession) {
  if(process.env.APPWRITE_FUNCTION_PROJECT_ID!==PROJECT||
     process.env.MOSAIC_E2EE_OWNER_V2_ENABLED!=='true')
    return denied(404);
  if(typeof callerId!=='string'||!OWNER.test(callerId)||!db||
     !payload||typeof payload!=='object'||Array.isArray(payload))
    return denied(401);
  const allowed=(process.env.MOSAIC_E2EE_OWNER_V2_ALLOWED_OWNER_IDS||'')
    .split(',').map(s=>s.trim()).filter(Boolean);
  if(!allowed.includes(callerId))return denied(403);
  if(typeof verifySession!=='function'||!await verifySession(callerId,sessionJwt))
    return denied(401);
  // No hidden future options, inherited action, or alternate transport.
  if(Object.keys(payload).length!==5||
     !['operation','record','opId','expectedRevision','expectedGeneration']
       .every(k=>Object.hasOwn(payload,k))||
     payload.operation!=='put'||!OP.test(payload.opId||'')||
     !(payload.expectedRevision===null||
       typeof payload.expectedRevision==='string'&&REV.test(payload.expectedRevision))||
     !Number.isSafeInteger(payload.expectedGeneration)||
     payload.expectedGeneration<1||payload.expectedGeneration>2147483647||
     !validateV2PrivateOwnerRecord(payload.record,callerId))
    return denied(400);
  const record=payload.record;
  if(record.envelope.revision===payload.expectedRevision)return denied(409);
  if(!await rootReady(db,callerId,record.envelope.kid,payload.expectedGeneration))
    return denied(409);
  const now=new Date().toISOString();
  const envelope=JSON.stringify(record.envelope),routing=JSON.stringify(record.routing);
  const data={
    user_id:callerId,collection:record.collection,
    key_id:record.envelope.kid,key_generation:payload.expectedGeneration,
    revision:record.envelope.revision,policy_version:2,
    envelope,routing_json:routing,op_id:payload.opId,
    updated_at:now,deleted:record.routing.isDeleted,
  };
  if(payload.expectedRevision===null){
    try{
      await db.createRow({
        databaseId:DATABASE,tableId:TABLE,rowId:record.rowId,
        data:{...data,created_at:now},
        permissions:[Permission.read(Role.user(callerId))],
      });
      return response(200,{ok:true,status:'created',revision:record.envelope.revision});
    }catch(e){if(Number(e?.code)!==409)throw e;}
  }
  let saved;
  try{
    saved=await db.getRow({databaseId:DATABASE,tableId:TABLE,rowId:record.rowId});
  }catch(e){if(Number(e?.code)===404)return denied(404);throw e;}
  if(saved?.user_id!==callerId)return denied(404);
  const current={...record,keyGeneration:payload.expectedGeneration};
  if(!rowValid(saved,callerId,current))return denied(409);
  if(saved.op_id===payload.opId){
    if(saved.envelope!==envelope||saved.routing_json!==routing||
       !await rootReady(db,callerId,record.envelope.kid,payload.expectedGeneration))
      return denied(409);
    return response(200,{ok:true,status:'duplicate',revision:saved.revision});
  }
  if(payload.expectedRevision===null||
     saved.revision!==payload.expectedRevision)return denied(409);
  if(!await rootReady(db,callerId,record.envelope.kid,payload.expectedGeneration))
    return denied(409);
  const result=await db.updateRows({
    databaseId:DATABASE,tableId:TABLE,
    queries:[
      Query.equal('$id',record.rowId),Query.equal('user_id',callerId),
      Query.equal('collection',record.collection),Query.equal('revision',payload.expectedRevision),
      Query.equal('key_id',record.envelope.kid),
      Query.equal('key_generation',payload.expectedGeneration),
      Query.equal('policy_version',2),
    ],
    data,
  });
  if(result?.total===1)return response(200,{ok:true,status:'updated',revision:record.envelope.revision});
  if(result?.total>1)throw new Error('Unsafe multi-row owner CAS; abort');
  return denied(409);
}

/**
 * PROSPECTIVE v2 readback. This is NEVER dispatched by the deployed Function.
 * Requires the identical explicit trusted MFA capability; no default stub.
 * Remote row metadata is validated BEFORE returning ciphertext to the caller.
 */
async function handleProspectiveOwnerV2Get(db,callerId,payload,sessionJwt,verifySession){
  if(process.env.APPWRITE_FUNCTION_PROJECT_ID!==PROJECT||
     process.env.MOSAIC_E2EE_OWNER_V2_ENABLED!=='true')return denied(404);
  if(typeof callerId!=='string'||!OWNER.test(callerId)||!db||
     !payload||typeof payload!=='object'||Array.isArray(payload))return denied(401);
  const allowed=(process.env.MOSAIC_E2EE_OWNER_V2_ALLOWED_OWNER_IDS||'')
    .split(',').map(x=>x.trim()).filter(Boolean);
  if(!allowed.includes(callerId))return denied(403);
  if(typeof verifySession!=='function'||!await verifySession(callerId,sessionJwt))
    return denied(401);
  const selector=['operation','rowId','collection','expectedKeyId','expectedGeneration','expectedOpId'];
  if(Object.keys(payload).length!==selector.length||
     !selector.every(k=>Object.hasOwn(payload,k))||
     payload.operation!=='get'||!/^p_[a-f0-9]{32}$/.test(payload.rowId||'')||
     !Object.hasOwn(OWNER_V2_DOMAINS,payload.collection)||
     !/^k_[a-f0-9]{32}$/.test(payload.expectedKeyId||'')||
     typeof payload.expectedOpId!=='string'||!OP.test(payload.expectedOpId)||
     !Number.isSafeInteger(payload.expectedGeneration)||
     payload.expectedGeneration<1||payload.expectedGeneration>2147483647)
    return denied(400);
  if(!await rootReady(db,callerId,payload.expectedKeyId,payload.expectedGeneration))
    return denied(409);
  let row;
  try{
    row=await db.getRow({
      databaseId:DATABASE,tableId:TABLE,rowId:payload.rowId,
    });
  }catch(e){if(Number(e?.code)===404)return denied(404);throw e;}
  if(row?.user_id!==callerId)return denied(404);
  if(row.$id!==payload.rowId||!exactOwnerReadAcl(row,callerId)||
     !OP.test(row.op_id||'')||row.op_id!==payload.expectedOpId||
     row.collection!==payload.collection||row.key_id!==payload.expectedKeyId||
     row.key_generation!==payload.expectedGeneration||
     row.policy_version!==2)return denied(409);
  let envelope,routing;
  try{
    envelope=JSON.parse(row.envelope);
    routing=JSON.parse(row.routing_json);
  }catch{return denied(409);}
  const record={
    policy:'owner-private-v2',schemaVersion:2,
    projectId:PROJECT,ownerId:callerId,rowId:payload.rowId,
    collection:row.collection,domain:OWNER_V2_DOMAINS[row.collection],
    routing,published:{},envelope,
  };
  if(row.revision!==envelope?.revision||
     row.deleted!==routing?.isDeleted||
     !validateV2PrivateOwnerRecord(record,callerId))return denied(409);
  // Recheck after reading; this detects a rotation during GET, not an atomic
  // cross-table write fence. The candidate remains unwired.
  if(!await rootReady(db,callerId,payload.expectedKeyId,payload.expectedGeneration))
    return denied(409);
  // Mirror the authenticated request and validated server row metadata;
  // never claim remote atomic root fencing or client-side queue ack.
  return response(200,{ok:true,record,opId:row.op_id,
    keyGeneration:row.key_generation});
}

module.exports={handleProspectiveOwnerV2Put,handleProspectiveOwnerV2Get};
