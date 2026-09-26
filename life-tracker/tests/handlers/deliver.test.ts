import { describe, it, expect, beforeEach } from 'vitest';
import { invoke, makeMockDb, type MockDb } from '../helpers/invoke-handler';

const CALLER = 'user_a';
const RECIPIENT = 'user_b';
const MESSAGE_ID = 'msg_test_1';

const friendshipRow = () => ({ $id: 'fr_test' });

describe('message-action / deliver', () => {
  let mockDb: MockDb;

  beforeEach(() => {
    mockDb = makeMockDb();
  });

  // Regression: §11/§20.3 (delivery rejects invalid message row IDs).
  // row id, including missing values.
  it('returns 400 when messageId is missing', async () => {
    const res = await invoke({
      userId: CALLER,
      mockDb,
      body: { action: 'deliver', recipientId: RECIPIENT, content: 'hi' },
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid messageId');
  });

  it('returns 400 when recipientId is missing', async () => {
    const res = await invoke({
      userId: CALLER,
      mockDb,
      body: { action: 'deliver', messageId: MESSAGE_ID, content: 'hi' },
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid recipientId');
  });

  // Regression: §11/§20.3 (delivery enforces the msg_ sender-row prefix).
  // bypass the client-side generator.
  it('returns 400 with "Invalid messageId format" when msg_ prefix is missing', async () => {
    const res = await invoke({
      userId: CALLER,
      mockDb,
      body: {
        action: 'deliver',
        messageId: 'not_a_msg_id',
        recipientId: RECIPIENT,
        content: 'hi',
      },
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid messageId format');
  });

  it('returns 400 "Cannot message yourself" when recipientId equals callerId', async () => {
    const res = await invoke({
      userId: CALLER,
      mockDb,
      body: {
        action: 'deliver',
        messageId: MESSAGE_ID,
        recipientId: CALLER,
        content: 'hi',
      },
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Cannot message yourself');
  });

  // Regression: §20.3 (delivery rejects messages with no content or reference).
  // must not be delivered.
  it('returns 400 "Message has no content" when content and refs are all empty', async () => {
    const res = await invoke({
      userId: CALLER,
      mockDb,
      body: {
        action: 'deliver',
        messageId: MESSAGE_ID,
        recipientId: RECIPIENT,
        content: '   ',
      },
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Message has no content');
  });

  // Regression: §20.3 (friendship is verified before cross-user delivery).
  it('returns 403 when the caller is not friends with the recipient', async () => {
    // Default listRows returns { rows: [] }, so verifyFriendship fails.
    const res = await invoke({
      userId: CALLER,
      mockDb,
      body: {
        action: 'deliver',
        messageId: MESSAGE_ID,
        recipientId: RECIPIENT,
        content: 'hi',
      },
    });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Not friends with this user');
    expect(mockDb.upsertRow).not.toHaveBeenCalled();
  });

  // Regression: §20.3 (cross-user delivery requires an accepted friendship).
  // accepted row must not be enough.
  it('returns 403 when only the forward friendship is accepted', async () => {
    mockDb.listRows
      .mockResolvedValueOnce({ rows: [friendshipRow()] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await invoke({
      userId: CALLER,
      mockDb,
      body: {
        action: 'deliver',
        messageId: MESSAGE_ID,
        recipientId: RECIPIENT,
        content: 'hi',
      },
    });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Not friends with this user');
    expect(mockDb.upsertRow).not.toHaveBeenCalled();
  });

  // Regression: §20.4 (delivery creates the recipient-owned peer row).
  // (incoming, recipient-owned) and sender (outgoing, sender-owned).
  it('successfully delivers: recipient row first, sender row second', async () => {
    mockDb.listRows
      .mockResolvedValueOnce({ rows: [friendshipRow()] })
      .mockResolvedValueOnce({ rows: [friendshipRow()] });

    const res = await invoke({
      userId: CALLER,
      mockDb,
      body: {
        action: 'deliver',
        messageId: MESSAGE_ID,
        recipientId: RECIPIENT,
        content: 'hello',
      },
    });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.recipientRowId).toMatch(/^rmsg_[a-f0-9]{30}$/);
    expect(res.body.threadId).toMatch(/^th_[a-f0-9]{30}$/);

    expect(mockDb.upsertRow).toHaveBeenCalledTimes(2);

    const recipientCall = mockDb.upsertRow.mock.calls[0][0];
    expect(recipientCall.rowId).toBe(res.body.recipientRowId);
    expect(recipientCall.data.user_id).toBe(RECIPIENT);
    expect(recipientCall.data.sender_id).toBe(CALLER);
    expect(recipientCall.data.recipient_id).toBe(RECIPIENT);
    expect(recipientCall.data.direction).toBe('incoming');
    expect(recipientCall.data.original_message_id).toBe(MESSAGE_ID);
    expect(recipientCall.permissions).toContain(`read("user:${RECIPIENT}")`);
    expect(recipientCall.permissions).toContain(`update("user:${RECIPIENT}")`);
    expect(recipientCall.permissions).toContain(`delete("user:${RECIPIENT}")`);

    const senderCall = mockDb.upsertRow.mock.calls[1][0];
    expect(senderCall.rowId).toBe(MESSAGE_ID);
    expect(senderCall.data.user_id).toBe(CALLER);
    expect(senderCall.data.direction).toBe('outgoing');
    expect(senderCall.permissions).toContain(`read("user:${CALLER}")`);
    expect(senderCall.permissions).toContain(`update("user:${CALLER}")`);
    expect(senderCall.permissions).toContain(`delete("user:${CALLER}")`);
  });

  // Regression: §20.4 (re-delivery is idempotent).
  // the recipient row is not overwritten and the function returns 200.
  it('hijack guard: skips recipient upsert when the row already exists', async () => {
    mockDb.listRows
      .mockResolvedValueOnce({ rows: [friendshipRow()] })
      .mockResolvedValueOnce({ rows: [friendshipRow()] });

    // getRow is called for the sender row (messageId) and the recipient row.
    // Sender row: not found (default rejects with 404). Recipient row: present
    // with matching participants.
    mockDb.getRow
      .mockRejectedValueOnce(Object.assign(new Error('Not found'), { code: 404 }))
      .mockResolvedValueOnce({
        user_id: RECIPIENT,
        sender_id: CALLER,
        recipient_id: RECIPIENT,
        content: 'original content',
        direction: 'incoming',
      });

    const res = await invoke({
      userId: CALLER,
      mockDb,
      body: {
        action: 'deliver',
        messageId: MESSAGE_ID,
        recipientId: RECIPIENT,
        content: 'new content',
      },
    });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    // No upsert may target the recipient row id.
    const recipientRowId = res.body.recipientRowId as string;
    for (const call of mockDb.upsertRow.mock.calls) {
      expect(call[0].rowId).not.toBe(recipientRowId);
    }
  });
});
