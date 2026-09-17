import { createPersistentOutbox } from './outbox';

export interface MessageActionSender {
  (payload: Record<string, unknown>): Promise<Record<string, unknown>>;
}

export interface MessageActionQueuedEntry {
  id: string;
  userId: string;
  action: string;
  payload: Record<string, unknown>;
  attempts: number;
  enqueuedAt: string;
}

const outbox = createPersistentOutbox<
  Record<string, unknown>,
  Record<string, unknown>,
  MessageActionQueuedEntry
>({
  storageKey: 'mosaic_message_action_queue',
  logPrefix: '[MessageActionQueue]',
  makeEntry: (input, previousAttempts) => ({
    id: input.dedupKey,
    userId: input.userId,
    action: input.action,
    payload: input.payload,
    attempts: previousAttempts,
    enqueuedAt: new Date().toISOString(),
  }),
  parseEntry: (raw) => {
    if (
      !!raw &&
      typeof raw === 'object' &&
      typeof (raw as MessageActionQueuedEntry).id === 'string' &&
      typeof (raw as MessageActionQueuedEntry).userId === 'string' &&
      typeof (raw as MessageActionQueuedEntry).action === 'string' &&
      typeof (raw as MessageActionQueuedEntry).attempts === 'number' &&
      typeof (raw as MessageActionQueuedEntry).enqueuedAt === 'string' &&
      typeof (raw as MessageActionQueuedEntry).payload === 'object'
    ) {
      return raw as MessageActionQueuedEntry;
    }
    return null;
  },
  send: async (input) => {
    await sender?.(input);
  },
  toSendInput: (entry) => ({ action: entry.action, ...entry.payload }),
});

let sender: MessageActionSender | null = null;

outbox.setSender(async (entry) => {
  if (!sender) {
    throw new Error('Message action sender not configured');
  }
  await sender({ action: entry.action, ...entry.payload });
});

export function setMessageActionSender(fn: MessageActionSender): void {
  sender = fn;
}

export function enqueueMessageAction(
  userId: string,
  input: {
    action: string;
    payload: Record<string, unknown>;
    dedupKey: string;
  }
): void {
  outbox.enqueue(userId, input);
}

export async function flushMessageActionQueue(userId: string): Promise<void> {
  if (!sender) return;
  await outbox.flush(userId);
}

export function clearMessageActionQueue(userId?: string): void {
  outbox.clear(userId);
}

export function getMessageActionQueueSize(userId?: string): number {
  return outbox.size(userId);
}

export function __resetQueueForTests(): void {
  outbox.resetForTests();
  sender = null;
}
