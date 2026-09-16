// Layer 3 — sync mapping
import { describe, it, expect } from 'vitest';
import {
  toAppwriteFormat,
  fromAppwriteFormat,
} from '../../src/lib/syncMapping';

const USER_ID = 'user_test_1';

describe('toAppwriteFormat — tasks', () => {
  const doc = {
    id: 'task_1',
    title: 'Buy groceries',
    completed: true,
    categoryId: 'cat_1',
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

  // Regression: §12 — camelCase → snake_case for the documented pairs
  it('maps completed → is_completed', () => {
    expect(toAppwriteFormat(doc, 'tasks', USER_ID).is_completed).toBe(true);
  });

  it('maps categoryId → category_id', () => {
    expect(toAppwriteFormat(doc, 'tasks', USER_ID).category_id).toBe('cat_1');
  });

  // Regression: §12 — isDeleted → deleted is a hard rule
  it('maps isDeleted → deleted', () => {
    expect(toAppwriteFormat(doc, 'tasks', USER_ID).deleted).toBe(false);
  });

  // Regression: §12 — user_id comes from the userId argument, not the doc
  it('sets user_id from the userId argument, not from the doc', () => {
    const other = { ...doc, userId: 'wrong_user' };
    expect(toAppwriteFormat(other, 'tasks', USER_ID).user_id).toBe(USER_ID);
  });

  // Regression: §12 — pass-through fields preserve their values verbatim
  it('preserves title, date, memo, image, tags, source verbatim', () => {
    const out = toAppwriteFormat(doc, 'tasks', USER_ID);
    expect(out.title).toBe('Buy groceries');
    expect(out.date).toBe('2026-01-15');
    expect(out.memo).toBe('milk, eggs');
    expect(out.image).toBe('img_abc');
    expect(out.tags).toBe('shopping');
    expect(out.source).toBe('routine');
  });

  // Regression: §12 — booleans are booleans, not 0/1
  it('keeps booleans as booleans', () => {
    const out = toAppwriteFormat(doc, 'tasks', USER_ID);
    expect(typeof out.is_completed).toBe('boolean');
    expect(typeof out.deleted).toBe('boolean');
  });

  // Regression: §12 — empty-string over null: optional strings stay ''
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

  // Regression: §12 — read_at is server-owned on outgoing rows.
  // Regression: §6 — omitting it prevents upsertRow's PUT semantics from
  // wiping the server-written read receipt on every sync cycle.
  it('omits read_at when direction is outgoing', () => {
    const out = toAppwriteFormat(outgoing, 'messages', USER_ID);
    expect('read_at' in out).toBe(false);
  });

  // Regression: §12 — incoming rows carry the read receipt
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

  // Regression: §12 — pass-through fields (already snake_case or unchanged)
  it('preserves direction, content, reactions, delivery_status verbatim', () => {
    const out = toAppwriteFormat(incoming, 'messages', USER_ID);
    expect(out.direction).toBe('incoming');
    expect(out.content).toBe('hello');
    expect(out.reactions).toBe('');
    expect(out.delivery_status).toBe('delivered');
  });

  // Regression: §12 — user_id from argument
  it('sets user_id from the userId argument', () => {
    expect(toAppwriteFormat(incoming, 'messages', USER_ID).user_id).toBe(
      USER_ID
    );
  });
});

describe('toAppwriteFormat — categories, diary, settings, friendships', () => {
  // Regression: §12 — user_id from argument, isDeleted → deleted, verbatim
  // pass-through for the remaining columns.
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
    };
    const out = toAppwriteFormat(doc, 'categories', USER_ID);
    expect(out.name).toBe('Work');
    expect(out.color).toBe('#3B82F6');
    expect(out.order).toBe(0);
    expect(out.visibility).toBe('private');
    expect(out.user_id).toBe(USER_ID);
    expect(out.deleted).toBe(false);
    expect(out.icon).toBe('');
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

  it('settings: maps documented fields', () => {
    const doc = {
      id: 's_1',
      userId: USER_ID,
      key: 'displayName',
      value: 'Alice',
      isDeleted: false,
    };
    const out = toAppwriteFormat(doc, 'settings', USER_ID);
    expect(out.key).toBe('displayName');
    expect(out.value).toBe('Alice');
    expect(out.user_id).toBe(USER_ID);
    expect(out.deleted).toBe(false);
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
  // Regression: §6 — Appwrite response keys ($id, $createdAt, $sequence, …)
  // must be stripped before the row enters RxDB.
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

  // Regression: §12 — deleted → isDeleted is a hard rule in the reverse
  // direction too.
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
    };
    const out = fromAppwriteFormat(row, 'categories');
    expect(out.isDeleted).toBe(true);
    expect(out.deleted).toBeUndefined();
  });

  // Regression: §12 — messages mapping table (snake_case → camelCase)
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
    // snake_case keys must not survive
    expect(out.thread_id).toBeUndefined();
    expect(out.task_ref_id).toBeUndefined();
    expect(out.reply_to_id).toBeUndefined();
    expect(out.is_unsent).toBeUndefined();
    expect(out.original_message_id).toBeUndefined();
  });

  // Regression: §12 — read_at → readAt unconditionally, regardless of
  // direction. The asymmetry lives in toAppwriteFormat, not here.
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

  // Regression: §12 — empty-string over null: missing optional fields
  // default to '' (not undefined).
  it('defaults missing optional fields to ""', () => {
    const row = {
      $id: 'msg_1',
      user_id: USER_ID,
      thread_id: 'th_abc',
      sender_id: USER_ID,
      recipient_id: 'user_b',
      direction: 'incoming',
      // content, task_ref_*, reply_to_*, reactions, read_at all missing
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
  // Regression: §12 — the local ↔ remote mapping is reversible for the
  // canonical doc shape, with one deliberate exception: the read_at field
  // on outgoing messages (see the outgoing-case test below).
  //
  // $id is injected between the two calls because Appwrite assigns it
  // server-side and returns it as a reserved key. toAppwriteFormat never
  // emits it; fromAppwriteFormat reads it as `row.$id`. In production the
  // value comes from Appwrite's response envelope, not from the client.
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

  // Regression: §12
  it('tasks: round-trips a canonical doc', () => {
    const doc = {
      id: 'task_1',
      title: 'Buy groceries',
      completed: true,
      categoryId: 'cat_1',
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

  // Regression: §12
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
    };
    expect(roundTrip(doc, 'categories', USER_ID)).toEqual(doc);
  });

  // Regression: §12
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

  // Regression: §12 — incoming messages preserve readAt through the
  // round-trip because toAppwriteFormat includes read_at for direction
  // 'incoming'.
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

  // Regression: §12 — the read_at asymmetry IS the rule. Outgoing rows
  // must not carry readAt through the client → server → client round-trip.
  // Asserting it explicitly prevents a future "helpful" change to
  // toAppwriteFormat from silently reintroducing the §6 wipe bug.
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
    // The read receipt is dropped on the wire, so the round-trip comes
    // back with readAt: ''. Everything else must match.
    expect(back.readAt).toBe('');
    expect({ ...back, readAt: '2026-01-15T20:00:00.000Z' }).toEqual(doc);
  });
});

// Parity with server mapping: skipped.
// appwrite-functions/message-action/main.js writes snake_case field names
// directly when constructing Appwrite rows (data: { user_id, thread_id, … })
// and reads snake_case directly from Appwrite responses. It never performs
// camelCase ↔ snake_case conversion, so there is no overlapping mapping
// logic to cross-check against src/lib/syncMapping.ts. The layer-1 parity
// suite (appwriteParity.test.ts) covers the pure helpers that ARE shared
// between client and server (reactionUtils, threads).
