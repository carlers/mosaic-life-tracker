import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  toAppwriteFormat,
  fromAppwriteFormat,
  __resetDriftWarningsForTests,
} from '../../src/lib/syncMapping';
const USER_ID = 'user_test_1';
afterEach(() => {
  vi.restoreAllMocks();
});
describe('toAppwriteFormat — tasks', () => {
  const doc = {
    id: 'task_1',
    title: 'Buy groceries',
    completed: true,
    categoryId: 'cat_1',
    order: 7,
    tags: 'shopping',
    date: '2026-01-15',
    memo: 'milk, eggs',
    image: 'img_abc',
    createdAt: '2026-01-01T10:00:00.000Z',
    completedAt: '2026-01-15T18:00:00.000Z',
    updatedAt: '2026-01-15T18:00:00.000Z',
    source: 'routine',
    userId: USER_ID,
    isDeleted: false,
    routineId: 'rt_1',
    reminderTime: '09:00',
    reactions: '',
    visibility: 'private',
  };
  it('maps completed → is_completed', () => {
    expect(toAppwriteFormat(doc, 'tasks', USER_ID).is_completed).toBe(true);
  });
  it('maps categoryId → category_id', () => {
    expect(toAppwriteFormat(doc, 'tasks', USER_ID).category_id).toBe('cat_1');
  });
  it('maps task order without coercion', () => {
    expect(toAppwriteFormat(doc, 'tasks', USER_ID).order).toBe(7);
  });
  it('maps isDeleted → deleted', () => {
    expect(toAppwriteFormat(doc, 'tasks', USER_ID).deleted).toBe(false);
  });
  it('sets user_id from the userId argument, not from the doc', () => {
    const other = { ...doc, userId: 'wrong_user' };
    expect(toAppwriteFormat(other, 'tasks', USER_ID).user_id).toBe(USER_ID);
  });
  it('preserves title, date, memo, image, tags, source verbatim', () => {
    const out = toAppwriteFormat(doc, 'tasks', USER_ID);
    expect(out.title).toBe('Buy groceries');
    expect(out.date).toBe('2026-01-15');
    expect(out.memo).toBe('milk, eggs');
    expect(out.image).toBe('img_abc');
    expect(out.tags).toBe('shopping');
    expect(out.source).toBe('routine');
  });
  it('keeps booleans as booleans', () => {
    const out = toAppwriteFormat(doc, 'tasks', USER_ID);
    expect(typeof out.is_completed).toBe('boolean');
    expect(typeof out.deleted).toBe('boolean');
  });
  it('keeps empty optional strings as "" (never null/undefined)', () => {
    const empty = {
      ...doc,
      memo: '',
      image: '',
      completedAt: '',
      tags: '',
    };
    const out = toAppwriteFormat(empty, 'tasks', USER_ID);
    expect(out.memo).toBe('');
    expect(out.image).toBe('');
    expect(out.completed_at).toBe('');
    expect(out.tags).toBe('');
    expect(out.memo).not.toBeNull();
    expect(out.memo).not.toBeUndefined();
  });
  // Regression: §12 — RxDB internal keys must not leak into the payload
  it('strips _meta, _deleted, _rev if present on the input', () => {
    const withMeta = {
      ...doc,
      _meta: { lwt: 123 },
      _deleted: false,
      _rev: 'abc',
    };
    const out = toAppwriteFormat(withMeta, 'tasks', USER_ID);
    expect(out._meta).toBeUndefined();
    expect(out._deleted).toBeUndefined();
    expect(out._rev).toBeUndefined();
  });
});
describe('toAppwriteFormat — messages', () => {
  const outgoing = {
    id: 'msg_1',
    userId: USER_ID,
    threadId: 'th_abc',
    senderId: USER_ID,
    recipientId: 'user_b',
    direction: 'outgoing',
    content: 'hello',
    taskRefId: 'task_1',
    taskRefTitle: 'Buy groceries',
    taskRefDate: '2026-01-15',
    taskRefColor: '#3B82F6',
    replyToId: 'msg_0',
    replyToContent: 'quoted',
    replyToSenderId: 'user_b',
    isUnsent: false,
    originalMessageId: 'msg_1',
    reactions: '',
    readAt: '2026-01-15T20:00:00.000Z',
    deliveryStatus: 'delivered',
    createdAt: '2026-01-15T19:00:00.000Z',
    updatedAt: '2026-01-15T19:00:00.000Z',
    isDeleted: false,
  };
  const incoming = {
    ...outgoing,
    id: 'rmsg_abc',
    direction: 'incoming',
  };
  it('omits read_at when direction is outgoing', () => {
    const out = toAppwriteFormat(outgoing, 'messages', USER_ID);
    expect('read_at' in out).toBe(false);
  });
  it('includes read_at when direction is incoming and the value is set', () => {
    const out = toAppwriteFormat(incoming, 'messages', USER_ID);
    expect(out.read_at).toBe('2026-01-15T20:00:00.000Z');
  });
  it('includes read_at as "" when direction is incoming and the value is empty', () => {
    const out = toAppwriteFormat(
      { ...incoming, readAt: '' },
      'messages',
      USER_ID
    );
    expect(out.read_at).toBe('');
  });
  // Regression: §12 — messages field mapping table
  it('maps every documented field from camelCase to snake_case', () => {
    const out = toAppwriteFormat(incoming, 'messages', USER_ID);
    expect(out.thread_id).toBe('th_abc');
    expect(out.sender_id).toBe(USER_ID);
    expect(out.recipient_id).toBe('user_b');
    expect(out.task_ref_id).toBe('task_1');
    expect(out.task_ref_title).toBe('Buy groceries');
    expect(out.task_ref_date).toBe('2026-01-15');
    expect(out.task_ref_color).toBe('#3B82F6');
    expect(out.reply_to_id).toBe('msg_0');
    expect(out.reply_to_content).toBe('quoted');
    expect(out.reply_to_sender_id).toBe('user_b');
    expect(out.is_unsent).toBe(false);
    expect(out.original_message_id).toBe('msg_1');
  });
  it('preserves direction, content, reactions, delivery_status verbatim', () => {
    const out = toAppwriteFormat(incoming, 'messages', USER_ID);
    expect(out.direction).toBe('incoming');
    expect(out.content).toBe('hello');
    expect(out.reactions).toBe('');
    expect(out.delivery_status).toBe('delivered');
  });
  it('sets user_id from the userId argument', () => {
    expect(toAppwriteFormat(incoming, 'messages', USER_ID).user_id).toBe(
      USER_ID
    );
  });
});
describe('toAppwriteFormat — categories, diary, settings, friendships', () => {
  it('categories: maps documented fields', () => {
    const doc = {
      id: 'cat_1',
      name: 'Work',
      color: '#3B82F6',
      order: 0,
      visibility: 'private',
      userId: USER_ID,
      isDeleted: false,
      icon: '',
      updatedAt: '2026-05-01T00:00:00.000Z',
    };
    const out = toAppwriteFormat(doc, 'categories', USER_ID);
    expect(out.name).toBe('Work');
    expect(out.color).toBe('#3B82F6');
    expect(out.order).toBe(0);
    expect(out.visibility).toBe('private');
    expect(out.user_id).toBe(USER_ID);
    expect(out.deleted).toBe(false);
    expect(out.icon).toBe('');
    expect(out.updated_at).toBe('2026-05-01T00:00:00.000Z');
  });
  it('categories: maps updatedAt → updated_at, defaulting to now when absent', () => {
    const withTs = {
      id: 'cat_1',
      name: 'Work',
      color: '#3B82F6',
      order: 0,
      visibility: 'private',
      userId: USER_ID,
      isDeleted: false,
      icon: '',
      updatedAt: '2026-05-01T00:00:00.000Z',
    };
    const out = toAppwriteFormat(withTs, 'categories', USER_ID);
    expect(out.updated_at).toBe('2026-05-01T00:00:00.000Z');
    const withoutTs = { ...withTs, updatedAt: undefined };
    const out2 = toAppwriteFormat(withoutTs, 'categories', USER_ID);
    expect(typeof out2.updated_at).toBe('string');
    expect((out2.updated_at as string).length).toBeGreaterThan(0);
  });
  it('diary: maps documented fields', () => {
    const doc = {
      id: 'd_1',
      date: '2026-01-15',
      content: 'Today was good.',
      visibility: 'private',
      userId: USER_ID,
      createdAt: '2026-01-15T20:00:00.000Z',
      updatedAt: '2026-01-15T21:00:00.000Z',
      isDeleted: false,
    };
    const out = toAppwriteFormat(doc, 'diary', USER_ID);
    expect(out.date).toBe('2026-01-15');
    expect(out.content).toBe('Today was good.');
    expect(out.visibility).toBe('private');
    expect(out.created_at).toBe('2026-01-15T20:00:00.000Z');
    expect(out.updated_at).toBe('2026-01-15T21:00:00.000Z');
    expect(out.user_id).toBe(USER_ID);
    expect(out.deleted).toBe(false);
  });
  it('settings: maps documented fields including updatedAt → updated_at', () => {
    const doc = {
      id: 's_1',
      userId: USER_ID,
      key: 'displayName',
      value: 'Alice',
      isDeleted: false,
      updatedAt: '2026-05-01T00:00:00.000Z',
    };
    const out = toAppwriteFormat(doc, 'settings', USER_ID);
    expect(out.key).toBe('displayName');
    expect(out.value).toBe('Alice');
    expect(out.user_id).toBe(USER_ID);
    expect(out.deleted).toBe(false);
    expect(out.updated_at).toBe('2026-05-01T00:00:00.000Z');
  });
  it('friendships: maps documented fields', () => {
    const doc = {
      id: 'fr_1',
      userId: USER_ID,
      friendId: 'user_b',
      friendUsername: 'bob',
      friendDisplayName: 'Bob',
      friendAvatarFileId: 'img_xyz',
      friendBio: 'hi',
      status: 'accepted',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
      isDeleted: false,
    };
    const out = toAppwriteFormat(doc, 'friendships', USER_ID);
    expect(out.friend_id).toBe('user_b');
    expect(out.friend_username).toBe('bob');
    expect(out.friend_display_name).toBe('Bob');
    expect(out.friend_avatar_file_id).toBe('img_xyz');
    expect(out.friend_bio).toBe('hi');
    expect(out.status).toBe('accepted');
    expect(out.user_id).toBe(USER_ID);
    expect(out.deleted).toBe(false);
  });
});
describe('fromAppwriteFormat', () => {
  it('strips Appwrite-specific $-prefixed keys', () => {
    const row = {
      $id: 'task_1',
      $createdAt: '2026-01-01T00:00:00.000Z',
      $updatedAt: '2026-01-01T00:00:00.000Z',
      $permissions: ['read("user:u1")'],
      $databaseId: 'life_tracker',
      $tableId: 'tasks',
      $sequence: '1',
      title: 'Buy groceries',
      is_completed: true,
      category_id: 'cat_1',
      order: 7,
      tags: '',
      date: '2026-01-15',
      memo: '',
      image: '',
      created_at: '2026-01-01T10:00:00.000Z',
      completed_at: '',
      updated_at: '2026-01-15T18:00:00.000Z',
      user_id: USER_ID,
      deleted: false,
      visibility: 'private',
      source: '',
      routine_id: '',
      reminder_time: '',
      reactions: '',
    };
    const out = fromAppwriteFormat(row, 'tasks');
    expect(out.$id).toBeUndefined();
    expect(out.$createdAt).toBeUndefined();
    expect(out.$updatedAt).toBeUndefined();
    expect(out.$permissions).toBeUndefined();
    expect(out.$databaseId).toBeUndefined();
    expect(out.$tableId).toBeUndefined();
    expect(out.$sequence).toBeUndefined();
  });
  it('maps deleted → isDeleted', () => {
    const row = {
      $id: 'cat_1',
      name: 'Work',
      color: '#3B82F6',
      order: 0,
      visibility: 'private',
      user_id: USER_ID,
      deleted: true,
      icon: '',
      updated_at: '2026-05-01T00:00:00.000Z',
    };
    const out = fromAppwriteFormat(row, 'categories');
    expect(out.isDeleted).toBe(true);
    expect(out.deleted).toBeUndefined();
  });
  it('categories: maps updated_at → updatedAt and strips the snake_case field', () => {
    const row = {
      $id: 'cat_1',
      name: 'Work',
      color: '#3B82F6',
      order: 0,
      visibility: 'private',
      user_id: USER_ID,
      deleted: false,
      icon: '',
      updated_at: '2026-05-01T00:00:00.000Z',
    };
    const out = fromAppwriteFormat(row, 'categories');
    expect(out.updatedAt).toBe('2026-05-01T00:00:00.000Z');
    expect(out.updated_at).toBeUndefined();
  });
  it('settings: maps updated_at → updatedAt and strips the snake_case field', () => {
    const row = {
      $id: 's_1',
      user_id: USER_ID,
      key: 'displayName',
      value: 'Alice',
      deleted: false,
      updated_at: '2026-05-01T00:00:00.000Z',
    };
    const out = fromAppwriteFormat(row, 'settings');
    expect(out.updatedAt).toBe('2026-05-01T00:00:00.000Z');
    expect(out.updated_at).toBeUndefined();
  });
  it('messages: maps all snake_case fields back to camelCase', () => {
    const row = {
      $id: 'msg_1',
      user_id: USER_ID,
      thread_id: 'th_abc',
      sender_id: USER_ID,
      recipient_id: 'user_b',
      direction: 'incoming',
      content: 'hello',
      task_ref_id: 'task_1',
      task_ref_title: 'Buy groceries',
      task_ref_date: '2026-01-15',
      task_ref_color: '#3B82F6',
      reply_to_id: 'msg_0',
      reply_to_content: 'quoted',
      reply_to_sender_id: 'user_b',
      is_unsent: false,
      original_message_id: 'msg_1',
      reactions: '',
      read_at: '2026-01-15T20:00:00.000Z',
      delivery_status: 'delivered',
      created_at: '2026-01-15T19:00:00.000Z',
      updated_at: '2026-01-15T19:00:00.000Z',
      deleted: false,
    };
    const out = fromAppwriteFormat(row, 'messages');
    expect(out.threadId).toBe('th_abc');
    expect(out.senderId).toBe(USER_ID);
    expect(out.recipientId).toBe('user_b');
    expect(out.taskRefId).toBe('task_1');
    expect(out.taskRefTitle).toBe('Buy groceries');
    expect(out.taskRefDate).toBe('2026-01-15');
    expect(out.taskRefColor).toBe('#3B82F6');
    expect(out.replyToId).toBe('msg_0');
    expect(out.replyToContent).toBe('quoted');
    expect(out.replyToSenderId).toBe('user_b');
    expect(out.isUnsent).toBe(false);
    expect(out.originalMessageId).toBe('msg_1');
    expect(out.thread_id).toBeUndefined();
    expect(out.task_ref_id).toBeUndefined();
    expect(out.reply_to_id).toBeUndefined();
    expect(out.is_unsent).toBeUndefined();
    expect(out.original_message_id).toBeUndefined();
  });
  it('messages: read_at maps to readAt regardless of direction', () => {
    const base = {
      $id: 'rmsg_1',
      user_id: USER_ID,
      thread_id: 'th_abc',
      sender_id: 'user_b',
      recipient_id: USER_ID,
      direction: 'incoming',
      content: 'hi',
      task_ref_id: '',
      task_ref_title: '',
      task_ref_date: '',
      task_ref_color: '',
      reply_to_id: '',
      reply_to_content: '',
      reply_to_sender_id: '',
      is_unsent: false,
      original_message_id: 'msg_1',
      reactions: '',
      read_at: '2026-01-15T20:00:00.000Z',
      delivery_status: 'delivered',
      created_at: '2026-01-15T19:00:00.000Z',
      updated_at: '2026-01-15T19:00:00.000Z',
      deleted: false,
    };
    const outgoing = { ...base, direction: 'outgoing' };
    expect(fromAppwriteFormat(base, 'messages').readAt).toBe(
      '2026-01-15T20:00:00.000Z'
    );
    expect(fromAppwriteFormat(outgoing, 'messages').readAt).toBe(
      '2026-01-15T20:00:00.000Z'
    );
  });
  it('defaults missing optional fields to ""', () => {
    const row = {
      $id: 'msg_1',
      user_id: USER_ID,
      thread_id: 'th_abc',
      sender_id: USER_ID,
      recipient_id: 'user_b',
      direction: 'incoming',
      delivery_status: 'delivered',
      created_at: '2026-01-15T19:00:00.000Z',
      updated_at: '2026-01-15T19:00:00.000Z',
      deleted: false,
    };
    const out = fromAppwriteFormat(row, 'messages');
    expect(out.content).toBe('');
    expect(out.taskRefId).toBe('');
    expect(out.taskRefTitle).toBe('');
    expect(out.taskRefDate).toBe('');
    expect(out.taskRefColor).toBe('');
    expect(out.replyToId).toBe('');
    expect(out.replyToContent).toBe('');
    expect(out.replyToSenderId).toBe('');
    expect(out.originalMessageId).toBe('');
    expect(out.reactions).toBe('');
    expect(out.readAt).toBe('');
  });
});
describe('round-trip', () => {
  function roundTrip(
    doc: Record<string, unknown>,
    collection: string,
    userId: string
  ): Record<string, unknown> {
    const aw = toAppwriteFormat(doc, collection, userId) as Record<
      string,
      unknown
    >;
    aw.$id = doc.id;
    return fromAppwriteFormat(aw, collection);
  }
  it('tasks: round-trips a canonical doc', () => {
    const doc = {
      id: 'task_1',
      title: 'Buy groceries',
      completed: true,
      categoryId: 'cat_1',
      order: 7,
      tags: 'shopping',
      date: '2026-01-15',
      memo: 'milk',
      image: 'img_abc',
      createdAt: '2026-01-01T10:00:00.000Z',
      completedAt: '2026-01-15T18:00:00.000Z',
      updatedAt: '2026-01-15T18:00:00.000Z',
      source: 'routine',
      userId: USER_ID,
      isDeleted: false,
      routineId: 'rt_1',
      reminderTime: '09:00',
      reactions: '',
      visibility: 'private',
    };
    expect(roundTrip(doc, 'tasks', USER_ID)).toEqual(doc);
  });
  it('categories: round-trips a canonical doc', () => {
    const doc = {
      id: 'cat_1',
      name: 'Work',
      color: '#3B82F6',
      order: 0,
      visibility: 'private',
      userId: USER_ID,
      isDeleted: false,
      icon: '',
      updatedAt: '2026-05-01T00:00:00.000Z',
    };
    expect(roundTrip(doc, 'categories', USER_ID)).toEqual(doc);
  });
  it('settings: round-trips a canonical doc', () => {
    const doc = {
      id: 's_1',
      userId: USER_ID,
      key: 'displayName',
      value: 'Alice',
      isDeleted: false,
      updatedAt: '2026-05-01T00:00:00.000Z',
    };
    expect(roundTrip(doc, 'settings', USER_ID)).toEqual(doc);
  });
  it('diary: round-trips a canonical doc', () => {
    const doc = {
      id: 'd_1',
      date: '2026-01-15',
      content: 'Today was good.',
      visibility: 'private',
      userId: USER_ID,
      createdAt: '2026-01-15T20:00:00.000Z',
      updatedAt: '2026-01-15T21:00:00.000Z',
      isDeleted: false,
    };
    expect(roundTrip(doc, 'diary', USER_ID)).toEqual(doc);
  });
  it('messages (incoming): round-trips and preserves readAt', () => {
    const doc = {
      id: 'rmsg_abc',
      userId: USER_ID,
      threadId: 'th_abc',
      senderId: 'user_b',
      recipientId: USER_ID,
      direction: 'incoming',
      content: 'hello',
      taskRefId: '',
      taskRefTitle: '',
      taskRefDate: '',
      taskRefColor: '',
      replyToId: '',
      replyToContent: '',
      replyToSenderId: '',
      isUnsent: false,
      originalMessageId: 'msg_1',
      reactions: '',
      readAt: '2026-01-15T20:00:00.000Z',
      deliveryStatus: 'delivered',
      createdAt: '2026-01-15T19:00:00.000Z',
      updatedAt: '2026-01-15T19:00:00.000Z',
      isDeleted: false,
    };
    expect(roundTrip(doc, 'messages', USER_ID)).toEqual(doc);
  });
  it('messages (outgoing): round-trips but drops readAt', () => {
    const doc = {
      id: 'msg_1',
      userId: USER_ID,
      threadId: 'th_abc',
      senderId: USER_ID,
      recipientId: 'user_b',
      direction: 'outgoing',
      content: 'hello',
      taskRefId: '',
      taskRefTitle: '',
      taskRefDate: '',
      taskRefColor: '',
      replyToId: '',
      replyToContent: '',
      replyToSenderId: '',
      isUnsent: false,
      originalMessageId: 'msg_1',
      reactions: '',
      readAt: '2026-01-15T20:00:00.000Z',
      deliveryStatus: 'delivered',
      createdAt: '2026-01-15T19:00:00.000Z',
      updatedAt: '2026-01-15T19:00:00.000Z',
      isDeleted: false,
    };
    const back = roundTrip(doc, 'messages', USER_ID);
    expect(back.readAt).toBe('');
    expect({ ...back, readAt: '2026-01-15T20:00:00.000Z' }).toEqual(doc);
  });
});
// Regression: §12 (remote schema drift fails visibly instead of silently dropping fields).
describe('fromAppwriteFormat — schema drift detection', () => {
  const baseCategoryRow = {
    $id: 'cat_1',
    name: 'Work',
    color: '#3B82F6',
    order: 0,
    visibility: 'private',
    user_id: USER_ID,
    deleted: false,
    icon: '',
    updated_at: '2026-05-01T00:00:00.000Z',
  };
  it('warns once when a row carries an unknown non-$ field', () => {
    __resetDriftWarningsForTests();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    fromAppwriteFormat(
      { ...baseCategoryRow, mystery_column: 'surprise' },
      'categories'
    );
    const drift = warnSpy.mock.calls
      .map((args) => String(args[0]))
      .filter((m) => m.includes('mystery_column'));
    expect(drift).toHaveLength(1);
    expect(drift[0]).toContain('categories');
    expect(drift[0]).toContain('schema drift');
  });
  it('does not warn twice for the same (collection, field)', () => {
    __resetDriftWarningsForTests();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const drifting = { ...baseCategoryRow, mystery_column: 'x' };
    fromAppwriteFormat(drifting, 'categories');
    fromAppwriteFormat({ ...drifting, $id: 'cat_2' }, 'categories');
    const drift = warnSpy.mock.calls
      .map((args) => String(args[0]))
      .filter((m) => m.includes('mystery_column'));
    expect(drift).toHaveLength(1);
  });
  it('warns separately for the same field name on different collections', () => {
    __resetDriftWarningsForTests();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    fromAppwriteFormat(
      { ...baseCategoryRow, mystery_column: 'x' },
      'categories'
    );
    fromAppwriteFormat(
      {
        $id: 'task_1',
        title: 'x',
        is_completed: false,
        category_id: '',
        tags: '',
        date: '2026-01-01',
        memo: '',
        image: '',
        created_at: '2026-01-01T00:00:00.000Z',
        completed_at: '',
        updated_at: '2026-01-01T00:00:00.000Z',
        user_id: USER_ID,
        deleted: false,
        visibility: '',
        source: '',
        routine_id: '',
        reminder_time: '',
        reactions: '',
        mystery_column: 'x',
      },
      'tasks'
    );
    const drift = warnSpy.mock.calls
      .map((args) => String(args[0]))
      .filter((m) => m.includes('mystery_column'));
    expect(drift).toHaveLength(2);
  });
  it('ignores unknown fields that start with $', () => {
    __resetDriftWarningsForTests();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    fromAppwriteFormat(
      { ...baseCategoryRow, $mystery: 'internal-metadata' },
      'categories'
    );
    expect(warnSpy).not.toHaveBeenCalled();
  });
  it('does not warn for a well-formed row', () => {
    __resetDriftWarningsForTests();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    fromAppwriteFormat(baseCategoryRow, 'categories');
    expect(warnSpy).not.toHaveBeenCalled();
  });
  it('does not warn for an unknown collection name', () => {
    __resetDriftWarningsForTests();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    fromAppwriteFormat({ $id: 'x', some_field: 'y' }, 'not_a_real_collection');
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
