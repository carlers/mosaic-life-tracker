const { Permission, Role } = require('node-appwrite');

const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || 'life_tracker';
const TASKS_TABLE = 'tasks';
const MAX_BATCH = 20;
const MAX_ROW_ID_LENGTH = 36;
const ROW_ID_REGEX = /^[a-zA-Z0-9_]+$/;
const VISIBILITIES = new Set(['', 'public', 'followers', 'private']);

function validId(value) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_ROW_ID_LENGTH &&
    !value.startsWith('_') &&
    ROW_ID_REGEX.test(value)
  );
}

function stringField(data, key, max, required = false) {
  const value = data[key];
  if (value === undefined || value === null) {
    return required ? null : '';
  }
  if (typeof value !== 'string' || value.length > max) return null;
  return value;
}

function isoField(data, key, required = false) {
  const value = stringField(data, key, 50, required);
  if (value === null) return null;
  if (value && Number.isNaN(Date.parse(value))) return null;
  return value;
}

function validateTask(input, callerId) {
  if (!input || typeof input !== 'object' || !validId(input.id)) return null;
  const data = input.data;
  if (!data || typeof data !== 'object') return null;
  if (
    data.user_id !== callerId ||
    data.source !== 'todomate' ||
    data.deleted !== false ||
    (data.reactions ?? '') !== ''
  ) {
    return null;
  }

  const title = stringField(data, 'title', 255, true);
  const categoryId = stringField(data, 'category_id', 255, true);
  const tags = stringField(data, 'tags', 1000);
  const date = stringField(data, 'date', 50, true);
  const memo = stringField(data, 'memo', 2000);
  const image = stringField(data, 'image', 255);
  const createdAt = isoField(data, 'created_at', true);
  const completedAt = isoField(data, 'completed_at');
  const updatedAt = isoField(data, 'updated_at', true);
  const visibility = stringField(data, 'visibility', 50, true);
  const routineId = stringField(data, 'routine_id', 255);
  const reminderTime = stringField(data, 'reminder_time', 50);

  if (
    title === null ||
    categoryId === null ||
    tags === null ||
    date === null ||
    memo === null ||
    image === null ||
    createdAt === null ||
    completedAt === null ||
    updatedAt === null ||
    visibility === null ||
    routineId === null ||
    reminderTime === null ||
    !VISIBILITIES.has(visibility) ||
    typeof data.is_completed !== 'boolean' ||
    !Number.isInteger(data.order) ||
    data.order < 0 ||
    data.order > 999999
  ) {
    return null;
  }

  return {
    id: input.id,
    data: {
      title,
      is_completed: data.is_completed,
      category_id: categoryId,
      order: data.order,
      tags,
      date,
      memo,
      image,
      created_at: createdAt,
      completed_at: completedAt,
      updated_at: updatedAt,
      source: 'todomate',
      user_id: callerId,
      deleted: false,
      visibility,
      routine_id: routineId,
      reminder_time: reminderTime,
      reactions: '',
    },
  };
}

async function handleTodoMateTaskBatch(db, callerId, payload) {
  const raw = payload?.tasks;
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_BATCH) {
    return { status: 400, body: { error: 'Invalid TodoMate task batch' } };
  }

  const tasks = raw.map((item) => validateTask(item, callerId));
  if (tasks.some((task) => task === null)) {
    return { status: 400, body: { error: 'Invalid TodoMate task' } };
  }

  const permissions = [
    Permission.read(Role.user(callerId)),
    Permission.update(Role.user(callerId)),
    Permission.delete(Role.user(callerId)),
  ];

  const results = await Promise.all(
    tasks.map(async (task) => {
      try {
        await db.createRow({
          databaseId: DATABASE_ID,
          tableId: TASKS_TABLE,
          rowId: task.id,
          data: task.data,
          permissions,
        });
        return { id: task.id, status: 'created' };
      } catch (err) {
        if (err?.code !== 409) throw err;
        const row = await db.getRow({
          databaseId: DATABASE_ID,
          tableId: TASKS_TABLE,
          rowId: task.id,
        });
        if (row?.user_id !== callerId) {
          return { id: task.id, status: 'foreign' };
        }
        return { id: task.id, status: 'existing', row };
      }
    })
  );

  if (results.some((result) => result.status === 'foreign')) {
    return { status: 403, body: { error: 'Task ownership mismatch' } };
  }

  return { status: 200, body: { ok: true, results } };
}

module.exports = { handleTodoMateTaskBatch };
