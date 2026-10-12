import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const { receiptId, channels, emitActivity, projectActivity } =
  require('../../appwrite-functions/message-action/activity-notifications.js');

const id = (left: string, right: string) =>
  'fr_' + createHash('sha256').update(left + '|' + right).digest('hex').slice(0, 32);
const now = '2026-10-12T12:00:00.000Z';
const requestRows: Record<string, { $id: string; user_id: string; friend_id: string; status: string; deleted: boolean; friend_display_name?: string }> = {
  [id('user_b','user_a')]: {
    $id:id('user_b','user_a'),user_id:'user_b',friend_id:'user_a',
    status:'pending_incoming',deleted:false,friend_display_name:'A',
  },
  [id('user_a','user_b')]: {
    $id:id('user_a','user_b'),user_id:'user_a',friend_id:'user_b',
    status:'pending_outgoing',deleted:false,
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
