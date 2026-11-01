'use strict';

const { Permission, Role } = require('node-appwrite');

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
  if ((tableId !== 'tasks' && tableId !== 'categories') ||
    !validId(rowId) || !data || typeof data !== 'object' ||
    Array.isArray(data) || data.user_id !== ownerId || data.deleted !== false) {
    return false;
  }
  const keys = tableId === 'tasks' ? TASK_KEYS : CATEGORY_KEYS;
  if (Object.keys(data).some(key => !keys.has(key))) return false;
  if (!validTimestamp(data.updated_at) || !Number.isSafeInteger(data.order) ||
    data.order < 0 || !VISIBILITY.has(data.visibility)) return false;

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
      (category.retired_on && (data.date === '' || data.date > category.retired_on))) {
      return { status: 409, body: { error: 'Task category unavailable' } };
    }
  }

  try {
    await db.createRow({
      databaseId: DATABASE_ID, tableId, rowId, data,
      permissions: [
        Permission.read(Role.user(callerId)),
        Permission.update(Role.user(callerId)),
        Permission.delete(Role.user(callerId)),
      ],
    });
    return { status: 200, body: { ok: true, status: 'created' } };
  } catch (error) {
    if (error?.code !== 409) throw error;
    const row = await db.getRow({ databaseId: DATABASE_ID, tableId, rowId });
    if (row?.user_id !== callerId) {
      return { status: 403, body: { error: 'Owner mismatch' } };
    }
    return { status: 200, body: { ok: true, status: 'existing', row } };
  }
}

module.exports = { handleOwnerRowCreate };
