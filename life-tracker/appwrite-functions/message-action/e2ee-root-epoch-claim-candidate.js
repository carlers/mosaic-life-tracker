'use strict';
/**
 * OFF, UNWIRED, SCRATCH ONLY: deterministic root-epoch claim planning.
 * No Appwrite SDK, database writes, transaction, root bytes or credentials.
 * An actual CAS requires an independently tested server transaction that
 * creates this unique claim AND updates the owner root together.
 */
const crypto=require('node:crypto');
const PROJECT='6b00671500279e901846';
const DOMAIN='mosaic-e2ee/owner-root-epoch-claim/v1';
const OWNER=/^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/;
const KID=/^k_[a-f0-9]{32}$/;
const OP=/^o_[a-f0-9]{32}$/;
const MAX_GENERATION=2147483647;
function denied(){throw new Error('Root epoch claim candidate is invalid or unavailable.');}
function exact(value,names){
  return !!value&&typeof value==='object'&&!Array.isArray(value)&&
    Object.getPrototypeOf(value)===Object.prototype&&
    Object.keys(value).length===names.length&&
    names.every(name=>Object.hasOwn(value,name));
}
/**
 * Same owner + previous generation MUST produce identical claim ID regardless
 * of request, new key, nonce, ciphertext, opId or clock. A plan is not a
 * proof of transaction commit, approval, or safe root rotation.
 */
function planScratchOwnerRootEpochClaim(owner,expectedGeneration,proposal){
  if(!exact(owner,['projectId','ownerId'])||
     owner.projectId!==PROJECT||typeof owner.ownerId!=='string'||
     !OWNER.test(owner.ownerId)||
     !Number.isSafeInteger(expectedGeneration)||expectedGeneration<1||
     expectedGeneration>=MAX_GENERATION||
     !exact(proposal,['expectedKeyId','nextKeyId','operationId'])||
     typeof proposal.expectedKeyId!=='string'||!KID.test(proposal.expectedKeyId)||
     typeof proposal.nextKeyId!=='string'||!KID.test(proposal.nextKeyId)||
     typeof proposal.operationId!=='string'||!OP.test(proposal.operationId))
    denied();
  const claimId='ec_'+crypto.createHash('sha256')
    .update(DOMAIN+'\0')
    .update(JSON.stringify([PROJECT,owner.ownerId,expectedGeneration]))
    .digest('hex').slice(0,32);
  return Object.freeze({
    schema:1,projectId:PROJECT,ownerId:owner.ownerId,claimId,
    expectedGeneration,nextGeneration:expectedGeneration+1,
    expectedKeyId:proposal.expectedKeyId,nextKeyId:proposal.nextKeyId,
    operationId:proposal.operationId,
  });
}
module.exports={planScratchOwnerRootEpochClaim};
