// Source-only, server-enforced owner ciphertext transport for synthetic Scratch (#1662 M2).
// Default OFF. Never accept application plaintext, public shares, or recipient keys.
// Normal Mosaic replication is untouched until independently reviewed migration/ACL gates.
const crypto = require('node:crypto');
const { Query, Permission, Role } = require('node-appwrite');
const { pilotSessionIsAuthenticated } = require('./e2ee-pilot');

const PROJECT = '6ae94a2100014d01f5ed';
const DATABASE = process.env.APPWRITE_DATABASE_ID || 'life_tracker';
const ROOT_TABLE = 'account_crypto_roots_v2';
const DOC_TABLE = 'private_owner_ciphertexts_v1';
const RE = {
  row: /^p_[a-f0-9]{32}$/,
  key: /^k_[a-f0-9]{32}$/,
  revision: /^r_[a-f0-9]{32}$/,
  operation: /^o_[a-f0-9]{32}$/,
};
const COLLECTIONS = Object.freeze({
  tasks: ['task', ['userId','date','createdAt','updatedAt','isDeleted','reminderTime','visibility']],
  categories: ['category', ['userId','isDeleted','visibility','updatedAt']],
  diary: ['diary', ['userId','date','createdAt','updatedAt','isDeleted','visibility']],
  bucketList: ['bucket-list', ['userId','createdAt','updatedAt','isDeleted']],
  bucketTaskLinks: ['bucket-task-link', ['userId','createdAt','updatedAt','isDeleted']],
  settings: ['settings-private', ['userId','updatedAt','isDeleted']],
});
const resp = (status, body) => ({ status, body });
function exact(v, keys) {
  return v !== null && typeof v === 'object' && !Array.isArray(v) &&
    Object.keys(v).length === keys.length &&
    keys.every(k => Object.prototype.hasOwnProperty.call(v, k));
}
function b64(s, bytes, maxLength = 180000) {
  if (typeof s !== 'string' || s.length < 2 || s.length > maxLength ||
      !/^[A-Za-z0-9_-]+$/.test(s)) return false;
  const b = Buffer.from(s, 'base64url');
  return (bytes === undefined || b.length === bytes) && b.toString('base64url') === s;
}
function wrappedRoot(v) {
  return exact(v,['v','alg','kid','iv','ct']) && v.v === 1 &&
    v.alg === 'A256GCM' && RE.key.test(v.kid) &&
    b64(v.iv,12,16) && b64(v.ct,48,64);
}
function encryptedRecord(v) {
  return exact(v,['v','alg','kid','revision','iv','ct']) &&
    v.v === 1 && v.alg === 'A256GCM' &&
    RE.key.test(v.kid) && RE.revision.test(v.revision) &&
    b64(v.iv,12,16) && b64(v.ct,undefined,180000) &&
    Buffer.from(v.ct,'base64url').length >= 16 &&
    Buffer.from(v.ct,'base64url').length <= 131088;
}
function validRouting(collection, routing, ownerId) {
  if (!routing || typeof routing !== 'object' || Array.isArray(routing) ||
      !COLLECTIONS[collection] || Object.keys(routing).length > 32 ||
      routing.userId !== ownerId || typeof routing.isDeleted !== 'boolean') return false;
  const allowed = COLLECTIONS[collection][1];
  // The owner's isolated ciphertext table is not a sharing transport.
  // Refuse missing or inherited task visibility, not just "public" and
  // "followers", even when a synthetic client skips its own preflight.
  if (['tasks','categories','diary'].includes(collection) &&
      routing.visibility !== 'private') return false;
  for(const [key, value] of Object.entries(routing)) {
    if(!allowed.includes(key) || !/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(key)) return false;
    if (typeof value === 'string') {
      if (Buffer.byteLength(value,'utf8') > 512) return false;
    } else if (!(typeof value === 'boolean' || value === null ||
                 (typeof value === 'number' && Number.isSafeInteger(value)))) return false;
  }
  return Buffer.byteLength(JSON.stringify(routing),'utf8') <= 4096;
}
function validOwnerRecord(record, callerId) {
  if (!exact(record,['projectId','ownerId','rowId','collection','domain','routing','published','envelope']) ||
      record.projectId !== PROJECT || record.ownerId !== callerId ||
      !RE.row.test(record.rowId) || !COLLECTIONS[record.collection] ||
      record.domain !== COLLECTIONS[record.collection][0] ||
      !exact(record.published,[]) ||
      !validRouting(record.collection,record.routing,callerId) ||
      !encryptedRecord(record.envelope)) return false;
  return true;
}
function rootId(callerId) {
  return 'kr_' + crypto.createHash('sha256')
    .update('mosaic-e2ee-owner-v2|' + callerId)
    .digest('hex').slice(0,32);
}
async function owned(db, tableId, rowId, callerId) {
  let row;
  try { row = await db.getRow({ databaseId:DATABASE, tableId, rowId }); }
  catch(e) {
    if (Number(e?.code) === 404) return resp(404,{error:'Not found'});
    throw e;
  }
  if (row?.user_id !== callerId) return resp(403,{error:'Forbidden'});
  return row;
}
function rootFromRow(row) {
  let envelope;
  try { envelope = JSON.parse(row.envelope || '{}'); } catch { return null; }
  if (!wrappedRoot(envelope) || !Number.isSafeInteger(row.generation) ||
      row.generation < 1 || row.key_id !== envelope.kid) return null;
  return {generation:row.generation,envelope};
}
async function createRoot(db,ownerId,payload) {
  if (!wrappedRoot(payload.envelope)) return resp(400,{error:'Invalid root envelope'});
  const envelope=JSON.stringify(payload.envelope), now=new Date().toISOString();
  try {
    await db.createRow({
      databaseId:DATABASE,tableId:ROOT_TABLE,rowId:rootId(ownerId),
      data:{user_id:ownerId,key_id:payload.envelope.kid,envelope,
        generation:1,created_at:now,updated_at:now},
      permissions:[Permission.read(Role.user(ownerId))],
    });
    return resp(200,{ok:true,status:'created'});
  } catch(e) {
    if(Number(e?.code)!==409)throw e;
    const existing=await owned(db,ROOT_TABLE,rootId(ownerId),ownerId);
    if(existing?.status)return existing;
    if(existing.generation===1 && existing.envelope===envelope &&
       existing.key_id===payload.envelope.kid)return resp(200,{ok:true,status:'duplicate'});
    return resp(409,{error:'Owner key already exists; recover it instead'});
  }
}
async function readRoot(db,ownerId) {
  const row=await owned(db,ROOT_TABLE,rootId(ownerId),ownerId);
  if(row?.status)return row;
  const current=rootFromRow(row);
  return current ? resp(200,{ok:true,...current})
    : resp(409,{error:'Invalid persisted encryption root'});
}
async function replaceRoot(db,ownerId,payload) {
  const { expectedGeneration, expectedEnvelope, envelope }=payload;
  if (!Number.isSafeInteger(expectedGeneration) || expectedGeneration < 1 ||
      expectedGeneration >= 2147483647 || !wrappedRoot(expectedEnvelope) ||
      !wrappedRoot(envelope) || expectedEnvelope.kid !== envelope.kid) {
    return resp(400,{error:'Invalid recovery replacement'});
  }
  const row=await owned(db,ROOT_TABLE,rootId(ownerId),ownerId);
  if(row?.status)return row;
  const before=JSON.stringify(expectedEnvelope), after=JSON.stringify(envelope);
  if(row.generation===expectedGeneration+1 && row.envelope===after) {
    return resp(200,{ok:true,status:'duplicate'});
  }
  if(row.generation!==expectedGeneration || row.envelope!==before ||
     row.key_id!==expectedEnvelope.kid)return resp(409,{error:'Root changed'});
  const updated=await db.updateRows({
    databaseId:DATABASE,tableId:ROOT_TABLE,
    queries:[Query.equal('$id',rootId(ownerId)),Query.equal('user_id',ownerId),
      Query.equal('generation',expectedGeneration),Query.equal('key_id',expectedEnvelope.kid)],
    data:{envelope:after,generation:expectedGeneration+1,updated_at:new Date().toISOString()},
  });
  const n=typeof updated?.total==='number'?updated.total:updated?.rows?.length??0;
  if(n===1)return resp(200,{ok:true,status:'updated'});
  if(n>1)throw new Error('Root generation CAS affected multiple rows');
  return resp(409,{error:'Concurrent root replacement'});
}
async function requireRoot(db,ownerId,keyId) {
  const row=await owned(db,ROOT_TABLE,rootId(ownerId),ownerId);
  if(row?.status)return false;
  const current=rootFromRow(row);
  return Boolean(current && current.envelope.kid===keyId);
}
function publicRow(row, ownerId) {
  let envelope,routing;
  try { envelope=JSON.parse(row.envelope||'{}'); routing=JSON.parse(row.routing_json||'{}'); }
  catch { return null; }
  const collection=row.collection;
  if(row.user_id!==ownerId || !COLLECTIONS[collection] ||
     !encryptedRecord(envelope) || !validRouting(collection,routing,ownerId) ||
     row.revision!==envelope.revision || row.key_id!==envelope.kid ||
     !RE.row.test(row.$id))return null;
  return {
    projectId:PROJECT, ownerId,rowId:row.$id,collection,
    domain:COLLECTIONS[collection][0],routing,published:{},envelope,
    deleted:row.deleted===true,updatedAt:row.updated_at,
  };
}
async function put(db,ownerId,payload) {
  const {record,opId,expectedRevision}=payload;
  if(!validOwnerRecord(record,ownerId) || !RE.operation.test(opId||'') ||
     (expectedRevision!=null && !RE.revision.test(expectedRevision)) ||
     (expectedRevision===undefined && Object.prototype.hasOwnProperty.call(payload,'expectedRevision'))) {
    return resp(400,{error:'Invalid encrypted owner operation'});
  }
  const validRoot=await requireRoot(db,ownerId,record.envelope.kid);
  if(!validRoot)return resp(409,{error:'Owner encryption root is not ready'});
  const envelope=JSON.stringify(record.envelope),
        routing=JSON.stringify(record.routing),now=new Date().toISOString();
  const rowId=record.rowId;
  const data={
    user_id:ownerId,collection:record.collection,key_id:record.envelope.kid,
    revision:record.envelope.revision,envelope,routing_json:routing,op_id:opId,
    deleted:record.routing.isDeleted,updated_at:now,
  };
  if(expectedRevision==null) {
    try {
      await db.createRow({
        databaseId:DATABASE,tableId:DOC_TABLE,rowId,
        data:{...data,created_at:now},
        permissions:[Permission.read(Role.user(ownerId))],
      });
      return resp(200,{ok:true,status:'created',revision:record.envelope.revision});
    }catch(e){if(Number(e?.code)!==409)throw e;}
  }
  const existing=await owned(db,DOC_TABLE,rowId,ownerId);
  if(existing?.status)return existing;
  if(existing.op_id===opId && existing.envelope===envelope &&
     existing.routing_json===routing && existing.collection===record.collection) {
    return resp(200,{ok:true,status:'duplicate',revision:existing.revision});
  }
  if(expectedRevision==null || existing.revision!==expectedRevision ||
     existing.key_id!==record.envelope.kid || existing.collection!==record.collection ||
     record.envelope.revision===expectedRevision) {
    return resp(409,{ok:false,status:'conflict',row:publicRow(existing,ownerId)});
  }
  const updated=await db.updateRows({
    databaseId:DATABASE,tableId:DOC_TABLE,
    queries:[Query.equal('$id',rowId),Query.equal('user_id',ownerId),
      Query.equal('collection',record.collection),Query.equal('revision',expectedRevision)],
    data,
  });
  const n=typeof updated?.total==='number'?updated.total:updated?.rows?.length??0;
  if(n===1)return resp(200,{ok:true,status:'updated',revision:record.envelope.revision});
  if(n>1)throw new Error('Encrypted owner CAS affected multiple records');
  return resp(409,{error:'Concurrent encrypted owner update'});
}
async function get(db,ownerId,payload) {
  if(!RE.row.test(payload.rowId||'') || !COLLECTIONS[payload.collection])
    return resp(400,{error:'Invalid encrypted record selector'});
  const row=await owned(db,DOC_TABLE,payload.rowId,ownerId);
  if(row?.status)return row;
  if(row.collection!==payload.collection)return resp(404,{error:'Not found'});
  const sanitized=publicRow(row,ownerId);
  return sanitized?resp(200,{ok:true,row:sanitized}):resp(409,{error:'Damaged encrypted record'});
}
async function list(db,ownerId,payload) {
  if(!COLLECTIONS[payload.collection] ||
     (payload.after!==undefined && !RE.row.test(payload.after))) {
    return resp(400,{error:'Invalid encrypted record cursor'});
  }
  const queries=[Query.equal('user_id',ownerId),
    Query.equal('collection',payload.collection),Query.orderAsc('$id'),Query.limit(20)];
  if(payload.after)queries.push(Query.cursorAfter(payload.after));
  const page=await db.listRows({databaseId:DATABASE,tableId:DOC_TABLE,queries,total:false});
  const rows=(page.rows||[]).filter(x=>x.user_id===ownerId &&
    x.collection===payload.collection).slice(0,20);
  const sanitized=rows.map(x=>publicRow(x,ownerId));
  if(sanitized.some(x=>!x))return resp(409,{error:'Damaged encrypted record'});
  return resp(200,{ok:true,rows:sanitized,after:rows.length===20?rows[19].$id:null});
}

async function handleE2eeOwnerRecords(db,callerId,payload,sessionJwt) {
  if(process.env.APPWRITE_FUNCTION_PROJECT_ID!==PROJECT ||
     process.env.MOSAIC_E2EE_OWNER_ENABLED!=='true')return resp(404,{error:'Unavailable'});
  if(typeof callerId!=='string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/.test(callerId))
    return resp(401,{error:'Unauthorized'});
  const allowed=(process.env.MOSAIC_E2EE_OWNER_ALLOWED_OWNER_IDS||'')
    .split(',').map(x=>x.trim()).filter(Boolean);
  if(!allowed.includes(callerId))return resp(403,{error:'Denied'});
  if(payload?.ownerId!==undefined && payload.ownerId!==callerId ||
     payload?.projectId!==undefined && payload.projectId!==PROJECT)
    return resp(403,{error:'Forbidden'});
  if(!(await pilotSessionIsAuthenticated(callerId,sessionJwt)))
    return resp(401,{error:'Completed MFA session required'});
  switch(payload?.operation) {
    case 'create_root':return createRoot(db,callerId,payload);
    case 'read_root':return readRoot(db,callerId);
    case 'replace_root':return replaceRoot(db,callerId,payload);
    case 'put':return put(db,callerId,payload);
    case 'get':return get(db,callerId,payload);
    case 'list':return list(db,callerId,payload);
    default:return resp(400,{error:'Unknown encrypted owner operation'});
  }
}
module.exports={handleE2eeOwnerRecords};
