import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
  deliver: vi.fn(), send: vi.fn(), sync: vi.fn(),
  current: vi.fn(), capture: vi.fn(), getDatabase: vi.fn(),
}));
vi.mock('../../src/lib/messageDelivery', () => ({
  deliverPendingMessages: mock.deliver, sendMessageAction: mock.send,
}));
vi.mock('../../src/db/sync', () => ({ syncNow: mock.sync }));
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
    mock.current.mockReturnValue(true);
    mock.deliver.mockResolvedValue(undefined);
    mock.sync.mockResolvedValue({});
    mock.getDatabase.mockReturnValue({
      messages: { find: () => ({ exec: async () => [] }) },
    });
    mock.send.mockImplementation(async ({ scope }: { scope: string }) =>
      scope === 'self'
        ? { ok: true, checked: 1, repaired: 1, nextScope: 'peer', nextCursor: '' }
        : { ok: true, checked: 1, repaired: 0, nextScope: 'done', nextCursor: '' }
    );
  });

  it('repairs both owners then awaits a full freshness barrier', async () => {
    await expect(reconcileChat('user_a', 'user_b')).resolves.toBe(1);
    expect(mock.deliver).toHaveBeenCalledWith('user_a');
    expect(mock.send).toHaveBeenCalledTimes(2);
    expect(mock.send).toHaveBeenNthCalledWith(2,
      { action: 'repair_thread', partnerId: 'user_b', scope: 'peer', cursor: '' });
    expect(mock.sync).toHaveBeenCalledWith('user_a');
  });

  it('refuses to claim success with undelivered local outgoing messages', async () => {
    mock.getDatabase.mockReturnValue({
      messages: { find: () => ({ exec: async () => [{ id: 'msg_pending' }] }) },
    });
    await expect(reconcileChat('user_a', 'user_b')).rejects.toThrow(/waiting/);
    expect(mock.send).not.toHaveBeenCalled();
    expect(mock.sync).not.toHaveBeenCalled();
  });

  it('fails closed on stale server cursors and invalid success payloads', async () => {
    mock.send.mockResolvedValue({ ok: true, nextScope: 'self', nextCursor: '' });
    await expect(reconcileChat('user_a', 'user_b')).rejects.toThrow(/incomplete/);
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
