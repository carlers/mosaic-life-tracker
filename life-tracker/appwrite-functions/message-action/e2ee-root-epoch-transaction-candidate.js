'use strict';
/**
 * UNWIRED, OFF, isolated E2EE Scratch only — root epoch atomic-transaction
 * candidate. Nothing imports this from the live message-action dispatcher.
 *
 * This is NOT a production-ready root CAS. Before wiring, require installed
 * TablesDB transaction compatibility, registered server-only claim table,
 * removal of legacy/direct root writers and independently authenticated
 * owner/MFA + independent client key-possession/rotation proof. No trusted
 * backend device-signature verifier or one-shot proof journal is installed.
 * Cross-table transactions
 * cannot fence an old PWA that still writes plaintext to other tables.
 */
const crypto=require('node:crypto');
const {Permission,Role}=require('node-appwrite');
const {planScratchOwnerRootEpochClaim}=require('./e2ee-root-epoch-claim-candidate');
const {SCRATCH_OWNER_ROOT_EPOCH_CLAIMS}=require('./e2ee-root-epoch-claim-schema');
const PROJECT='6b00671500279e901846',DATABASE='life_tracker';
const ROOT_TABLE='account_crypto_roots_v2',CLAIM_TABLE=SCRATCH_OWNER_ROOT_EPOCH_CLAIMS.id;
const OWNER=/^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/;
const KID=/^k_[a-f0-9]{32}$/;
const SHA=/^[a-f0-9]{64}$/;
const CLAIM_ROW_FIELDS=new Set([
  '$id','$databaseId','$tableId','$createdAt','$updatedAt',
  '$sequence','$permissions',
  ...SCRATCH_OWNER_ROOT_EPOCH_CLAIMS.columns.map(column=>column.key),
]);
function closedClaimReadback(row){
  return !!row&&typeof row==='object'&&!Array.isArray(row)&&
    Array.isArray(row.$permissions)&&row.$permissions.length===0&&
    Object.keys(row).every(key=>CLAIM_ROW_FIELDS.has(key));
}
function denied(){throw new Error('Encrypted owner root transaction unavailable or unverified.');}
function exact(v,keys){
  return !!v&&typeof v==='object'&&!Array.isArray(v)&&
    Object.getPrototypeOf(v)===Object.prototype&&
    Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
}
function b64(value,bytes){
  if(typeof value!=='string'||!/^[A-Za-z0-9_-]+$/.test(value))return false;
  const b=Buffer.from(value,'base64url');
  return b.length===bytes&&b.toString('base64url')===value;
}
function parsedRootEnvelope(s,keyId){
  if(typeof s!=='string'||s.length>1024)denied();
  let x;
  try{x=JSON.parse(s);}catch{denied();}
  if(!exact(x,['v','alg','kid','iv','ct'])||x.v!==1||x.alg!=='A256GCM'||
     x.kid!==keyId||!KID.test(keyId)||!b64(x.iv,12)||!b64(x.ct,48))denied();
  return x;
}
function rowId(ownerId){
  return 'kr_'+crypto.createHash('sha256')
    .update('mosaic-e2ee-owner-v2|'+ownerId).digest('hex').slice(0,32);
}
function validRoot(row,ownerId,generation,keyId,expectedEnvelope){
  if(!row||row.$id!==rowId(ownerId)||row.user_id!==ownerId||
     row.generation!==generation||row.key_id!==keyId||
     !Array.isArray(row.$permissions)||row.$permissions.length!==1||
     row.$permissions[0]!==Permission.read(Role.user(ownerId))||
     row.envelope!==expectedEnvelope)denied();
  parsedRootEnvelope(row.envelope,keyId);
}
function digest(s){return crypto.createHash('sha256').update(s).digest('hex');}
function transactionId(value){
  if(typeof value!=='string'||! /^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/.test(value))
    denied();
  return value;
}
/**
 * Simulates exactly two staged operations in a server-side TablesDB
 * transaction: a unique same-owner/same-epoch claim and the new encrypted
 * root. Atomic commit is the sole success path; no local/post-write root
 * read is misrepresented as a CAS. No root or recovery secret is accepted.
 *
 * A successful unit fake does NOT attest the installed Oracle Appwrite
 * version, real transaction conflict behavior or live Function release.
 */
async function prospectiveScratchRootEpochTransaction(
  db,callerId,sessionJwt,verifySession,
  expectedGeneration,proposal,expectedEnvelope,nextEnvelope,
  rootAuthorizationProof,verifyRootAuthorization,
){
  if(process.env.APPWRITE_FUNCTION_PROJECT_ID!==PROJECT||
     process.env.MOSAIC_E2EE_ROOT_TX_CANDIDATE_ENABLED!=='true'||
     typeof callerId!=='string'||!OWNER.test(callerId)||
     !db||typeof db.getRow!=='function'||
     typeof db.createTransaction!=='function'||
     typeof db.createRow!=='function'||
     typeof db.updateRow!=='function'||
     typeof db.updateTransaction!=='function'||
     typeof verifySession!=='function'||
     typeof verifyRootAuthorization!=='function'||
     typeof rootAuthorizationProof!=='string'||
     rootAuthorizationProof.length<43||rootAuthorizationProof.length>512||
     !/^[A-Za-z0-9_-]+$/.test(rootAuthorizationProof)||
     Buffer.from(rootAuthorizationProof,'base64url').toString('base64url')!==
       rootAuthorizationProof)denied();
  const allowed=(process.env.MOSAIC_E2EE_ROOT_TX_ALLOWED_OWNER_IDS||'')
    .split(',').map(s=>s.trim()).filter(Boolean);
  if(!allowed.includes(callerId)||!await verifySession(callerId,sessionJwt))denied();
  const claim=planScratchOwnerRootEpochClaim(
    {projectId:PROJECT,ownerId:callerId},expectedGeneration,proposal);
  if(typeof expectedEnvelope!=='string')denied();
  parsedRootEnvelope(nextEnvelope,claim.nextKeyId);
  const existing=await db.getRow({
    databaseId:DATABASE,tableId:ROOT_TABLE,rowId:rowId(callerId),
  });
  validRoot(existing,callerId,expectedGeneration,claim.expectedKeyId,expectedEnvelope);
  const nextRoot={user_id:callerId,key_id:claim.nextKeyId,
    generation:claim.nextGeneration,envelope:nextEnvelope};
  const oldDigest=digest(expectedEnvelope),newDigest=digest(nextEnvelope);
  if(!SHA.test(oldDigest)||!SHA.test(newDigest)||oldDigest===newDigest)denied();

  // Root rotation must NOT be authorized by account login + MFA alone.
  // This fixed server-computed transcript binds a FUTURE independently vetted
  // device-signature verifier to the exact old and proposed wrapped roots.
  // The opaque proof is never written to a claim or passed to the database.
  // The trusted verifier must enforce key enrollment, freshness, one-use
  // semantics, revocation and authorization separately; NO verifier is wired.
  const authorization=Object.freeze({
    projectId:PROJECT,ownerId:callerId,claimId:claim.claimId,
    expectedGeneration:claim.expectedGeneration,nextGeneration:claim.nextGeneration,
    expectedKeyId:claim.expectedKeyId,nextKeyId:claim.nextKeyId,
    operationId:claim.operationId,
    beforeEnvelopeSha256:oldDigest,afterEnvelopeSha256:newDigest,
  });
  if(!await verifyRootAuthorization(authorization,rootAuthorizationProof))denied();

  // The MFA session may expire while the root read awaits. Before any
  // transaction stage, independently recheck the trusted gate.
  if(!await verifySession(callerId,sessionJwt))denied();
  const tx=await db.createTransaction();
  const id=transactionId(tx?.$id);
  let attemptingCommit=false;
  try{
    await db.createRow({
      databaseId:DATABASE,tableId:CLAIM_TABLE,rowId:claim.claimId,
      data:{owner_id:callerId,from_generation:claim.expectedGeneration,
        to_generation:claim.nextGeneration,expected_key_id:claim.expectedKeyId,
        next_key_id:claim.nextKeyId,operation_id:claim.operationId,
        before_envelope_sha256:oldDigest,after_envelope_sha256:newDigest},
      permissions:[],transactionId:id,
    });
    await db.updateRow({
      databaseId:DATABASE,tableId:ROOT_TABLE,rowId:rowId(callerId),
      data:nextRoot,permissions:[Permission.read(Role.user(callerId))],
      transactionId:id,
    });
    if(!await verifySession(callerId,sessionJwt)||
       !await verifyRootAuthorization(authorization,rootAuthorizationProof))denied();
    attemptingCommit=true;
    const committed=await db.updateTransaction({transactionId:id,commit:true});
    if(committed?.status!=='committed')denied();
    // Readbacks are additional evidence, never a substitute for the commit.
    // If the response is lost, do not retry with a new opId or root envelope.
    const [root,storedClaim]=await Promise.all([
      db.getRow({databaseId:DATABASE,tableId:ROOT_TABLE,rowId:rowId(callerId)}),
      db.getRow({databaseId:DATABASE,tableId:CLAIM_TABLE,rowId:claim.claimId}),
    ]);
    validRoot(root,callerId,claim.nextGeneration,claim.nextKeyId,nextEnvelope);
    // A matching transaction claim does not authorize accidental exposure of
    // owner/epoch metadata through broad grants or unexpected plaintext
    // columns. Readback must match the disabled server-only schema policy.
    if(!closedClaimReadback(storedClaim)||
       storedClaim.$id!==claim.claimId||
       storedClaim.owner_id!==callerId||
       storedClaim.from_generation!==claim.expectedGeneration||
       storedClaim.to_generation!==claim.nextGeneration||
       storedClaim.operation_id!==claim.operationId||
       storedClaim.before_envelope_sha256!==oldDigest||
       storedClaim.after_envelope_sha256!==newDigest||
       storedClaim.expected_key_id!==claim.expectedKeyId||
       storedClaim.next_key_id!==claim.nextKeyId)denied();
    return Object.freeze({status:'committed-and-readback',claimId:claim.claimId,
      generation:claim.nextGeneration});
  }catch{
    // A commit timeout/unknown result must remain an indeterminate failure:
    // only authoritative server reconciliation may later resolve it.
    if(!attemptingCommit){
      try{await db.updateTransaction({transactionId:id,rollback:true});}
      catch{/* fail closed; never acknowledge */}
    }
    denied();
  }
}
module.exports={prospectiveScratchRootEpochTransaction};
