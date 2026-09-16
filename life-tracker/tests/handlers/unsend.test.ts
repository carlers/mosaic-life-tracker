import { describe, it, expect, beforeEach } from 'vitest';
import { invoke, makeMockDb, type MockDb } from '../helpers/invoke-handler';

const CALLER = 'user_a';
const RECIPIENT = 'user_b';
const MESSAGE_ID = 'msg_test_1';

const friendshipRow = () => ({ $id: 'fr_test' });

describe('message-action / unsend', () => {
  let mockDb: MockDb;

  beforeEach(() => {
    mockDb = makeMockDb();
  });

  // Regression: A1 — messageId must be present and valid.
  it('returns 400 when messageId is missing', async () => {
    const res = await invoke({
      userId: CALLER,
      mockDb,
      body: { action: 'unsend', recipientId: RECIPIENT },
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid messageId');
  });

  it('returns 400 when recipientId is missing', async () => {
    const res = await invoke({
      userId: CALLER,
      mockDb,
      body: { action: 'unsend', messageId: MESSAGE_ID },
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid recipientId');
  });

  // Regression: R1-2 — a caller cannot unsend another user's message.
  it('returns 403 when the caller does not own the row', async () => {
    mockDb.listRows
      .mockResolvedValueOnce({ rows: [friendshipRow()] })
      .mockResolvedValueOnce({ rows: [friendshipRow()] });

    mockDb.getRow.mockResolvedValueOnce({
      user_id: 'someone_else',
      direction: 'outgoing',
      sender_id: 'someone_else',
      recipient_id: RECIPIENT,
    });

    const res = await invoke({
      userId: CALLER,
      mockDb,
      body: { action: 'unsend', messageId: MESSAGE_ID, recipientId: RECIPIENT },
    });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Not your message');
    expect(mockDb.updateRow).not.toHaveBeenCalled();
  });

  // Regression: A1 — successful unsend must wipe both the caller's row and
  // the deterministic recipient row, and cascade reply-wipes must run.
  it('successful: wipes both rows and runs the cascade', async () => {
    mockDb.listRows
      .mockResolvedValueOnce({ rows: [friendshipRow()] })
      .mockResolvedValueOnce({ rows: [friendshipRow()] })
      // Cascade: 4 listRows, all empty.
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    mockDb.getRow.mockResolvedValueOnce({
      user_id: CALLER,
      direction: 'outgoing',
      sender_id: CALLER,
      recipient_id: RECIPIENT,
    });

    const res = await invoke({
      userId: CALLER,
      mockDb,
      body: { action: 'unsend', messageId: MESSAGE_ID, recipientId: RECIPIENT },
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      patchedCaller: true,
      patchedRecipient: true,
      cascaded: 0,
    });

    expect(mockDb.updateRow).toHaveBeenCalledTimes(2);

    const callerUpdate = mockDb.updateRow.mock.calls[0][0];
    expect(callerUpdate.rowId).toBe(MESSAGE_ID);
    expect(callerUpdate.data.is_unsent).toBe(true);
    expect(callerUpdate.data.content).toBe('');
    expect(callerUpdate.data.reactions).toBe('');

    const recipientUpdate = mockDb.updateRow.mock.calls[1][0];
    expect(recipientUpdate.rowId).toMatch(/^rmsg_[a-f0-9]{30}$/);
    expect(recipientUpdate.data.is_unsent).toBe(true);
    expect(recipientUpdate.data.content).toBe('');
  });

  // Regression: R1-2 — the cascade must paginate past 100 reply rows.
  it('cascade pagination: >100 replies trigger a second listRows with cursorAfter', async () => {
    const hundredReplies = Array.from({ length: 100 }, (_, i) => ({
      $id: `rep${String(i).padStart(3, '0')}`,
      reply_to_content: 'quoted text',
    }));

    mockDb.listRows
      .mockResolvedValueOnce({ rows: [friendshipRow()] })
      .mockResolvedValueOnce({ rows: [friendshipRow()] })
      // Cascade #1 (callerId × messageId): page 1 and page 2
      .mockResolvedValueOnce({ rows: hundredReplies })
      .mockResolvedValueOnce({ rows: [] })
      // Cascade #2..#4: empty
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    mockDb.getRow.mockResolvedValueOnce({
      user_id: CALLER,
      direction: 'outgoing',
      sender_id: CALLER,
      recipient_id: RECIPIENT,
    });

    const res = await invoke({
      userId: CALLER,
      mockDb,
      body: { action: 'unsend', messageId: MESSAGE_ID, recipientId: RECIPIENT },
    });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.cascaded).toBe(100);

    // listRows call index 3 is cascade #1's second page.
    const secondPageQueries = mockDb.listRows.mock.calls[3][0].queries;
    expect(
      secondPageQueries.some((q: { op?: string }) => q?.op === 'cursorAfter')
    ).toBe(true);
  });
});
