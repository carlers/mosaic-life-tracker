import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const { receiptId, channels, emitActivity, projectActivity } =
  require('../../appwrite-functions/message-action/activity-notifications.js');

const id = (left: string, right: string) =>
  'fr_' + createHash('sha256').update(left + '|' + right).digest('hex').slice(0, 32);
const now = '2026-10-12T12:00:00.000Z';
const requestRows: Record<string, { $id: string; user_id: string; friend_id: string; status: string; deleted: boolean; updated_at: string; friend_display_name?: string }> = {
  [id('user_b','user_a')]: {
    $id:id('user_b','user_a'),user_id:'user_b',friend_id:'user_a',
    status:'pending_incoming',deleted:false,friend_display_name:'A',updated_at:now,
  },
  [id('user_a','user_b')]: {
    $id:id('user_a','user_b'),user_id:'user_a',friend_id:'user_b',
    status:'pending_outgoing',deleted:false,updated_at:now,
  },
};

function dbFor(rows: Record<string, unknown>, settings: Record<string, unknown> = {}) {
  const receipts = new Set<string>();
  return {
    getRow: vi.fn(async ({ tableId, rowId }: { tableId: string; rowId: string }) => {
      if (tableId === 'settings') {
        if (settings[rowId]) return settings[rowId];
      } else {
        const found = rows[rowId];
        if (found) return found;
      }
      throw Object.assign(new Error('not found'), { code: 404 });
    }),
    createRow: vi.fn(async ({ rowId }: { rowId: string; data: { type: string }; permissions: string[] }) => {
      if (receipts.has(rowId)) throw Object.assign(new Error('duplicate'), { code: 409 });
      receipts.add(rowId);
    }),
  };
}
const request = {
  type:'friend_request',actorId:'user_a',recipientId:'user_b',
  sourceId:id('user_b','user_a'),occurredAt:now,occurrenceKey:now,
};

describe('typed activity notifications', () => {
  it('creates Appwrite-safe unique deterministic IDs by recipient and event', () => {
    const one = receiptId('user_b','friend_request','user_a',request.sourceId,now);
    expect(one).toMatch(/^not_[a-f0-9]{32}$/);
    expect(one).not.toBe(receiptId('user_c','friend_request','user_a',request.sourceId,now));
    expect(one).not.toBe(receiptId('user_b','friend_accepted','user_a',request.sourceId,now));
  });

  it('creates and pushes once for an authorized incoming request, even on retry', async () => {
    const db = dbFor(requestRows);
    const push = vi.fn();
    await emitActivity(db,request,vi.fn(),push);
    await emitActivity(db,request,vi.fn(),push);
    expect(db.createRow).toHaveBeenCalledTimes(2);
    expect(push).toHaveBeenCalledTimes(1);
    expect(push.mock.calls[0][2]).toMatchObject({ body: 'Open Mosaic to see an update.' });
    expect(db.createRow.mock.calls[0][0].data.type).toBe('friend_request');
    expect(db.createRow.mock.calls[0][0].permissions).toEqual([]);
  });

  it('rejects a cancelled request before creating or pushing', async () => {
    const db = dbFor({ ...requestRows,
      [id('user_b','user_a')]: { ...requestRows[id('user_b','user_a')], deleted:true },
    });
    const push = vi.fn();
    await emitActivity(db,request,vi.fn(),push);
    expect(db.createRow).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it('fails closed when a once-valid notification no longer has access', async () => {
    const db = dbFor({});
    const result = await projectActivity(db,{
      $id:receiptId('user_b','friend_request','user_a',request.sourceId,now),
      recipient_id:'user_b',actor_id:'user_a',type:'friend_request',
      task_id:request.sourceId,occurred_at:now,created_at:now,read_at:'',
    },'user_b');
    expect(result).toBeNull();
  });

  it('does not resurrect an older request receipt after a new friendship epoch', async () => {
    const db = dbFor({
      ...requestRows,
      [id('user_b','user_a')]: {
        ...requestRows[id('user_b','user_a')],
        updated_at:'2026-10-13T12:00:00.000Z',
      },
    });
    const oldReceipt = {
      $id:receiptId('user_b','friend_request','user_a',request.sourceId,now),
      recipient_id:'user_b',actor_id:'user_a',type:'friend_request',
      task_id:request.sourceId,completed_at:now,
      occurred_at:now,created_at:now,read_at:'',
    };
    expect(await projectActivity(db,oldReceipt,'user_b')).toBeNull();
  });

  it('honors independent synced feed and push switches and rejects malformed policy', async () => {
    const defaults = await channels(dbFor({}),'user_b');
    expect(defaults.message_reaction).toEqual({ feed:true, push:false });
    const settingId = 'user_b_alertsChannels';
    const setting = {
      $id:settingId,user_id:'user_b',key:'alertsChannels',deleted:false,
      value:JSON.stringify({ friend_request:{ feed:false,push:true } }),
    };
    const db = dbFor(requestRows,{ [settingId]:setting });
    const push = vi.fn();
    await emitActivity(db,request,vi.fn(),push);
    expect(db.createRow).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledTimes(1);
    const parsed = await channels(db,'user_b');
    expect(parsed.friend_request).toEqual({ feed:false,push:true });
    expect(parsed.message_reaction).toEqual({ feed:true,push:false });
  });
});

describe('volatile authorized notification details', () => {
  const friendship = {
    [id('user_a','user_b')]: { ...requestRows[id('user_a','user_b')], status: 'accepted' },
    [id('user_b','user_a')]: { ...requestRows[id('user_b','user_a')], status: 'accepted' },
  };
  const receipt = (type: string, sourceId: string) => ({
    $id: 'not_' + 'c'.repeat(32), recipient_id: 'user_b', actor_id: 'user_a',
    type, task_id: sourceId, completed_at: now, occurred_at: now,
    created_at: now, read_at: '',
  });

  it('projects a bounded message and reply excerpt only after reciprocal friendship and recipient ownership', async () => {
    const message = {
      $id: 'rmsg_sample', user_id: 'user_b', sender_id: 'user_a',
      recipient_id: 'user_b', direction: 'incoming', deleted: false, is_unsent: false,
      content: ' Hello\nworld ' + 'x'.repeat(150),
      reply_to_content: ' Previous private content ',
    };
    const db = dbFor({ ...friendship, [message.$id]: message });
    const result = await projectActivity(db, receipt('direct_message', message.$id), 'user_b');
    expect(result?.detail).toMatch(/^Hello world/);
    expect(Array.from(result?.detail || '')).toHaveLength(100);
    expect(result?.replyExcerpt).toBe('Previous private content');
    expect(result?.emoji).toBe('');

    const denied = dbFor({ [message.$id]: message });
    expect(await projectActivity(denied, receipt('direct_message', message.$id), 'user_b')).toBeNull();
    const unsent = dbFor({ ...friendship, [message.$id]: { ...message, is_unsent: true } });
    expect(await projectActivity(unsent, receipt('direct_message', message.$id), 'user_b')).toBeNull();
  });

  it('attributes message reaction emoji only when the current reaction row identifies one actor emoji', async () => {
    const original = {
      $id: 'msg_original', user_id: 'user_b', sender_id: 'user_b',
      recipient_id: 'user_a', deleted: false, is_unsent: false,
      content: 'A private original message',
      reactions: JSON.stringify([{ emoji: '🔥', userIds: ['user_a'] }]),
    };
    const db = dbFor({ ...friendship, [original.$id]: original });
    const result = await projectActivity(db, receipt('message_reaction', original.$id), 'user_b');
    expect(result?.detail).toBe('A private original message');
    expect(result?.emoji).toBe('🔥');
    const ambiguous = dbFor({ ...friendship, [original.$id]: {
      ...original, reactions: JSON.stringify([
        { emoji: '🔥', userIds: ['user_a'] }, { emoji: '👍', userIds: ['user_a'] },
      ]),
    } });
    expect((await projectActivity(ambiguous, receipt('message_reaction', original.$id), 'user_b'))?.emoji).toBe('');
  });

  it('never projects private or undated task details and bounds shared invitation titles', async () => {
    const task = {
      $id: 'task_1', user_id: 'user_b', deleted: false, date: '2026-10-15',
      category_id: 'cat_1', visibility: 'followers', title: 'Run a marathon',
      reactions: JSON.stringify([{ emoji: '💪', userIds: ['user_a'] }]),
    };
    const read = () => projectActivity(dbFor({ ...friendship, [task.$id]: task }),
      receipt('task_reaction', task.$id), 'user_b');
    expect((await read())?.detail).toBe('Run a marathon');
    const hidden = dbFor({ ...friendship, [task.$id]: { ...task, visibility: 'private' } });
    expect(await projectActivity(hidden, receipt('task_reaction', task.$id), 'user_b')).toBeNull();
    const undated = dbFor({ ...friendship, [task.$id]: { ...task, date: '' } });
    expect(await projectActivity(undated, receipt('task_reaction', task.$id), 'user_b')).toBeNull();

    const share = { $id: 'share_1', owner_id: 'user_a', invitee_id: 'user_b',
      task_id: 'task_share_1', status: 'pending' };
    const sharedTask = { $id: 'task_share_1', user_id: 'user_a', title: 'Plan our trip', deleted: false };
    const invited = dbFor({ ...friendship, [share.$id]: share, [sharedTask.$id]: sharedTask });
    const result = await projectActivity(invited, receipt('shared_task_invite', share.$id), 'user_b');
    expect(result?.detail).toBe('Plan our trip');
  });
});
