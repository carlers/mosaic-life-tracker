'use strict';
const {Query} = require('node-appwrite');
const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || 'life_tracker';
const ID = /^[A-Za-z0-9][A-Za-z0-9_]{0,35}$/;
const LIMIT = 12;
const error = (status, message) => ({status,body:{error:message}});
const allowed = () => process.env.CATEGORY_DESTRUCTIVE_ENABLED === 'true';
const checkCount = result => {
  if (!Number.isSafeInteger(result?.total) || result.total > 1) {
    throw new Error('Category recovery CAS count invalid');
  }
  return result.total === 1;
};
const recoveryQueries = (owner, categoryId, limit = LIMIT) => [
  Query.equal('user_id', owner),
  Query.equal('category_id', categoryId),
  Query.equal('deleted', true),
  Query.equal('category_delete_marker', categoryId),
  Query.orderAsc('$id'),
  Query.limit(limit),
];

async function listRecoverableCategories(db, callerId, payload) {
  if (!allowed()) return error(503, 'Category recovery unavailable');
  const cursor = payload?.cursor;
  if (cursor !== undefined && !ID.test(cursor)) return error(400, 'Invalid recovery cursor');
  const queries = [
    Query.equal('user_id', callerId),
    Query.equal('deleted', true),
    Query.equal('lifecycle_target', 'recoverable'),
    Query.limit(40), Query.orderDesc('$updatedAt'),
    ...(cursor ? [Query.cursorAfter(cursor)] : []),
  ];
  const page = await db.listRows({databaseId:DATABASE_ID,tableId:'categories',queries,ttl:0,total:false});
  if (!Array.isArray(page?.rows)) throw new Error('Recoverable categories unavailable');
  const rows = page.rows.filter(row => row.user_id === callerId && row.deleted === true &&
    row.lifecycle_target === 'recoverable' && ['delete','restore'].includes(row.lifecycle_state));
  return {status:200,body:{
    ok:true,
    categories: rows.map(row => ({id:row.$id,name:row.name,deletedAt:row.$updatedAt,
      status:row.lifecycle_state})),
    nextCursor:page.rows.length===40 ? page.rows.at(-1).$id : null,
  }};
}

async function recoverCategory(db, callerId, payload) {
  if (!allowed()) return error(503, 'Category recovery unavailable');
  const id = payload?.categoryId;
  if (!ID.test(id || '')) return error(400, 'Invalid category');
  let category;
  try {
    category = await db.getRow({databaseId:DATABASE_ID,tableId:'categories',rowId:id});
  } catch(e) {
    if(e?.code===404) return error(404,'Category not found');
    throw e;
  }
  if (!category || category.user_id !== callerId || category.deleted !== true ||
      category.lifecycle_target !== 'recoverable' ||
      !['delete','restore'].includes(category.lifecycle_state)) {
    return error(404,'Category not recoverable');
  }
  if (category.name !== payload?.confirmName) return error(400,'Confirm the category name');
  if (category.lifecycle_state === 'delete') {
    const locked = await db.updateRows({
      databaseId:DATABASE_ID,tableId:'categories',
      queries:[Query.equal('$id',id),Query.equal('user_id',callerId),
        Query.equal('$updatedAt',category.$updatedAt),Query.equal('deleted',true),
        Query.equal('lifecycle_state','delete'),Query.equal('lifecycle_target','recoverable'),Query.limit(1)],
      data:{lifecycle_state:'restore',updated_at:new Date().toISOString()},
    });
    if (!checkCount(locked)) return error(409,'Category changed; retry recovery');
  }
  const page=await db.listRows({
    databaseId:DATABASE_ID,tableId:'tasks',queries:recoveryQueries(callerId,id),ttl:0,total:false,
  });
  if (!Array.isArray(page?.rows)) throw new Error('Recovery page unavailable');
  let affected=0;
  for(const task of page.rows) {
    if (task.user_id!==callerId || task.category_id!==id || task.deleted!==true ||
        task.category_delete_marker!==id || typeof task.$updatedAt!=='string') {
      throw new Error('Unexpected task in recovery');
    }
    const updated=await db.updateRows({
      databaseId:DATABASE_ID,tableId:'tasks',
      queries:[Query.equal('$id',task.$id),Query.equal('user_id',callerId),
        Query.equal('category_id',id),Query.equal('deleted',true),
        Query.equal('category_delete_marker',id),Query.equal('$updatedAt',task.$updatedAt),
        Query.limit(1)],
      data:{deleted:false,category_delete_marker:'',updated_at:new Date().toISOString()},
    });
    if (!checkCount(updated)) return error(409,'Task changed; retry recovery');
    affected++;
  }
  const remainingPage=await db.listRows({
    databaseId:DATABASE_ID,tableId:'tasks',
    queries:recoveryQueries(callerId,id,1),ttl:0,total:true,
  });
  if (!Number.isSafeInteger(remainingPage?.total) || remainingPage.total < 0)
    throw new Error('Recovery count unavailable');
  const remaining=remainingPage.total;
  if (remaining > 0) return {status:200,body:{ok:true,status:'processing',remaining,affected}};
  // Category becomes visible only when all tagged tasks have been recovered.
  const finished=await db.updateRows({
    databaseId:DATABASE_ID,tableId:'categories',
    queries:[Query.equal('$id',id),Query.equal('user_id',callerId),
      Query.equal('deleted',true),Query.equal('lifecycle_state','restore'),
      Query.equal('lifecycle_target','recoverable'),Query.limit(1)],
    data:{deleted:false,lifecycle_state:'',lifecycle_target:'',updated_at:new Date().toISOString()},
  });
  if (!checkCount(finished)) return error(409,'Category changed; retry recovery');
  return {status:200,body:{ok:true,status:'done',remaining:0,affected}};
}
module.exports={listRecoverableCategories,recoverCategory};
