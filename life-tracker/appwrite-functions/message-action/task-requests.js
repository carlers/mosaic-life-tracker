'use strict';

// Canonical, server-owned task requests. Never project a recipient task row to its sender.
const { createHash } = require('node:crypto');
const { Query, Permission, Role } = require('node-appwrite');
const { read } = require('./friendship');
const { mutualFriends } = require('./task-shares');
const { makeSettingsRowId } = require('./alert-retention');

const DB = process.env.APPWRITE_DATABASE_ID || 'life_tracker';
const REQUESTS = 'task_requests';
const MESSAGES = 'messages';
const TASKS = 'tasks';
const CATEGORIES = 'categories';
const CONSENT_KEY = 'allowTaskRequestsFromFriends';
const validId = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_]{0,35}$/.test(value);
const hash = value => createHash('sha256').update(value).digest('hex');
const answer = (status, error) => ({ status, body: { error } });
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value + 'T00:00:00Z')) &&
  new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;
const validSuggestedDate = value => value === '' || validDate(value);
const requestIdFor = (senderId, commandId) => 'treq_' + hash(senderId + '|' + commandId).slice(0, 30);
const acceptedTaskIdFor = requestId => 'rtask_' + hash(requestId).slice(0, 30);
const eventMessageIdFor = (requestId, kind) => 'msg_' + hash('task-request|' + requestId + '|' + kind).slice(0, 30);
const peerMessageIdFor = messageId => 'rmsg_' + hash(messageId).slice(0, 30);
const threadIdFor = (left, right) => {
  const [a,b] = [left,right].sort();
  return 'th_' + hash(a + '|' + b).slice(0, 30);
};
const incoming = row => row && row.deleted !== true;

function project(row, caller, friendshipVersion) {
  const sender = caller === row.sender_id;
  const recipient = caller === row.recipient_id;
  if (!sender && !recipient) return null;
  return {
    id: row.$id, senderId: row.sender_id, recipientId: row.recipient_id,
    title: row.title, note: row.note || '', suggestedDate: row.suggested_date || '',
    status: row.status === 'pending' && friendshipVersion !== row.friendship_version
      ? 'unavailable' : row.status,
    createdAt: row.created_at, updatedAt: row.updated_at,
    revision: row.$updatedAt || row.updated_at,
  };
}

async function readConsent(db, recipientId, txId) {
  const row = await read(db, 'settings', makeSettingsRowId(recipientId, CONSENT_KEY), txId);
  if (!row) return true; // Existing users remain enabled until they explicitly opt out.
  if (row.user_id !== recipientId || row.key !== CONSENT_KEY || row.deleted) return false;
  return row.value === 'true' || row.value === '"true"';
}

async function writeChatEvent(db, txId, request, kind, actorId, now) {
  const peerId = actorId === request.sender_id ? request.recipient_id : request.sender_id;
  const msgId = eventMessageIdFor(request.$id, kind);
  const threadId = threadIdFor(request.sender_id, request.recipient_id);
  const content = kind === 'created' ? 'Task request sent'
    : kind === 'accepted' ? 'Task request accepted'
    : kind === 'declined' ? 'Task request declined' : 'Task request withdrawn';
  const standard = {
    thread_id: threadId, sender_id: actorId, recipient_id: peerId, content,
    task_request_id: request.$id, task_request_event: kind,
    attachment_type: '', attachment_file_id: '', task_ref_id: '', task_ref_title: '',
    task_ref_date: '', task_ref_color: '', diary_ref_id: '', diary_ref_owner_id: '',
    diary_ref_date: '', diary_ref_excerpt: '', diary_ref_epoch: 0, reply_to_id: '',
    reply_to_content: '', reply_to_sender_id: '', is_unsent: false,
    original_message_id: msgId, reactions: '', read_at: '',
    delivery_status: 'delivered', created_at: now, updated_at: now, deleted: false,
  };
  // No update or delete ACL: old PWAs cannot mutate canonical system events.
  for (const [userId, rowId, direction] of [[actorId,msgId,'outgoing'],[peerId,peerMessageIdFor(msgId),'incoming']]) {
    await db.createRow({
      databaseId: DB, tableId: MESSAGES, rowId, transactionId: txId,
      permissions: [Permission.read(Role.user(userId))],
      data: { ...standard, user_id: userId, direction },
    });
  }
}

async function listRequests(db, caller, scope, cursor) {
  if (!['received','sent'].includes(scope) || (cursor && !validId(cursor)))
    return answer(400, 'Invalid request list');
  const field = scope === 'sent' ? 'sender_id' : 'recipient_id';
  const queries = [Query.equal(field, caller), Query.orderDesc('$id'), Query.limit(25)];
  if (cursor) queries.push(Query.cursorAfter(cursor));
  const page = await db.listRows({
    databaseId: DB, tableId: REQUESTS, queries, total: false,
  });
  const rows = page.rows || [];
  const friends = new Map();
  const items = [];
  for (let i = 0; i < rows.length; i += 5) {
    const chunk = await Promise.all(rows.slice(i,i+5).map(async row => {
      if (row[field] !== caller) return null;
      const pair = row.sender_id + ':' + row.recipient_id;
      if (!friends.has(pair)) friends.set(pair, mutualFriends(db,row.sender_id,row.recipient_id));
      return project(row, caller, await friends.get(pair));
    }));
    for (const item of chunk) if (item) items.push(item);
  }
  return { status: 200, body: { ok:true, items, nextCursor: rows.length === 25 ? rows.at(-1).$id : '' } };
}

async function handleTaskRequests(db, caller, payload) {
  const operation = payload?.operation;
  if (!validId(caller)) return answer(401, 'Unauthorized');
  if (operation === 'list') return listRequests(db, caller, payload.scope, payload.cursor);
  if (operation === 'get') {
    if (!validId(payload?.requestId)) return answer(400, 'Invalid request');
    const row = await read(db, REQUESTS, payload.requestId);
    if (!row) return answer(404, 'Request unavailable');
    const item = project(row, caller, await mutualFriends(db, row.sender_id, row.recipient_id));
    return item ? { status:200, body:{ok:true,item} } : answer(404, 'Request unavailable');
  }
  if (!['send','accept','decline','withdraw'].includes(operation)) return answer(400,'Unknown request operation');
  if (process.env.MOSAIC_TASK_REQUESTS_DISABLED === 'true') return answer(503,'Task requests paused');
  if (!validId(payload?.operationId)) return answer(400,'Invalid operation identity');

  const sending = operation === 'send';
  const requestId = sending ? requestIdFor(caller,payload.operationId) : payload?.requestId;
  if (!validId(requestId)) return answer(400,'Invalid request identity');
  if (sending && (!validId(payload?.recipientId) || caller === payload.recipientId ||
      typeof payload.title !== 'string' || !payload.title.trim() ||
      payload.title.trim() !== payload.title || payload.title.length > 255 ||
      (payload.note !== undefined && (typeof payload.note !== 'string' || payload.note.length > 1000)) ||
      !validSuggestedDate(payload.suggestedDate ?? ''))) {
    return answer(400,'Invalid task request');
  }
  if (sending && !payload.title.trim()) return answer(400,'Title required');

  const tx = await db.createTransaction({ttl:60});
  let committed = false;
  try {
    const row = await read(db, REQUESTS, requestId, tx.$id);
    if (sending) {
      if (row) {
        if (row.sender_id !== caller || row.recipient_id !== payload.recipientId ||
            row.title !== payload.title || (row.note || '') !== (payload.note || '') ||
            (row.suggested_date || '') !== (payload.suggestedDate || '') ||
            row.send_operation_id !== payload.operationId) return answer(409,'Request identity already used');
        return { status:200, body:{ok:true,duplicate:true,item:project(row,caller,row.friendship_version)} };
      }
      const recipient = payload.recipientId;
      const friendshipVersion = await mutualFriends(db,caller,recipient,tx.$id);
      if (!friendshipVersion) return answer(403,'Accepted friendship required');
      if (!await readConsent(db,recipient,tx.$id)) return answer(403,'Recipient is not accepting requests');
      // Bounded per-peer spam control. No unbounded global table scan.
      const recent = await db.listRows({databaseId:DB,tableId:REQUESTS,total:false,
        queries:[Query.equal('sender_id',caller),Query.equal('recipient_id',recipient),
          Query.orderDesc('created_at'),Query.limit(50)]});
      const oneDayAgo = Date.now() - 86400000;
      const todayCount = (recent.rows||[]).filter(x => Date.parse(x.created_at) >= oneDayAgo).length;
      const pendingCount = (recent.rows||[]).filter(x => x.status === 'pending' && x.friendship_version === friendshipVersion).length;
      if (todayCount >= 10 || pendingCount >= 25) return answer(429,'Too many task requests');
      const now = new Date().toISOString();
      const created = {
        $id:requestId, sender_id:caller, recipient_id:recipient, title:payload.title,
        note:payload.note || '', suggested_date:payload.suggestedDate || '',
        status:'pending', friendship_version:friendshipVersion,
        accepted_task_id:'', send_operation_id:payload.operationId,
        last_operation_id:payload.operationId, created_at:now, updated_at:now,
      };
      await db.createRow({databaseId:DB,tableId:REQUESTS,rowId:requestId,
        transactionId:tx.$id,permissions:[], data:Object.fromEntries(Object.entries(created).filter(([key])=>key!=='$id'))});
      await writeChatEvent(db,tx.$id,created,'created',caller,now);
      await db.updateTransaction({transactionId:tx.$id,commit:true});
      committed = true;
      const saved = await read(db,REQUESTS,requestId);
      return {status:200,body:{ok:true,item:project(saved || created,caller,friendshipVersion)}};
    }
    if (!row || ![row.sender_id,row.recipient_id].includes(caller)) return answer(404,'Request unavailable');
    if (row.status === operation.replace('accept','accepted').replace('decline','declined').replace('withdraw','withdrawn') &&
        row.last_operation_id === payload.operationId) {
      return {status:200,body:{ok:true,duplicate:true,item:project(row,caller,row.friendship_version)}};
    }
    if (row.status !== 'pending') return answer(409,'Task request changed; refresh');
    if (operation === 'withdraw' ? caller !== row.sender_id : caller !== row.recipient_id)
      return answer(403,'Not permitted to change request');
    if (typeof payload.expectedRevision !== 'string' || !payload.expectedRevision ||
        (row.$updatedAt || row.updated_at) !== payload.expectedRevision)
      return answer(409,'Task request changed; refresh');
    const friendshipVersion = await mutualFriends(db,row.sender_id,row.recipient_id,tx.$id);
    if (!friendshipVersion || friendshipVersion !== row.friendship_version)
      return answer(403,'Friendship changed; request unavailable');
    const nextStatus = {accept:'accepted',decline:'declined',withdraw:'withdrawn'}[operation];
    const now = new Date().toISOString();
    const patch = {status:nextStatus,last_operation_id:payload.operationId,updated_at:now};
    if (operation === 'accept') {
      if (!validId(payload.categoryId) || !validSuggestedDate(payload.date) ||
          !validDate(payload.ownerLocalDate)) return answer(400,'Invalid task placement');
      const category = await read(db,CATEGORIES,payload.categoryId,tx.$id);
      if (!category || category.user_id !== caller || category.deleted ||
          category.lifecycle_state || category.retired_on ||
          (category.started_on && (payload.date || payload.ownerLocalDate) < category.started_on))
        return answer(409,'Recipient category unavailable');
      // Treat owner-local date as a bounded timezone hint, not a caller-owned permission.
      const todayUTC = new Date().toISOString().slice(0,10);
      if (Math.abs(Date.parse(payload.ownerLocalDate+'T00:00:00Z')-Date.parse(todayUTC+'T00:00:00Z'))>86400000)
        return answer(400,'Invalid local date');
      const taskId = acceptedTaskIdFor(requestId);
      const task = {
        user_id:caller,title:row.title,is_completed:false,category_id:payload.categoryId,
        order:0,tags:'',date:payload.date,memo:'',image:'',created_at:now,
        completed_at:'',updated_at:now,source:'task_request',deleted:false,
        visibility:'private',routine_id:'',reminder_time:'',reactions:'',
      };
      await db.createRow({databaseId:DB,tableId:TASKS,rowId:taskId,transactionId:tx.$id,
        permissions:[Permission.read(Role.user(caller))],data:task});
      patch.accepted_task_id = taskId;
    }
    await db.updateRow({databaseId:DB,tableId:REQUESTS,rowId:requestId,
      transactionId:tx.$id,data:patch});
    await writeChatEvent(db,tx.$id,row,nextStatus,caller,now);
    await db.updateTransaction({transactionId:tx.$id,commit:true});
    committed=true;
    const updated = await read(db,REQUESTS,requestId);
    return {status:200,body:{ok:true,item:project(updated || {...row,...patch},caller,friendshipVersion)}};
  } catch (error) {
    if (Number(error?.code) === 409) return answer(409,'Task request changed; refresh');
    throw error;
  } finally {
    if (!committed) await db.updateTransaction({transactionId:tx.$id,rollback:true}).catch(()=>{});
  }
}
module.exports = { handleTaskRequests, requestIdFor, acceptedTaskIdFor, eventMessageIdFor, project, validDate, readConsent, writeChatEvent };
