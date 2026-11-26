'use strict';
// UNWIRED prospective v2 policy validator. Existing e2ee_owner_v1 untouched.
const PROJECT='6b00671500279e901846',POLICY='owner-private-v2';
const DOMAINS=Object.freeze({
  tasks:'task',categories:'category',diary:'diary',bucketList:'bucket-list',
  bucketTaskLinks:'bucket-task-link',settings:'settings-private',
  activities:'activity',activityTaskLinks:'activity-task-link',
});
const ROUTING=Object.freeze({
  tasks:['userId','createdAt','updatedAt','isDeleted'],
  categories:['userId','updatedAt','isDeleted'],
  diary:['userId','createdAt','updatedAt','isDeleted'],
  bucketList:['userId','createdAt','updatedAt','isDeleted'],
  bucketTaskLinks:['userId','createdAt','updatedAt','isDeleted'],
  settings:['userId','updatedAt','isDeleted'],
  activities:['userId','createdAt','updatedAt','isDeleted'],
  activityTaskLinks:['userId','createdAt','updatedAt','isDeleted'],
});
const ROW=/^p_[a-f0-9]{32}$/,KEY=/^k_[a-f0-9]{32}$/,REV=/^r_[a-f0-9]{32}$/;
function exact(x,keys){return !!x&&typeof x==='object'&&!Array.isArray(x)&&
  Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));}
function b64(s,bytes,min=0,max=180000){
  if(typeof s!=='string'||s.length<2||s.length>max||s.length%4===1||
     !/^[A-Za-z0-9_-]+$/.test(s))return false;
  try{const b=Buffer.from(s,'base64url');return b.length>=min&&
    (bytes===undefined||b.length===bytes)&&b.toString('base64url')===s;}
  catch{return false;}
}
function envelope(e){return exact(e,['v','alg','kid','revision','iv','ct'])&&
  e.v===1&&e.alg==='A256GCM'&&KEY.test(e.kid)&&REV.test(e.revision)&&
  b64(e.iv,12)&&b64(e.ct,undefined,16);}
function validateV2PrivateOwnerRecord(x,callerId){
  if(!exact(x,['policy','schemaVersion','projectId','ownerId','rowId',
    'collection','domain','routing','published','envelope'])||
    x.policy!==POLICY||x.schemaVersion!==2||
    x.projectId!==PROJECT||x.ownerId!==callerId||
    !ROW.test(x.rowId)||!Object.hasOwn(DOMAINS,x.collection)||
    x.domain!==DOMAINS[x.collection]||!exact(x.published,[])||
    !envelope(x.envelope))return false;
  const routing=x.routing;
  if(!routing||typeof routing!=='object'||Array.isArray(routing)||
     routing.userId!==callerId||typeof routing.isDeleted!=='boolean'||
     Object.keys(routing).length>32)return false;
  for(const [k,v] of Object.entries(routing)){
    if(!ROUTING[x.collection].includes(k))return false;
    if(typeof v==='string'){if(Buffer.byteLength(v,'utf8')>512)return false;}
    else if(!(typeof v==='boolean'||v===null||
      typeof v==='number'&&Number.isSafeInteger(v)))return false;
  }
  return Buffer.byteLength(JSON.stringify(routing),'utf8')<=4096;
}
module.exports={validateV2PrivateOwnerRecord,OWNER_V2_ROUTING:ROUTING,OWNER_V2_DOMAINS:DOMAINS};
