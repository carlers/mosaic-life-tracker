// Regression: UIFIX-12 — chat content must not expose a horizontal scrollbar above the composer.
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/hooks/useMessages', () => ({
  useMessages: () => ({
    messages: [],
    isLoading: false,
    sendMessage: vi.fn(),
    markAllRead: vi.fn(),
    unsendMessage: vi.fn(),
    toggleReaction: vi.fn(),
  }),
}));

vi.mock('../../src/hooks/useFriends', () => ({
  useFriends: () => ({ friends: [] }),
}));

vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({ user: { $id: 'user_1' } }),
}));

vi.mock('../../src/components/messages/useChatScroll', () => ({
  useChatScroll: () => ({
    scrollRef: { current: null },
    showScrollButton: false,
    hasUnreadBelow: false,
    scrollToBottom: vi.fn(),
  }),
}));

vi.mock('../../src/components/messages/useChatSearch', () => ({
  useChatSearch: () => ({
    isSearching: false,
    searchQuery: '',
    openSearch: vi.fn(),
    closeSearch: vi.fn(),
    setSearchQuery: vi.fn(),
  }),
}));

vi.mock('../../src/components/messages/useChatReactions', () => ({
  useChatReactions: () => ({ reactToMessage: vi.fn() }),
}));

vi.mock('../../src/db/sync', () => ({
  forceSync: vi.fn(),
}));

vi.mock('../../src/components/ui/DeferredAvatar', () => ({
  DeferredAvatar: () => <div data-testid="avatar" />,
}));

vi.mock('../../src/components/messages/ScrollToBottomButton', () => ({
  ScrollToBottomButton: () => null,
}));

vi.mock('../../src/components/messages/MessageActionSheet', () => ({
  MessageActionSheet: () => null,
}));

vi.mock('../../src/components/messages/EmojiPickerSheet', () => ({
  EmojiPickerSheet: () => null,
}));

vi.mock('../../src/components/ui/BottomSheet', () => ({
  BottomSheet: () => null,
}));

import { ChatPage } from '../../src/pages/ChatPage';

describe('ChatPage overflow layout', () => {
  it('clips horizontal overflow in the message scroller while preserving vertical scrolling', () => {
    render(
      <MemoryRouter initialEntries={['/messages/friend_1']}>
        <Routes>
          <Route path="/messages/:friendId" element={<ChatPage />} />
        </Routes>
      </MemoryRouter>
    );

    const emptyState = screen.getByText('No messages yet');
    const scroller = emptyState.closest('.overflow-y-auto');
    expect(scroller).not.toBeNull();
    expect(scroller).toHaveClass('overflow-x-hidden', 'min-w-0');
  });
});
