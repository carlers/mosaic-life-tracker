import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConversationRow } from '../../src/components/messages/ConversationRow';
import type { Conversation } from '../../src/hooks/useConversations';
import type {
  FriendshipDocument,
  MessageDocument,
} from '../../src/db/schema';

// ---------------------------------------------------------------------------
// ConversationRow component tests (Layer 5).
//
// Pins the observable contracts:
//   - Display name renders when set; falls back to friendUsername when empty.
//   - Preview text branches four ways (no message, content, taskRefTitle,
//     neither).
//   - Unread badge shows count when unreadCount > 0.
//   - "You: " prefix renders when lastMessage.direction === 'outgoing'.
//
// Deliberately NOT tested here:
//   - Navigation. useNavigate is mocked; we do not assert on the target URL.
//   - Avatar loading. lib/storage is mocked to return null; imageUrl stays
//     null and the Avatar renders its initial-letter fallback.
//   - Class strings on the unread badge or preview text.
//   - A `@username` line. ConversationRow does NOT render one (unlike
//     FriendRow and UserResultCard, which do). The `||` fallback is the
//     only place friendUsername surfaces.
// ---------------------------------------------------------------------------

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

const mockGetLocalImageUrl = vi.hoisted(() =>
  vi.fn().mockResolvedValue(null)
);
vi.mock('../../src/lib/storage', () => ({
  getLocalImageUrl: mockGetLocalImageUrl,
}));

function makeFriend(): FriendshipDocument {
  return {
    id: 'fr_1',
    userId: 'user_A',
    friendId: 'user_B',
    friendUsername: 'b',
    friendDisplayName: 'Friend B',
    friendAvatarFileId: '',
    friendBio: '',
    status: 'accepted',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    isDeleted: false,
  };
}

function makeMessage(
  overrides: Partial<MessageDocument> = {}
): MessageDocument {
  const id = overrides.id ?? 'msg_1';
  return {
    id,
    userId: 'user_A',
    threadId: 'th_test',
    senderId: 'user_A',
    recipientId: 'user_B',
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

function makeConversation(
  overrides: Partial<Conversation> = {}
): Conversation {
  return {
    threadId: 'th_test',
    friend: makeFriend(),
    lastMessage: null,
    unreadCount: 0,
    ...overrides,
  };
}

describe('ConversationRow', () => {
  it('renders friend display name when set', () => {
    render(<ConversationRow conversation={makeConversation()} />);
    expect(screen.getByText('Friend B')).toBeInTheDocument();
  });

  it('falls back to friendUsername when display name is empty', () => {
    render(
      <ConversationRow
        conversation={makeConversation({
          friend: { ...makeFriend(), friendDisplayName: '' },
        })}
      />
    );
    // The `<p>{friendDisplayName || friendUsername}</p>` fallback renders
    // the bare username — no `@` prefix. Case-sensitive match on 'b' does
    // not collide with the Avatar's initial-letter fallback ('B').
    expect(screen.getByText('b')).toBeInTheDocument();
  });

  it('preview: no last message shows "Tap to start chatting"', () => {
    render(<ConversationRow conversation={makeConversation()} />);
    expect(screen.getByText('Tap to start chatting')).toBeInTheDocument();
  });

  it('preview: message content wins over taskRefTitle', () => {
    render(
      <ConversationRow
        conversation={makeConversation({
          lastMessage: makeMessage({
            content: 'hello there',
            taskRefTitle: 'A task',
          }),
        })}
      />
    );
    expect(screen.getByText('hello there')).toBeInTheDocument();
    expect(screen.queryByText('Re: A task')).toBeNull();
  });

  it('preview: taskRefTitle with no content shows "Re: <title>"', () => {
    render(
      <ConversationRow
        conversation={makeConversation({
          lastMessage: makeMessage({
            content: '',
            taskRefTitle: 'Buy groceries',
          }),
        })}
      />
    );
    expect(screen.getByText('Re: Buy groceries')).toBeInTheDocument();
  });

  it('preview: neither content nor taskRefTitle shows "(empty)"', () => {
    render(
      <ConversationRow
        conversation={makeConversation({
          lastMessage: makeMessage({ content: '', taskRefTitle: '' }),
        })}
      />
    );
    expect(screen.getByText('(empty)')).toBeInTheDocument();
  });

  it('unread badge shows count when unreadCount > 0', () => {
    render(
      <ConversationRow
        conversation={makeConversation({ unreadCount: 3 })}
      />
    );
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('"You: " prefix renders when lastMessage is outgoing', () => {
    render(
      <ConversationRow
        conversation={makeConversation({
          lastMessage: makeMessage({
            direction: 'outgoing',
            content: 'my reply',
          }),
        })}
      />
    );
    expect(screen.getByText('You:')).toBeInTheDocument();
    expect(screen.getByText('my reply')).toBeInTheDocument();
  });
});
