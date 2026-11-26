'use strict';
/**
 * PROSPECTIVE exact-Scratch v2 private-owner table contract.
 * NOT registered in MOSAIC_TABLES, appwrite-migrate, bootstrap or any Function.
 * Future activation requires additive migration, independent schema+ACL
 * readback, sealed old-writer proof and per-account policy enforcement.
 */
const PROJECT='6b00671500279e901846';
const TABLE='private_owner_ciphertexts_v2';
const columns=Object.freeze([
  {key:'user_id',type:'varchar',size:255,required:true},
  {key:'collection',type:'varchar',size:32,required:true},
  {key:'key_id',type:'varchar',size:36,required:true},
  {key:'key_generation',type:'integer',required:true},
  {key:'revision',type:'varchar',size:36,required:true},
  {key:'policy_version',type:'integer',required:true},
  {key:'envelope',type:'longtext',required:true},
  {key:'routing_json',type:'longtext',required:true},
  {key:'op_id',type:'varchar',size:36,required:true},
  {key:'created_at',type:'varchar',size:50,required:true},
  {key:'updated_at',type:'varchar',size:50,required:true},
  {key:'deleted',type:'boolean',required:true},
].map(Object.freeze));
const indexes=Object.freeze([
  Object.freeze({
    key:'idx_e2ee_owner_v2_cursor',type:'key',
    attributes:Object.freeze(['user_id','collection','updated_at']),
  }),
]);
const OWNER_PRIVATE_V2_SCRATCH_TABLE=Object.freeze({
  projectId:PROJECT,id:TABLE,
  name:'Private Owner Ciphertexts V2 (Isolated Scratch Only)',
  permissions:Object.freeze([]),
  rowSecurity:true,enabled:true,
  columns,indexes,
  policy:'owner-private-v2',
});
module.exports={OWNER_PRIVATE_V2_SCRATCH_TABLE};
