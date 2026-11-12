import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  labelPreference: undefined as unknown,
  onTabChange: vi.fn(),
}));

vi.mock('../../src/hooks/useSettings', () => ({
  useSettings: () => ({
    getSetting: (key: string) => key === 'showBottomNavLabels' ? mocks.labelPreference : undefined,
  }),
}));
vi.mock('../../src/hooks/useFeatureEnabled', () => ({
  useFeatureEnabled: () => true,
}));
vi.mock('../../src/hooks/useUnreadMessages', () => ({
  useUnreadMessages: () => ({ totalUnread: 12 }),
}));
vi.mock('../../src/hooks/useSharedTasks', () => ({
  useSharedTasks: () => ({
    items: [{ status: 'pending' }, { status: 'pending' }],
  }),
}));

import { BottomNav } from '../../src/components/layout/BottomNav';

describe('BottomNav label preference', () => {
  beforeEach(() => {
    mocks.labelPreference = undefined;
    mocks.onTabChange.mockClear();
  });

  it('keeps current icon-and-name navigation by default', () => {
    render(<BottomNav activeTab="home" onTabChange={mocks.onTabChange} />);
    const home = screen.getByRole('button', { name: 'Home' });
    expect(within(home).getByText('Home')).toBeInTheDocument();
    expect(home).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Chat, 12 unread' })).toHaveTextContent('9+');
  });

  it('hides only visual labels and retains accessible tab names, badges and navigation', () => {
    mocks.labelPreference = false;
    const { rerender } = render(<BottomNav activeTab="home" onTabChange={mocks.onTabChange} />);
    const home = screen.getByRole('button', { name: 'Home' });
    const chat = screen.getByRole('button', { name: 'Chat, 12 unread' });
    const alerts = screen.getByRole('button', { name: 'Alerts, 2 task invitations' });
    expect(within(home).queryByText('Home')).toBeNull();
    expect(within(chat).queryByText('Chat')).toBeNull();
    expect(chat).toHaveTextContent('9+');
    expect(alerts).toHaveTextContent('2');
    fireEvent.click(chat);
    expect(mocks.onTabChange).toHaveBeenCalledWith('messages');

    mocks.labelPreference = true;
    rerender(<BottomNav activeTab="messages" onTabChange={mocks.onTabChange} />);
    expect(within(screen.getByRole('button', { name: 'Chat, 12 unread' })).getByText('Chat')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Chat, 12 unread' })).toHaveAttribute('aria-current', 'page');
  });

  it('treats invalid stored values as the previous labeled layout', () => {
    mocks.labelPreference = 'false';
    render(<BottomNav activeTab="home" onTabChange={mocks.onTabChange} />);
    expect(within(screen.getByRole('button', { name: 'Me' })).getByText('Me')).toBeInTheDocument();
  });
});
