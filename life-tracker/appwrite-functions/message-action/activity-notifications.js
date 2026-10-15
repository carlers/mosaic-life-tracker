'use strict';
// Cross-domain activity receipts. Existing required task_id/completed_at columns
// carry the typed event's source row ID and occurrence time for old-schema
// compatibility; only task_completed rows are ever interpreted as tasks.
const { createHash } = require('node:crypto');
const { makeSettingsRowId } = require('./alert-retention');
const { Query } = require('node-appwrite');

const DB = process.env.APPWRITE_DATABASE_ID || 'life_tracker';
const TYPES = Object.freeze([
  'friend_request', 'friend_accepted', 'direct_message',
  'message_reaction', 'task_reaction', 'shared_task_invite',
]);
const DEFAULTS = Object.freeze({
  friend_request: { feed: true, push: true },
  friend_accepted: { feed: true, push: true },
  direct_message: { feed: true, push: true },
  message_reaction: { feed: true, push: false },
  task_reaction: { feed: true, push: false },
  shared_task_invite: { feed: true, push: true },
  task_completed: { feed: true, push: true },
});
const KEY = 'alertsChannels';
const SOCIAL_PUSH_DETAILS_KEY = 'alertsSocialPushDetails';
const validId = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_]{0,35}$/.test(value);
const sha = value => createHash('sha256').update(value).digest('hex');
// Excerpts are generated only after live authorization; never stored in receipts or Push.
function excerpt(value, max = 100) {
  if (typeof value !== 'string') return '';
  return Array.from(value.replace(/[\x00-\x1f\x7f]+/g, ' ').replace(/\s+/g, ' ').trim())
    .slice(0, max).join('');
}
function reactionEmoji(serialized, actorId) {
  try {
    const reactions = JSON.parse(serialized || '[]');
    if (!Array.isArray(reactions)) return '';
    const matches = reactions.filter(item =>
      typeof item?.emoji === 'string' && item.emoji.length <= 20 &&
      Array.isArray(item.userIds) && item.userIds.includes(actorId));
    // Multiple simultaneous emoji reactions do not identify which receipt this
    // was. Never attribute a guessed emoji to a notification.
    return matches.length === 1 ? matches[0].emoji : '';
  } catch { return ''; }
}
const receiptId = (recipient, type, actor, source, occurrence) =>
  'not_' + sha([recipient, type, actor, source, occurrence].join('|')).slice(0, 32);

async function row(db, tableId, rowId) {
  if (!validId(rowId)) return null;
  try { return await db.getRow({ databaseId: DB, tableId, rowId }); }
  catch (error) { if (Number(error?.code) === 404) return null; throw error; }
}

async function channels(db, userId) {
  const setting = await row(db, 'settings', makeSettingsRowId(userId, KEY));
  if (!setting || setting.deleted || setting.user_id !== userId || setting.key !== KEY) return DEFAULTS;
  try {
    const stored = JSON.parse(setting.value);
    if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return DEFAULTS;
    const resolved = {};
    for (const [type, def] of Object.entries(DEFAULTS)) {
      const next = stored[type];
      resolved[type] = {
        feed: typeof next?.feed === 'boolean' ? next.feed : def.feed,
        push: typeof next?.push === 'boolean' ? next.push : def.push,
      };
    }
    return resolved;
  } catch { return DEFAULTS; }
}
async function includeSocialPushDetails(db, userId) {
  const setting = await row(db, 'settings', makeSettingsRowId(userId, SOCIAL_PUSH_DETAILS_KEY));
  // Fail closed for absent/invalid, deleted, mismatched or stale account rows.
  return setting?.user_id === userId && setting.key === SOCIAL_PUSH_DETAILS_KEY &&
    setting.deleted !== true && setting.value === 'true';
}

function socialPushBody(item) {
  const actor = excerpt(item.actorName, 48) || 'A friend';
  const detail = excerpt(item.detail, 88);
  const quote = detail ? ` “${detail}”` : '';
  const emoji = item.emoji ? ` ${excerpt(item.emoji, 6)}` : '';
  const reply = excerpt(item.replyExcerpt, 50);
  switch (item.type) {
    case 'friend_request': return `${actor} sent you a friend request`;
    case 'friend_accepted': return `${actor} accepted your friend request`;
    case 'direct_message': return reply
      ? `${actor} replied to “${reply}”: ${detail || 'a message'}`
      : `${actor} sent a message${quote}`;
    case 'message_reaction': return `${actor} reacted to your message${quote}${emoji}`;
    case 'task_reaction': return `${actor} reacted to your task${quote}${emoji}`;
    case 'shared_task_invite': return `${actor} invited you to a shared task${quote}`;
    default: return '';
  }
}

async function isFriend(db, left, right) {
  if (!validId(left) || !validId(right) || left === right) return false;
  const id = (a,b) => 'fr_' + sha(a + '|' + b).slice(0,32);
  const [a,b] = await Promise.all([row(db,'friendships',id(left,right)),row(db,'friendships',id(right,left))]);
  return !!(a && b && !a.deleted && !b.deleted && a.status === 'accepted' && b.status === 'accepted');
}

// This is used for BOTH feed listing and exact push-tap lookup. Never cache
// unsent, revoked, private or no-longer-authorized event contents.
async function projectActivity(db, receipt, callerId, knownFriends = null) {
  const type = receipt?.type;
  if (!TYPES.includes(type) || receipt.recipient_id !== callerId) return null;
  const actorId = receipt.actor_id;
  const targetId = receipt.task_id;
  if (!validId(actorId) || !validId(targetId) || actorId === callerId) return null;
  const accepted = knownFriends ? knownFriends.has(actorId) : await isFriend(db, actorId, callerId);
  let actorName = 'Friend';
  let destination = '';
  let detail = '';
  let replyExcerpt = '';
  let emoji = '';
  if (type === 'friend_request') {
    const id = 'fr_' + sha(callerId + '|' + actorId).slice(0,32);
    const peerId = 'fr_' + sha(actorId + '|' + callerId).slice(0,32);
    const [mine, peer] = await Promise.all([row(db,'friendships',id),row(db,'friendships',peerId)]);
    if (!mine || !peer || mine.deleted || peer.deleted ||
        mine.status !== 'pending_incoming' || peer.status !== 'pending_outgoing' ||
        mine.$id !== targetId || mine.updated_at !== receipt.completed_at) return null;
    actorName = mine.friend_display_name || mine.friend_username || 'Friend';
    destination = '/explore';
  } else {
    if (!accepted) return null;
    const friendship = knownFriends?.get(actorId) || await row(db,'friendships','fr_' + sha(callerId + '|' + actorId).slice(0,32));
    actorName = friendship?.friend_display_name || friendship?.friend_username || 'Friend';
    if (type === 'friend_accepted') {
      const friendshipOfRecipient = await row(db,'friendships','fr_' + sha(callerId + '|' + actorId).slice(0,32));
      if (!friendshipOfRecipient || friendshipOfRecipient.updated_at !== receipt.completed_at) return null;
      destination = '/friends/' + actorId;
    } else if (type === 'direct_message' || type === 'message_reaction') {
      const message = await row(db, 'messages', targetId);
      if (!message || message.deleted || message.is_unsent ||
          message.sender_id !== actorId && type === 'direct_message' ||
          type === 'direct_message' && (message.user_id !== callerId ||
          message.recipient_id !== callerId || message.direction !== 'incoming') ||
          type === 'message_reaction' && (message.user_id !== callerId ||
          message.sender_id !== callerId || message.recipient_id !== actorId)) return null;
      detail = excerpt(message.content);
      if (type === 'direct_message') replyExcerpt = excerpt(message.reply_to_content, 60);
      else emoji = reactionEmoji(message.reactions, actorId);
      destination = '/messages/' + actorId;
    } else if (type === 'task_reaction') {
      const task = await row(db, 'tasks', targetId);
      if (!task || task.deleted || task.user_id !== callerId || !task.date) return null;
      let visibility = task.visibility || '';
      if (!visibility) {
        const category = await row(db,'categories',task.category_id);
        visibility = category?.user_id === callerId && !category.deleted
          ? category.visibility : 'private';
      }
      if (visibility === 'private') return null;
      detail = excerpt(task.title);
      emoji = reactionEmoji(task.reactions, actorId);
      destination = '/home';
    } else if (type === 'shared_task_invite') {
      const share = await row(db,'task_shares',targetId);
      if (!share || share.owner_id !== actorId || share.invitee_id !== callerId ||
          share.status !== 'pending') return null;
      const sharedTask = await row(db, 'tasks', share.task_id);
      if (!sharedTask || sharedTask.deleted || sharedTask.user_id !== actorId) return null;
      detail = excerpt(sharedTask.title);
      destination = '/notifications';
    }
  }
  return {
    id: receipt.$id, type, actorId, actorName,
    actorUsername: '', actorAvatarFileId: '',
    targetId, destination, detail, replyExcerpt, emoji,
    occurredAt: receipt.occurred_at,
    createdAt: receipt.created_at || receipt.occurred_at, readAt: receipt.read_at || '',
  };
}

async function emitActivity(db, { type, recipientId, actorId, sourceId, occurredAt, occurrenceKey }, log, push) {
  if (!TYPES.includes(type) || !validId(recipientId) || !validId(actorId) ||
      !validId(sourceId) || actorId === recipientId) return;
  const stamp = occurredAt || new Date().toISOString();
  const id = receiptId(recipientId,type,actorId,sourceId,occurrenceKey || stamp);
  const candidate = {
    $id:id, recipient_id:recipientId, actor_id:actorId, type,
    task_id:sourceId, completed_at:stamp, occurred_at:stamp,
    created_at:stamp, read_at:'',
  };
  const projected = await projectActivity(db,candidate,recipientId);
  if (!projected) return;
  const selected = (await channels(db,recipientId))[type];
  if (!selected?.feed && !selected?.push) return;
  try {
    await db.createRow({
      databaseId:DB,tableId:'notifications',rowId:id,permissions:[],
      data: {
        recipient_id:recipientId,actor_id:actorId,type,
        task_id:sourceId,completed_at:stamp,occurred_at:stamp,
        created_at:new Date().toISOString(),read_at:'',
      },
    });
  } catch (error) {
    if (Number(error?.code) === 409) return;
    throw error;
  }
  if (selected.push && typeof push === 'function') {
    try {
      const socialDetails = await includeSocialPushDetails(db, recipientId)
        ? { socialBody: socialPushBody(projected) } : null;
      await push(db,recipientId,{
        userId:recipientId,title:'Mosaic activity',body:'Open Mosaic to see an update.',
        url:'/notifications?alert=' + id,tag:id,
      },log,socialDetails);
    } catch (error) { log('activity push delivery failed: ' + error.message); }
  }
}

module.exports = { TYPES, DEFAULTS, KEY, SOCIAL_PUSH_DETAILS_KEY, receiptId, channels, projectActivity, emitActivity, socialPushBody };