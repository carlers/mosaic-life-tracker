'use strict';

// Scratch-only synthetic acceptance. This cannot delete real or legacy media.
const { randomBytes, createHash, timingSafeEqual } = require('node:crypto');
const { Query } = require('node-appwrite');
const { soleOwnerControl } = require('./owner-media-audit');

const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || 'life_tracker';
const BUCKET_ID = process.env.APPWRITE_STORAGE_BUCKET_ID || 'task_images';
const TABLE_ID = 'media_uploads';
const MAX_PAGES = 10, PAGE_SIZE = 100, GRACE_MS = 12_000;
const FILE_ID = /^img_[0-9a-f]{32}$/;
const refs = Object.freeze({
  tasks: ['image'],
  diary: ['photos'],
  settings: ['value'],
  profiles: ['avatar_file_id'],
  messages: ['attachment_file_id'],
});
const result = (status, body) => ({status,body});
const hash = (s) => createHash('sha256').update(s).digest('hex');

function eligible(callerId) {
  return typeof callerId === 'string' &&
    process.env.APPWRITE_FUNCTION_PROJECT_ID === '6a96e82d000d1310b3be' &&
    process.env.MOSAIC_1478_TEST_DELETE_OWNER_ID === callerId &&
    /^m1478_[a-z0-9_]{4,26}$/.test(callerId);
}
function confirmToken(expected, provided) {
  if (typeof expected !== 'string' || !/^[0-9a-f]{64}$/.test(expected) ||
      typeof provided !== 'string' || !/^[0-9a-f]{64}$/.test(provided)) return false;
  return timingSafeEqual(Buffer.from(expected,'hex'),Buffer.from(hash(provided),'hex'));
}
function mayRefer(value, fileId) {
  if (typeof value === 'string') return value.includes(fileId);
  if (Array.isArray(value)) return value.some(v=>mayRefer(v,fileId));
  if (value && typeof value === 'object')
    return Object.values(value).some(v=>mayRefer(v,fileId));
  return false;
}

// Fail closed on any paginated reference set that cannot be proven complete.
// Rows include tombstones and references belonging to other owners.
async function noReferences(db,fileId) {
  for (const [tableId,columns] of Object.entries(refs)) {
    let after,complete=false;
    const seen=new Set();
    for(let page=0;page<MAX_PAGES;page++){
      const response=await db.listRows({
        databaseId:DATABASE_ID,tableId,
        queries:[Query.orderAsc('$id'),Query.limit(PAGE_SIZE),
          ...(after?[Query.cursorAfter(after)]:[])],
        total:false,
      });
      if(!Array.isArray(response?.rows)||response.rows.length>PAGE_SIZE)
        throw Error('Media reference scan unavailable');
      for(const row of response.rows){
        if(typeof row?.$id!=='string'||!row.$id||seen.has(row.$id))
          throw Error('Media reference pagination identity invalid');
        seen.add(row.$id);
        const data=row.data && typeof row.data==='object'?row.data:row;
        if(columns.some(col=>mayRefer(data[col],fileId)))return false;
      }
      if(response.rows.length<PAGE_SIZE){complete=true;break;}
      after=response.rows.at(-1)?.$id;
    }
    if(!complete)throw Error('Media reference scan incomplete');
  }
  return true;
}
async function ledger(db,callerId,fileId){
  let row;
  try{row=await db.getRow({databaseId:DATABASE_ID,tableId:TABLE_ID,rowId:fileId});}
  catch(e){if(Number(e?.code)===404)return {error:result(404,{error:'Upload unavailable'})};throw e;}
  if(row?.owner_id!==callerId||row?.file_id!==fileId||row?.purpose!=='synthetic')
    return {error:result(403,{error:'Forbidden'})};
  return {row};
}
async function metadata(storage,row,callerId){
  let file;
  try{file=await storage.getFile({bucketId:BUCKET_ID,fileId:row.file_id});}
  catch(e){if(Number(e?.code)===404)return null;throw e;}
  if(file?.$id!==row.file_id||!soleOwnerControl(file.$permissions,callerId)||
     file.$createdAt!==row.file_created_at||
     file.sizeOriginal!==row.size_bytes||
     !Number.isSafeInteger(file.sizeOriginal)||
     typeof file.mimeType!=='string'||!file.mimeType.startsWith('image/'))
    throw Error('Upload fingerprint differs');
  return file;
}
async function change(db,fileId,callerId,from,data){
  const r=await db.updateRows({
    databaseId:DATABASE_ID,tableId:TABLE_ID,
    queries:[Query.equal('$id',fileId),Query.equal('owner_id',callerId),
      Query.equal('purpose','synthetic'),Query.equal('status',from)],
    data,
  });
  return r?.total===1;
}
async function requestSyntheticCleanup({db,storage,callerId,fileId,now=Date.now()}){
  if(!eligible(callerId))return result(403,{error:'Unavailable'});
  if(typeof fileId!=='string'||!FILE_ID.test(fileId))
    return result(400,{error:'Invalid file ID'});
  const {row,error}=await ledger(db,callerId,fileId);
  if(error)return error;
  if(row.status!=='verified'||!row.verified_at||!row.file_created_at)
    return result(409,{error:'Upload is not verified'});
  if(!await metadata(storage,row,callerId)||!await noReferences(db,fileId))
    return result(409,{error:'Media unavailable or referenced'});
  const token=randomBytes(32).toString('hex');
  const requestedAt=new Date(now).toISOString();
  const accepted=await change(db,fileId,callerId,'verified',{
    status:'pending_delete',
    delete_requested_at:requestedAt,
    delete_token_hash:hash(token),
  });
  if(!accepted)return result(409,{error:'Reservation state changed'});
  return result(200,{
    fileId,token,notBefore:new Date(now+GRACE_MS).toISOString(),
    scope:'synthetic-only',
  });
}
async function confirmSyntheticCleanup({db,storage,callerId,fileId,token,now=Date.now()}){
  if(!eligible(callerId))return result(403,{error:'Unavailable'});
  if(typeof fileId!=='string'||!FILE_ID.test(fileId))
    return result(400,{error:'Invalid file ID'});
  const {row,error}=await ledger(db,callerId,fileId);
  if(error)return error;
  if(row.status==='deleted')
    return result(200,{fileId,status:'deleted',scope:'synthetic-only'});
  if(!['pending_delete','deleting'].includes(row.status)||
     !confirmToken(row.delete_token_hash,token))
    return result(409,{error:'Missing or invalid confirmation'});
  const requestedAt=Date.parse(row.delete_requested_at||'');
  if(!Number.isFinite(requestedAt)||requestedAt>now||
     now-requestedAt<GRACE_MS)
    return result(409,{error:'Grace period pending'});
  if(!await noReferences(db,fileId))
    return result(409,{error:'Media still referenced'});
  const file=await metadata(storage,row,callerId);
  if(!file && row.status==='pending_delete')
    return result(409,{error:'File missing before server operation'});
  if(row.status==='pending_delete'&&
     !await change(db,fileId,callerId,'pending_delete',{status:'deleting'}))
    return result(409,{error:'Concurrent cleanup changed state'});
  if(file){
    try{await storage.deleteFile({bucketId:BUCKET_ID,fileId});}
    catch(e){if(Number(e?.code)!==404)throw e;}
  }
  const finalized=await change(db,fileId,callerId,'deleting',{
    status:'deleted',
    deleted_at:new Date(now).toISOString(),
    delete_receipt:hash(fileId+'|'+row.delete_requested_at),
  });
  if(!finalized)return result(409,{error:'Receipt pending retry'});
  return result(200,{fileId,status:'deleted',scope:'synthetic-only'});
}
module.exports={eligible,noReferences,requestSyntheticCleanup,confirmSyntheticCleanup,GRACE_MS};
