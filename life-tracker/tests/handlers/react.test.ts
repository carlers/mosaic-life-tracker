import { describe, it, expect, beforeEach } from 'vitest';
import { invoke, makeMockDb, type MockDb } from '../helpers/invoke-handler';

const CALLER = 'user_a';
const RECIPIENT = 'user_b';
const MY_ROW_ID = 'msg_test_1';
const PEER_ROW_ID = 'rmsg_0123456789abcdefghijklmnopqrst';

const friendshipRow = () => ({ $id: 'fr_test' });

// A single userId long enough that JSON.stringify of the entry exceeds
// REACTIONS_MAX_LEN (5000) as soon as a second user is added.
const HUGE_USER_ID = 'x'.repeat(5100);
const HUGE_REACTIONS = JSON.stringify([
  { emoji: '👍', userIds: [HUGE_USER_ID] },
]);

describe('message-action / react', () => {
  let mockDb: MockDb;

  beforeEach(() => {
    mockDb = makeMockDb();
  });

  it('returns 400 when myRowId is missing', async () => {
    const res = await invoke({
      userId: CALLER,
      mockDb,
      body: {
        action: 'react',
        recipientId: RECIPIENT,
        emoji: '👍',
        op: 'add',
      },
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid myRowId');
  });

  it('returns 400 when recipientId is missing', async () => {
    const res = await invoke({
      userId: CALLER,
      mockDb,
      body: {
        action: 'react',
        myRowId: MY_ROW_ID,
        emoji: '👍',
        op: 'add',
      },
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid recipientId');
  });

  // Regression: §20.7 (message reactions validate emoji input).
  it('returns 400 for an empty emoji', async () => {
    const res = await invoke({
      userId: CALLER,
      mockDb,
      body: {
        action: 'react',
        myRowId: MY_ROW_ID,
        recipientId: RECIPIENT,
        emoji: '',
        op: 'add',
      },
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid emoji');
  });

  it('returns 400 for a whitespace-only emoji', async () => {
    const res = await invoke({
      userId: CALLER,
      mockDb,
      body: {
        action: 'react',
        myRowId: MY_ROW_ID,
        recipientId: RECIPIENT,
        emoji: '   ',
        op: 'add',
      },
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid emoji');
  });

  it('returns 400 for an emoji longer than 16 graphemes', async () => {
    const res = await invoke({
      userId: CALLER,
      mockDb,
      body: {
        action: 'react',
        myRowId: MY_ROW_ID,
        recipientId: RECIPIENT,
        emoji: 'a'.repeat(17),
        op: 'add',
      },
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid emoji');
  });

  it('returns 400 for an invalid op', async () => {
    const res = await invoke({
      userId: CALLER,
      mockDb,
      body: {
        action: 'react',
        myRowId: MY_ROW_ID,
        recipientId: RECIPIENT,
        emoji: '👍',
        op: 'toggle',
      },
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid op');
  });

  it('returns 400 when caller reacts to themselves', async () => {
    const res = await invoke({
      userId: CALLER,
      mockDb,
      body: {
        action: 'react',
        myRowId: MY_ROW_ID,
        recipientId: CALLER,
        emoji: '👍',
        op: 'add',
      },
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Cannot react to yourself');
  });

  it('returns 403 when the caller is not friends with the recipient', async () => {
    const res = await invoke({
      userId: CALLER,
      mockDb,
      body: {
        action: 'react',
        myRowId: MY_ROW_ID,
        peerRowId: PEER_ROW_ID,
        recipientId: RECIPIENT,
        emoji: '👍',
        op: 'add',
      },
    });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Not friends with this user');
  });

  // Regression: §18/§20.7 (reaction validation completes before either row is written).
  // before Pass B writes. If the second row would overflow, no write may
  // happen at all.
  it('two-phase: overflow on the second row prevents any write', async () => {
    mockDb.listRows
      .mockResolvedValueOnce({ rows: [friendshipRow()] })
      .mockResolvedValueOnce({ rows: [friendshipRow()] });

    const row = {
      sender_id: CALLER,
      recipient_id: RECIPIENT,
      direction: 'outgoing',
      reactions: '',
    };
    const hugeRow = {
      sender_id: CALLER,
      recipient_id: RECIPIENT,
      direction: 'outgoing',
      reactions: HUGE_REACTIONS,
    };

    // 1. getRow for legacy-resolution branch (myRowId).
    // 2. getRow for Pass A of myRowId.
    // 3. getRow for Pass A of peerRowId (overflow).
    mockDb.getRow
      .mockResolvedValueOnce(row)
      .mockResolvedValueOnce(row)
      .mockResolvedValueOnce(hugeRow);

    const res = await invoke({
      userId: CALLER,
      mockDb,
      body: {
        action: 'react',
        myRowId: MY_ROW_ID,
        peerRowId: PEER_ROW_ID,
        recipientId: RECIPIENT,
        emoji: '❤️',
        op: 'add',
      },
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Too many reactions');
    expect(mockDb.updateRow).not.toHaveBeenCalled();
  });

  // Regression: §20.7 (message reactions patch both participant rows).
  it('successful: patches both rows with the new reactions JSON', async () => {
    mockDb.listRows
      .mockResolvedValueOnce({ rows: [friendshipRow()] })
      .mockResolvedValueOnce({ rows: [friendshipRow()] });

    const row = {
      sender_id: CALLER,
      recipient_id: RECIPIENT,
      direction: 'outgoing',
      reactions: '',
    };

    mockDb.getRow
      .mockResolvedValueOnce(row)
      .mockResolvedValueOnce(row)
      .mockResolvedValueOnce(row);

    const res = await invoke({
      userId: CALLER,
      mockDb,
      body: {
        action: 'react',
        myRowId: MY_ROW_ID,
        peerRowId: PEER_ROW_ID,
        recipientId: RECIPIENT,
        emoji: '👍',
        op: 'add',
      },
    });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.updated).toBe(2);

    expect(mockDb.updateRow).toHaveBeenCalledTimes(2);
    const expected = JSON.stringify([
      { emoji: '👍', userIds: [CALLER] },
    ]);
    expect(mockDb.updateRow.mock.calls[0][0].data.reactions).toBe(expected);
    expect(mockDb.updateRow.mock.calls[1][0].data.reactions).toBe(expected);
  });
});
