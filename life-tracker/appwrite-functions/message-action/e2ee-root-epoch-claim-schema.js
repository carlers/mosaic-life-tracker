'use strict';
/**
 * UNREGISTERED additive schema candidate for a server-only unique epoch
 * claim, isolated E2EE Scratch project only. DO NOT provision automatically.
 * Root update + claim must commit together under reviewed backend isolation.
 */
const PROJECT='6b00671500279e901846';
const columns=Object.freeze([
  {key:'owner_id',type:'varchar',size:255,required:true},
  {key:'from_generation',type:'integer',required:true},
  {key:'to_generation',type:'integer',required:true},
  {key:'expected_key_id',type:'varchar',size:36,required:true},
  {key:'next_key_id',type:'varchar',size:36,required:true},
  {key:'operation_id',type:'varchar',size:36,required:true},
  // Server-computed authenticated wrapped-envelope digests only.
  {key:'before_envelope_sha256',type:'varchar',size:64,required:true},
  {key:'after_envelope_sha256',type:'varchar',size:64,required:true},
].map(Object.freeze));
const indexes=Object.freeze([Object.freeze({
  key:'idx_e2ee_root_epoch_claim_owner',type:'key',
  attributes:Object.freeze(['owner_id','from_generation']),
})]);
const SCRATCH_OWNER_ROOT_EPOCH_CLAIMS=Object.freeze({
  projectId:PROJECT,id:'owner_root_epoch_claims_v2',
  name:'E2EE Owner Root Epoch Claims (Unregistered Scratch Only)',
  permissions:Object.freeze([]),rowSecurity:true,enabled:false,
  columns,indexes,purpose:'claim-and-root-must-commit-together',
});
module.exports={SCRATCH_OWNER_ROOT_EPOCH_CLAIMS};
