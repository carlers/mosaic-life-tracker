import { beforeEach, describe, expect, it, vi } from 'vitest';

const createExecutionMock = vi.hoisted(() => vi.fn());
const getDatabaseMock = vi.hoisted(() => vi.fn());

vi.mock('../../src/lib/sdk', () => ({
  guardedFunctions: {
    createExecution: createExecutionMock,
  },
}));

vi.mock('../../src/db/database', () => ({
  getDatabase: getDatabaseMock,
}));

vi.mock('../../src/lib/connectivity', () => ({
  getConnectivitySnapshot: () => ({
    status: 'online',
    reason: 'message-delivery-test',
    lastConfirmedAt: '2026-10-03T00:00:00.000Z',
  }),
}));

vi.mock('../../src/lib/appwriteConfig', () => ({
  APPWRITE_MESSAGE_ACTION_FUNCTION_ID: 'message-action-test',
}));

function makeDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function successExecution() {
  return {
    status: 'completed',
    responseStatusCode: 200,
    responseBody: JSON.stringify({ ok: true }),
  };
}

function messageDoc(userId: string, id: string) {
  return {
    id,
    userId,
    recipientId: userId === 'user_A' ? 'user_B' : 'user_A',
    content: 'hello',
    taskRefId: '',
    taskRefTitle: '',
    taskRefDate: '',
    taskRefColor: '',
    replyToId: '',
    replyToContent: '',
    replyToSenderId: '',
    createdAt: '2026-10-03T00:00:00.000Z',
    patch: vi.fn().mockResolvedValue(undefined),
  };
}

describe('message delivery account ownership', () => {
  beforeEach(() => {
    vi.resetModules();
    createExecutionMock.mockReset();
    getDatabaseMock.mockReset();
  });

  it('stops the old owner and runs the queued current owner after an account switch', async () => {
    const accountWork = await import('../../src/lib/accountWorkScope');
    accountWork.__resetAccountWorkScopeForTests();
    accountWork.scopeAccountWork('user_A');

    const docA = messageDoc('user_A', 'msg_a');
    const docB = messageDoc('user_B', 'msg_b');
    const selectors: string[] = [];

    getDatabaseMock.mockReturnValue({
      messages: {
        find: ({ selector }: { selector: { userId: string } }) => ({
          exec: async () => {
            selectors.push(selector.userId);
            return selector.userId === 'user_A' ? [docA] : [docB];
          },
        }),
      },
    });

    const firstExecution = makeDeferred<ReturnType<typeof successExecution>>();
    createExecutionMock
      .mockImplementationOnce(() => firstExecution.promise)
      .mockResolvedValue(successExecution());

    const { deliverPendingMessages } = await import(
      '../../src/lib/messageDelivery'
    );

    const deliveryA = deliverPendingMessages('user_A');
    await vi.waitFor(() =>
      expect(createExecutionMock).toHaveBeenCalledTimes(1)
    );

    accountWork.scopeAccountWork('user_B');
    const deliveryB = deliverPendingMessages('user_B');

    firstExecution.resolve(successExecution());
    await Promise.all([deliveryA, deliveryB]);

    expect(selectors).toEqual(['user_A', 'user_B']);
    expect(docA.patch).not.toHaveBeenCalled();
    expect(docB.patch).toHaveBeenCalledWith({
      deliveryStatus: 'delivered',
    });
    expect(createExecutionMock).toHaveBeenCalledTimes(2);
  });
});
