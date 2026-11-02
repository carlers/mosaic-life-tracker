import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
const social = vi.hoisted(() => ({ enabled: true }));
vi.mock('../../src/hooks/useFeatureEnabled', () => ({
  useFeatureEnabled: () => social.enabled,
}));
vi.mock('../../src/hooks/useUnreadMessages', () => ({
  useUnreadMessages: () => ({ totalUnread: 3 }),
}));
vi.mock('../../src/hooks/useSharedTasks', () => ({
  useSharedTasks: () => ({ items: [{ status: 'pending' }] }),
}));
import { BottomNav } from '../../src/components/layout/BottomNav';

describe('global social-off operator navigation', () => {
  it('shows only Home and Me when paused, restoring all routes without changing selection', () => {
    social.enabled = false;
    const onTabChange = vi.fn();
    const { rerender } = render(<BottomNav activeTab="home" onTabChange={onTabChange} />);
    expect(screen.getAllByRole('button').map(button => button.getAttribute('aria-label'))).toEqual(['Home', 'Me']);
    fireEvent.click(screen.getByRole('button', { name: 'Me' }));
    expect(onTabChange).toHaveBeenCalledWith('account');
    social.enabled = true;
    rerender(<BottomNav activeTab="home" onTabChange={onTabChange} />);
    expect(screen.getByRole('button', { name: 'Explore' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Alerts/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Chat/ })).toBeInTheDocument();
  });
});
