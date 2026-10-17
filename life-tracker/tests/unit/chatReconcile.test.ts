import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
  deliver: vi.fn(), send: vi.fn(), sync: vi.fn(),
  current: vi.fn(), capture: vi.fn(), getDatabase: vi.fn(), denied: vi.fn(),
}));
vi.mock('../../src/lib/messageDelivery', () => ({
  deliverPendingMessages: mock.deliver, sendMessageAction: mock.send,
}));
vi.mock('../../src/lib/messageSendDenials', () => ({ isDeniedOutgoing: mock.denied }));
vi.mock('../../src/db/messageReplicationPilot', () => ({ refreshMessageReplicationPilot: mock.sync }));
vi.mock('../../src/lib/accountWorkScope', () => ({
  captureAccountWorkGeneration: mock.capture,
  isAccountWorkCurrent: mock.current,
}));
vi.mock('../../src/lib/connectivity', () => ({
  getConnectivitySnapshot: () => ({ status: 'online' }),
}));
vi.mock('../../src/db/database', () => ({ getDatabase: mock.getDatabase }));

import { reconcileChat } from '../../src/lib/chatReconcile';

describe('reconcileChat', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mock.capture.mockReturnValue(1);
    mock.denied.mockReturnValue(false);
    mock.current.mockReturnValue(true);
    mock.deliver.mockResolvedValue(undefined);
    mock.sync.mockResolvedValue(true);
    mock.getDatabase.mockReturnValue({
      messages: { find: () => ({ exec: async () => [] }) },
    });
    mock.send.mockResolvedValue({ ok: true, repaired: 1 });
  });

  it('runs the authorized server repair before the awaited message-only freshness barrier', async () => {
    await expect(reconcileChat('user_a', 'user_b')).resolves.toBe(1);
    expect(mock.deliver).toHaveBeenCalledWith('user_a');
    expect(mock.send).toHaveBeenCalledWith(
      { action: 'repair_thread_all', partnerId: 'user_b' }, 90_000);
    expect(mock.sync).toHaveBeenCalledWith('user_a', 60_000);
  });

  it('reports real stages including verified local receipt', async () => {
    const stages: string[] = [];
    await reconcileChat('user_a', 'user_b', ({ stage }) => stages.push(stage));
    expect(stages).toEqual(['sending', 'repairing', 'receiving', 'complete']);
    expect(mock.sync).toHaveBeenCalledTimes(1);
  });

  it('does not report chat success if message replication is inactive', async () => {
    mock.sync.mockResolvedValue(false);
    const stages: string[] = [];
    await expect(reconcileChat('user_a', 'user_b', ({ stage }) => stages.push(stage)))
      .rejects.toThrow(/not ready/);
    expect(stages).toEqual(['sending', 'repairing', 'receiving']);
  });

    it('refuses to claim success with undelivered local outgoing messages', async () => {
    mock.getDatabase.mockReturnValue({
      messages: { find: () => ({ exec: async () => [{ id: 'msg_pending' }] }) },
    });
    await expect(reconcileChat('user_a', 'user_b')).rejects.toThrow(/waiting/);
    expect(mock.send).not.toHaveBeenCalled();
    expect(mock.sync).not.toHaveBeenCalled();
  });

  it('repairs the thread while retaining a permanently denied outgoing message for explicit retry', async () => {
    mock.getDatabase.mockReturnValue({
      messages: { find: () => ({ exec: async () => [{ id: 'msg_denied' }] }) },
    });
    mock.denied.mockImplementation((_ownerId: string, messageId: string) => messageId === 'msg_denied');

    await expect(reconcileChat('user_a', 'user_b')).resolves.toBe(1);
    expect(mock.denied).toHaveBeenCalledWith('user_a', 'msg_denied');
    expect(mock.send).toHaveBeenCalledTimes(1);
    expect(mock.sync).toHaveBeenCalledTimes(1);
  });

  it('still blocks repair when an ordinary pending send coexists with a denied one', async () => {
    mock.getDatabase.mockReturnValue({
      messages: { find: () => ({ exec: async () => [
        { id: 'msg_denied' }, { id: 'msg_awaiting_ack' },
      ] }) },
    });
    mock.denied.mockImplementation((_ownerId: string, messageId: string) => messageId === 'msg_denied');

    await expect(reconcileChat('user_a', 'user_b')).rejects.toThrow(/waiting/);
    expect(mock.denied).toHaveBeenCalledWith('user_a', 'msg_awaiting_ack');
    expect(mock.send).not.toHaveBeenCalled();
    expect(mock.sync).not.toHaveBeenCalled();
  });

  it('rejects a malformed successful response', async () => {
    mock.send.mockResolvedValue({});
    await expect(reconcileChat('user_a', 'user_b')).rejects.toThrow(/incomplete/);
    expect(mock.sync).not.toHaveBeenCalled();
  });

  it('does not apply another account\'s repair completion', async () => {
    mock.current.mockReturnValueOnce(true).mockReturnValueOnce(false);
    await expect(reconcileChat('user_a', 'user_b')).rejects.toThrow(/Account changed/);
    expect(mock.sync).not.toHaveBeenCalled();
  });

  it('surfaces an unavailable freshness barrier instead of claiming a repaired chat', async () => {
    mock.sync.mockRejectedValue(new Error('Freshness timeout'));
    await expect(reconcileChat('user_a', 'user_b')).rejects.toThrow(/Freshness timeout/);
  });
});
