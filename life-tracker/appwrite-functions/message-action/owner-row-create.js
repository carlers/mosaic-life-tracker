'use strict';

const { Permission, Role } = require('node-appwrite');
const { guardOwnerMediaReferences } = require('./owner-media-reference-guard');
const { stageReferenceTransaction, enabled: referenceFenceEnabled } = require('./media-reference-transaction');

const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || 'life_tracker';
const ROW_ID = /^[A-Za-z0-9][A-Za-z0-9_]{0,35}$/;
const VISIBILITY = new Set(['', 'private', 'followers', 'public']);
const TASK_KEYS = new Set([
  'user_id', 'title', 'is_completed', 'category_id', 'order', 'tags', 'date',
  'memo', 'image', 'created_at', 'completed_at', 'updated_at', 'source',
  'deleted', 'visibility', 'routine_id', 'reminder_time', 'reactions',
]);
const CATEGORY_KEYS = new Set([
  'user_id', 'name', 'color', 'order', 'visibility', 'icon',
  'retired_on', 'updated_at', 'deleted',
]);
const DIARY_KEYS = new Set([
  'user_id', 'date', 'content', 'emoji', 'photos', 'visibility',
  'created_at', 'updated_at', 'deleted',
]);
const SETTINGS_KEYS = new Set([
  'user_id', 'key', 'value', 'updated_at', 'deleted',
]);
const KEYSETS = { tasks: TASK_KEYS, categories: CATEGORY_KEYS,
  diary: DIARY_KEYS, settings: SETTINGS_KEYS };

function validId(value) {
  return typeof value === 'string' && ROW_ID.test(value);
}

function validDate(value, allowEmpty = true) {
  if (allowEmpty && value === '') return true;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const t = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(t.getTime()) && t.toISOString().startsWith(value);
}

function validTimestamp(value) {
  return typeof value === 'string' && value.length <= 50 &&
    !Number.isNaN(Date.parse(value));
}

function validatePayload(tableId, rowId, data, ownerId) {
  if (!Object.prototype.hasOwnProperty.call(KEYSETS, tableId) ||
    !validId(rowId) || !data || typeof data !== 'object' ||
    Array.isArray(data) || data.user_id !== ownerId || data.deleted !== false) {
    return false;
  }
  if (Object.keys(data).some(key => !KEYSETS[tableId].has(key))) return false;
  if (!validTimestamp(data.updated_at)) return false;

  if (tableId === 'settings') {
    return typeof data.key === 'string' && data.key.length > 0 &&
      data.key.length <= 100 && typeof data.value === 'string';
  }
  if (tableId === 'diary') {
    return validDate(data.date, false) && VISIBILITY.has(data.visibility) &&
      (data.created_at === undefined || validTimestamp(data.created_at)) &&
      (data.content === undefined || typeof data.content === 'string') &&
      (data.emoji === undefined || (typeof data.emoji === 'string' && data.emoji.length <= 32)) &&
      (data.photos === undefined || typeof data.photos === 'string');
  }
  if (!Number.isSafeInteger(data.order) || data.order < 0 ||
      !VISIBILITY.has(data.visibility)) return false;

  if (tableId === 'categories') {
    return typeof data.name === 'string' && data.name.trim().length > 0 &&
      data.name.length <= 100 && typeof data.color === 'string' &&
      /^#[0-9a-fA-F]{6}$/.test(data.color) &&
      (data.retired_on === undefined || validDate(data.retired_on)) &&
      (data.icon === undefined || (typeof data.icon === 'string' && data.icon.length <= 100));
  }

  return validId(data.category_id) && typeof data.title === 'string' &&
    data.title.length > 0 && data.title.length <= 255 &&
    typeof data.is_completed === 'boolean' && validDate(data.date) &&
    validTimestamp(data.created_at) &&
    (data.completed_at === undefined || data.completed_at === '' || validTimestamp(data.completed_at)) &&
    (data.reactions === undefined || data.reactions === '') &&
    ['tags', 'memo', 'image', 'source', 'routine_id', 'reminder_time'].every(k =>
      data[k] === undefined || typeof data[k] === 'string');
}

// This is an additive, owner-fenced *create* API. It does not authorize category
// destruction. Existing row permissions remain unchanged until a separately
// proven legacy/offline-client cutover and queue-recovery strategy.
async function handleOwnerRowCreate(db, callerId, payload) {
  const tableId = payload?.tableId;
  const rowId = payload?.rowId;
  const data = payload?.data;
  if (!validatePayload(tableId, rowId, data, callerId)) {
    return { status: 400, body: { error: 'Invalid owner row create request' } };
  }

  if (tableId === 'tasks') {
    let category;
    try {
      category = await db.getRow({
        databaseId: DATABASE_ID, tableId: 'categories', rowId: data.category_id,
      });
    } catch (error) {
      if (error?.code === 404) {
        return { status: 409, body: { error: 'Task category unavailable' } };
      }
      throw error;
    }
    if (!category || category.user_id !== callerId || category.deleted !== false ||
      category.lifecycle_state ||
      (category.retired_on && (data.date === '' || data.date > category.retired_on))) {
      return { status: 409, body: { error: 'Task category unavailable' } };
    }
  }

  const mediaDenial = await guardOwnerMediaReferences(db, callerId, tableId, data);
  if (mediaDenial) return mediaDenial;

  try {
    const create = transactionId => db.createRow({
      databaseId: DATABASE_ID, tableId, rowId, data,
      // No browser UPDATE or DELETE on newly created owner rows.
      permissions: [Permission.read(Role.user(callerId))],
      ...(transactionId ? { transactionId } : {}),
    });
    if (referenceFenceEnabled()) {
      const fenced = await stageReferenceTransaction(db, {
        callerId, tableId, data, stageTarget: create,
      });
      if (fenced.denied) return fenced.denied;
      if (!fenced.guarded) await create();
    } else {
      await create();
    }
    // Close the in-flight create vs. category-lock race. An already-started
    // create may pass the first read just before lifecycle claim. Re-read
    // after creation and compensate before exposing successful creation.
    if (tableId === 'tasks') {
      const current = await db.getRow({
        databaseId: DATABASE_ID, tableId: 'categories', rowId: data.category_id,
      });
      if (!current || current.user_id !== callerId || current.deleted ||
          current.lifecycle_state) {
        await db.updateRow({
          databaseId: DATABASE_ID, tableId: 'tasks', rowId,
          data: {deleted: true, updated_at: new Date().toISOString()},
        });
        return { status: 409, body: { error: 'Task category unavailable' } };
      }
    }
    return { status: 200, body: { ok: true, status: 'created' } };
  } catch (error) {
    if (Number(error?.code) !== 409) throw error;
    const row = await db.getRow({ databaseId: DATABASE_ID, tableId, rowId })
      .catch(e => { if (Number(e?.code) === 404) return null; throw e; });
    if (!row) return { status: 409, body: { error: 'Concurrent reference write conflict' } };
    if (row?.user_id !== callerId) {
      return { status: 403, body: { error: 'Owner mismatch' } };
    }
    return { status: 200, body: { ok: true, status: 'existing', row } };
  }
}

module.exports = { handleOwnerRowCreate };
