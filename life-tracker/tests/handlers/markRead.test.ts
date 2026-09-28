import { describe, it, expect, beforeEach } from 'vitest';
import { invoke, makeMockDb, type MockDb } from '../helpers/invoke-handler';

const CALLER = 'user_a';
const PARTNER = 'user_b';
const THREAD_ID = 'th_0123456789abcdefghijklmnopqrst';

const friendshipRow = () => ({ $id: 'fr_test' });
const participantRow = () => ({ $id: 'msg_caller_in_thread' });

describe('message-action / mark_read', () => {
  let mockDb: MockDb;

  beforeEach(() => {
    mockDb = makeMockDb();
  });

  // Regression: §11/§20.3 (mark_read validates participant row IDs).
  it('returns 400 when partnerId is missing', async () => {
    const res = await invoke({
      userId: CALLER,
      mockDb,
      body: { action: 'mark_read', threadId: THREAD_ID },
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid partnerId');
  });

  it('returns 400 when threadId is missing', async () => {
    const res = await invoke({
      userId: CALLER,
      mockDb,
      body: { action: 'mark_read', partnerId: PARTNER },
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid threadId');
  });

  it('returns 400 when partnerId equals callerId', async () => {
    const res = await invoke({
      userId: CALLER,
      mockDb,
      body: { action: 'mark_read', partnerId: CALLER, threadId: THREAD_ID },
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('partnerId cannot be self');
  });

  // Regression: §20.3/§20.5 (mark_read requires accepted friendship).
  it('returns 403 when the caller is not friends with the partner', async () => {
    const res = await invoke({
      userId: CALLER,
      mockDb,
      body: { action: 'mark_read', partnerId: PARTNER, threadId: THREAD_ID },
    });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Not friends with this user');
    expect(mockDb.updateRow).not.toHaveBeenCalled();
  });

  // Regression: §20.5 (mark_read validates caller membership before mutation).
  it('returns 403 when the caller is not a participant in the thread', async () => {
    mockDb.listRows
      .mockResolvedValueOnce({ rows: [friendshipRow()] })
      .mockResolvedValueOnce({ rows: [friendshipRow()] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await invoke({
      userId: CALLER,
      mockDb,
      body: { action: 'mark_read', partnerId: PARTNER, threadId: THREAD_ID },
    });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Not a participant in this thread');
    expect(mockDb.updateRow).not.toHaveBeenCalled();
  });

  // Regression: §20.5 (mark_read updates both participant views and reports counts).
  it('successful: marks partner and caller rows and reports both counts', async () => {
    mockDb.listRows
      .mockResolvedValueOnce({ rows: [friendshipRow()] })
      .mockResolvedValueOnce({ rows: [friendshipRow()] })
      .mockResolvedValueOnce({ rows: [participantRow()] })
      // Pass 1 (partner's outgoing rows)
      .mockResolvedValueOnce({ rows: [{ $id: 'p1' }, { $id: 'p2' }] })
      // Pass 2 (caller's incoming rows)
      .mockResolvedValueOnce({ rows: [{ $id: 'c1' }] });

    const res = await invoke({
      userId: CALLER,
      mockDb,
      body: { action: 'mark_read', partnerId: PARTNER, threadId: THREAD_ID },
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      markedPartner: 2,
      markedCaller: 1,
    });
    expect(mockDb.updateRow).toHaveBeenCalledTimes(3);
  });

  // Regression: §20.5 (mark_read paginates through the full thread).
  // 100-row page is returned.
  it('pagination: >100 rows in pass 1 triggers a second listRows with cursorAfter', async () => {
    const hundredRows = Array.from({ length: 100 }, (_, i) => ({
      $id: `p${String(i).padStart(3, '0')}`,
    }));

    mockDb.listRows
      .mockResolvedValueOnce({ rows: [friendshipRow()] })
      .mockResolvedValueOnce({ rows: [friendshipRow()] })
      .mockResolvedValueOnce({ rows: [participantRow()] })
      .mockResolvedValueOnce({ rows: hundredRows })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await invoke({
      userId: CALLER,
      mockDb,
      body: { action: 'mark_read', partnerId: PARTNER, threadId: THREAD_ID },
    });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.markedPartner).toBe(100);
    expect(res.body.markedCaller).toBe(0);

    // listRows call index 4 is pass 1's second page.
    const secondPageQueries = mockDb.listRows.mock.calls[4][0].queries;
    expect(
      secondPageQueries.some((q: { op?: string }) => q?.op === 'cursorAfter')
    ).toBe(true);
  });
});
