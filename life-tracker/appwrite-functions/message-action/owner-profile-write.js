'use strict';

const { Permission, Role } = require('node-appwrite');
const { guardOwnerMediaReferences } = require('./owner-media-reference-guard');
const { stageReferenceTransaction, enabled: fenceEnabled } = require('./media-reference-transaction');
const DB = process.env.APPWRITE_DATABASE_ID || 'life_tracker';
const KEYS = new Set(['user_id','username','display_name','avatar_file_id','bio',
  'is_searchable','created_at','updated_at','deleted']);
const text = (x,limit) => typeof x === 'string' && x.length <= limit;
function valid(data, callerId) {
  if (!data || typeof data !== 'object' || Array.isArray(data) ||
      Object.keys(data).length === 0 ||
      Object.keys(data).some(k => !KEYS.has(k)) ||
      (data.user_id !== undefined && data.user_id !== callerId) ||
      (data.deleted !== undefined && data.deleted !== false)) return false;
  if (data.username !== undefined && (!text(data.username,50) || !data.username ||
      data.username !== data.username.toLowerCase())) return false;
  return [
    ['display_name',100],['avatar_file_id',255],['bio',300],
    ['created_at',50],['updated_at',50],
  ].every(([k,max]) => data[k] === undefined || text(data[k],max)) &&
    (data.is_searchable === undefined || typeof data.is_searchable === 'boolean');
}
async function handleOwnerProfileWrite(db, callerId, payload) {
  if (!callerId) return {status:401,body:{error:'Unauthorized'}};
  const rowId = 'profile_' + callerId, data = payload?.data;
  if (payload?.rowId !== rowId || rowId.length > 36 ||
      !valid(data,callerId))
    return {status:400,body:{error:'Invalid profile write'}};

  let existing;
  try { existing = await db.getRow({databaseId:DB,tableId:'profiles',rowId}); }
  catch(e) { if(Number(e?.code)!==404) throw e; }
  if (existing && existing.user_id !== callerId)
    return {status:403,body:{error:'Owner mismatch'}};
  if (!existing && (data.user_id !== callerId || !data.username ||
      !data.updated_at))
    return {status:400,body:{error:'Incomplete profile create'}};

  const mediaDenial = await guardOwnerMediaReferences(db,callerId,'profiles',data);
  if(mediaDenial) return mediaDenial;
  const write = transactionId => existing
    ? db.updateRow({databaseId:DB,tableId:'profiles',rowId,data,
      ...(transactionId ? {transactionId}: {})})
    : db.createRow({databaseId:DB,tableId:'profiles',rowId,data,
      permissions:[Permission.read(Role.users())],
      ...(transactionId ? {transactionId}: {})});

  try {
    if (fenceEnabled()) {
      const r=await stageReferenceTransaction(db,{
        callerId,tableId:'profiles',data,previousData:existing,stageTarget:write});
      if(r.denied) return r.denied;
      if(!r.guarded) await write();
    } else await write();
  } catch(error) {
    if (Number(error?.code)===409)
      return {status:409,body:{error:'Profile write conflict'}};
    throw error;
  }
  const row=await db.getRow({databaseId:DB,tableId:'profiles',rowId});
  if(row?.user_id!==callerId) throw Error('Profile owner drift');
  return {status:200,body:{ok:true,row}};
}
module.exports={handleOwnerProfileWrite};
