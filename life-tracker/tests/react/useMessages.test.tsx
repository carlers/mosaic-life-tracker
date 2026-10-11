import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { RxDatabase } from 'rxdb';
import { useMessages } from '../../src/hooks/useMessages';
import { giphyStickerMessage } from '../../src/lib/giphyStickers';
import { packStickerMessage } from '../../src/lib/stickerPacks';
import {
  createTestDb,
  destroyTestDb,
  type TestDatabaseCollections,
} from '../helpers/testDb';
import type { MessageDocument } from '../../src/db/schema';
import { resetConnectivityForTests } from '../../src/lib/connectivity';

// ---------------------------------------------------------------------------
// Module mocks
//
// Vitest hoists `vi.mock` above all imports; the factory cannot reference
// outer bindings unless they were declared via `vi.hoisted`. The mutable-ref
// pattern below keeps `dbRef` alive at mock-evaluation time and lets the
// factory read `.current` lazily on every call.
//
// Same pattern as `useConversations.test.tsx` — see that file's header for
// the full rationale (§5.1 + plan Finding A).
// ---------------------------------------------------------------------------

const dbRef = vi.hoisted(() => ({ current: null as unknown }));

vi.mock('../../src/db/database', () => ({
  getDatabase: () => {
    if (!dbRef.current) throw new Error('testDb not initialized');
    return dbRef.current;
  },
}));

vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({ user: { $id: 'user_A' }, isLoading: false }),
}));

// Deterministic thread + recipient row ids so the tests do not depend on
// SHA-256 output. Both helpers are async in the source module; the mocks
// resolve immediately with stable values.
vi.mock('../../src/lib/threads', () => ({
  makeThreadId: vi.fn().mockResolvedValue('th_test'),
  makeRecipientRowId: vi.fn().mockResolvedValue('rmsg_test'),
}));

// Stub the four cross-user network entry points so no real Appwrite Function
// invocation fires. Each returns the shape the hook expects on the happy path.
vi.mock('../../src/lib/messageDelivery', () => ({
  MESSAGE_ACTION_FUNCTION_ID: 'test_fn',
  deliverPendingMessages: vi.fn().mockResolvedValue(undefined),
  markReadOnRemote: vi.fn().mockResolvedValue(undefined),
  unsendOnRemote: vi.fn().mockResolvedValue(undefined),
  reactOnRemote: vi.fn().mockResolvedValue(null),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const THREAD_ID = 'th_test';
const USER_ID = 'user_A';
const FRIEND_ID = 'user_B';

function makeMessage(overrides: Partial<MessageDocument> = {}): MessageDocument {
  const id = overrides.id ?? `msg_${Math.random().toString(36).slice(2, 12)}`;
  return {
    id,
    userId: USER_ID,
    threadId: THREAD_ID,
    senderId: USER_ID,
    recipientId: FRIEND_ID,
    direction: 'outgoing',
    content: '',
    taskRefId: '',
    taskRefTitle: '',
    taskRefDate: '',
    taskRefColor: '',
    replyToId: '',
    replyToContent: '',
    replyToSenderId: '',
    isUnsent: false,
    originalMessageId: id,
    reactions: '',
    readAt: '',
    deliveryStatus: 'delivered',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    isDeleted: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
//
// NOTE: The CONFLICT-retry path in `toggleReaction` is intentionally not
// tested here. RxDB returns the same document instance from `findOne(id).exec()`
// on subsequent calls, so a spy-based "throw once, succeed on retry" test
// couples to RxDB's internal document cache rather than to observable
// behavior. The retry logic is six lines of if/else and its correctness is
// covered indirectly by `reactionUtils.test.ts` (delta math) and the
// `react` handler tests (server-side two-phase commit).
// ---------------------------------------------------------------------------

describe('useMessages', () => {
  beforeEach(async () => {
    dbRef.current = await createTestDb('messages');
    vi.clearAllMocks();
    resetConnectivityForTests({
      status: 'online',
      reason: 'test',
      lastConfirmedAt: '2026-01-01T00:00:00.000Z',
    });
  });

  afterEach(async () => {
    if (dbRef.current) {
      await destroyTestDb(
        dbRef.current as RxDatabase<TestDatabaseCollections>
      );
      dbRef.current = null;
    }
  });

  it('send message: inserts a local row with direction outgoing, deliveryStatus pending, and the given content', async () => {
    const { result } = renderHook(() => useMessages(FRIEND_ID));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.sendMessage('hi');
    });

    await waitFor(() => expect(result.current.messages).toHaveLength(1));
    const msg = result.current.messages[0];
    expect(msg.direction).toBe('outgoing');
    expect(msg.deliveryStatus).toBe('pending');
    expect(msg.content).toBe('hi');
    expect(msg.senderId).toBe(USER_ID);
    expect(msg.recipientId).toBe(FRIEND_ID);
    expect(msg.threadId).toBe(THREAD_ID);
  });

  it('send message: whitespace-only content is rejected and no row is inserted', async () => {
    const { result } = renderHook(() => useMessages(FRIEND_ID));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.sendMessage('   ');
    });

    // Give the subscription a tick to settle. If nothing was inserted,
    // `messages` stays empty.
    await new Promise((r) => setTimeout(r, 20));
    expect(result.current.messages).toHaveLength(0);
  });

  it('send message: reply context populates replyToId/replyToSenderId and truncates replyToContent to 100 chars', async () => {
    // Regression: §20.6 (reply snapshot contract)
    const longContent = 'x'.repeat(150);
    const { result } = renderHook(() => useMessages(FRIEND_ID));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.sendMessage('reply', {
        id: 'msg_original',
        senderId: FRIEND_ID,
        content: longContent,
      });
    });

    await waitFor(() => expect(result.current.messages).toHaveLength(1));
    const msg = result.current.messages[0];
    expect(msg.replyToId).toBe('msg_original');
    expect(msg.replyToSenderId).toBe(FRIEND_ID);
    expect(msg.replyToContent).toHaveLength(100);
    expect(msg.replyToContent.endsWith('…')).toBe(true);
  });

  it.each([
    ['GIPHY', giphyStickerMessage({ id: 'gAbC123', label: 'Friendly hug' })],
    ['curated pack', packStickerMessage('critters', 'cat')],
  ])('send message: keeps %s quotes as renderable stickers after the outgoing row is inserted', async (_, content) => {
    const { result } = renderHook(() => useMessages(FRIEND_ID));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.sendMessage('Thanks', { id: 'msg_sticker', senderId: FRIEND_ID, content });
    });

    await waitFor(() => expect(result.current.messages).toHaveLength(1));
    expect(result.current.messages[0].replyToContent).toBe(content);
    expect(result.current.messages[0].replyToContent).toContain(']\\n['.replace('\\n', '\n'));
  });

  it('toggleReaction: optimistic add patches the row immediately', async () => {
    // Regression: §9 (Optimistic + Revert)
    const db = dbRef.current as RxDatabase<TestDatabaseCollections>;
    await db.messages.insert(makeMessage({ id: 'msg_1', reactions: '' }));

    const { result } = renderHook(() => useMessages(FRIEND_ID));
    await waitFor(() => expect(result.current.messages).toHaveLength(1));

    await act(async () => {
      await result.current.toggleReaction('msg_1', '❤️');
    });

    await waitFor(() => {
      const parsed = JSON.parse(result.current.messages[0].reactions);
      expect(parsed).toEqual([{ emoji: '❤️', userIds: [USER_ID] }]);
    });
  });

  it('toggleReaction: calling twice with the same emoji removes the reaction', async () => {
    // Regression: §9 (Optimistic + Revert)
    const db = dbRef.current as RxDatabase<TestDatabaseCollections>;
    await db.messages.insert(makeMessage({ id: 'msg_1', reactions: '' }));

    const { result } = renderHook(() => useMessages(FRIEND_ID));
    await waitFor(() => expect(result.current.messages).toHaveLength(1));

    await act(async () => {
      await result.current.toggleReaction('msg_1', '❤️');
    });
    await waitFor(() => {
      const parsed = JSON.parse(result.current.messages[0].reactions);
      expect(parsed).toHaveLength(1);
    });

    await act(async () => {
      await result.current.toggleReaction('msg_1', '❤️');
    });
    await waitFor(() => {
      expect(result.current.messages[0].reactions).toBe('');
    });
  });

  it('unsendMessage: sets isUnsent and clears content, task refs, and reply snapshot fields', async () => {
    const db = dbRef.current as RxDatabase<TestDatabaseCollections>;
    await db.messages.insert(
      makeMessage({
        id: 'msg_1',
        content: 'original text',
        taskRefId: 'task_1',
        taskRefTitle: 'A task',
        taskRefDate: '2026-01-01',
        taskRefColor: '#3B82F6',
        replyToId: 'msg_prev',
        replyToContent: 'quoted',
        replyToSenderId: 'user_C',
        reactions: JSON.stringify([
          { emoji: '👍', userIds: ['user_B'] },
        ]),
      })
    );

    const { result } = renderHook(() => useMessages(FRIEND_ID));
    await waitFor(() => expect(result.current.messages).toHaveLength(1));

    await act(async () => {
      await result.current.unsendMessage('msg_1');
    });

    await waitFor(() => {
      const msg = result.current.messages[0];
      expect(msg.isUnsent).toBe(true);
      expect(msg.content).toBe('');
      expect(msg.taskRefId).toBe('');
      expect(msg.taskRefTitle).toBe('');
      expect(msg.taskRefDate).toBe('');
      expect(msg.taskRefColor).toBe('');
      expect(msg.replyToId).toBe('');
      expect(msg.replyToContent).toBe('');
      expect(msg.replyToSenderId).toBe('');
      expect(msg.reactions).toBe('');
    });
  });

  it('unsendMessage: cascades to reply rows whose replyToId points at the unsent message', async () => {
    // Regression: §20.6 (unsend cascade wipes reply snapshots)
    const db = dbRef.current as RxDatabase<TestDatabaseCollections>;
    await db.messages.bulkInsert([
      makeMessage({
        id: 'msg_orig',
        content: 'the original',
        direction: 'outgoing',
      }),
      makeMessage({
        id: 'msg_reply',
        content: 'a reply',
        direction: 'incoming',
        senderId: FRIEND_ID,
        recipientId: USER_ID,
        replyToId: 'msg_orig',
        replyToContent: 'quoted text from original',
        replyToSenderId: USER_ID,
        createdAt: '2026-01-01T01:00:00.000Z',
        originalMessageId: 'msg_reply',
      }),
    ]);

    const { result } = renderHook(() => useMessages(FRIEND_ID));
    await waitFor(() => expect(result.current.messages).toHaveLength(2));

    await act(async () => {
      await result.current.unsendMessage('msg_orig');
    });

    await waitFor(() => {
      const reply = result.current.messages.find((m) => m.id === 'msg_reply');
      expect(reply).toBeDefined();
      expect(reply?.replyToContent).toBe('');
    });
  });
});
