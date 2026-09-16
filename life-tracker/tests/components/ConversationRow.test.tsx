import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConversationRow } from '../../src/components/messages/ConversationRow';
import type { Conversation } from '../../src/hooks/useConversations';
import type {
  FriendshipDocument,
  MessageDocument,
} from '../../src/db/schema';
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));
const useTaskImageSpy = vi.hoisted(() =>
  vi.fn(() => ({ imageUrl: null, isLoading: false }))
);
vi.mock('../../src/hooks/useTaskImage', () => ({
  useTaskImage: useTaskImageSpy,
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
beforeEach(() => {
  useTaskImageSpy.mockClear();
});
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
  it('does not re-render on semantically-equal props (regression: F5)', () => {
    const friend = makeFriend();
    const lastMessage = makeMessage({ id: 'msg_1', content: 'hello' });
    const first: Conversation = {
      threadId: 'th_test',
      friend,
      lastMessage,
      unreadCount: 0,
    };
    const second: Conversation = {
      threadId: 'th_test',
      friend: { ...friend },
      lastMessage: { ...lastMessage },
      unreadCount: 0,
    };
    const { rerender } = render(
      <ConversationRow conversation={first} />
    );
    expect(useTaskImageSpy).toHaveBeenCalledTimes(1);
    rerender(<ConversationRow conversation={second} />);
    expect(useTaskImageSpy).toHaveBeenCalledTimes(1);
  });
  it('re-renders when unreadCount changes (regression: F5)', () => {
    const first = makeConversation({ unreadCount: 0 });
    const second = makeConversation({ unreadCount: 2 });
    const { rerender } = render(
      <ConversationRow conversation={first} />
    );
    expect(useTaskImageSpy).toHaveBeenCalledTimes(1);
    rerender(<ConversationRow conversation={second} />);
    expect(useTaskImageSpy).toHaveBeenCalledTimes(2);
  });
  it('re-renders when lastMessage id changes (regression: F5)', () => {
    const first = makeConversation({
      lastMessage: makeMessage({ id: 'msg_1', content: 'hello' }),
    });
    const second = makeConversation({
      lastMessage: makeMessage({ id: 'msg_2', content: 'hello' }),
    });
    const { rerender } = render(
      <ConversationRow conversation={first} />
    );
    expect(useTaskImageSpy).toHaveBeenCalledTimes(1);
    rerender(<ConversationRow conversation={second} />);
    expect(useTaskImageSpy).toHaveBeenCalledTimes(2);
  });
});
