import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/hooks/useUnreadMessages', () => ({
  useUnreadMessages: () => ({ totalUnread: 0, isLoading: false }),
}));

import { BottomNav } from '../../src/components/layout/BottomNav';

describe('BottomNav performance contract', () => {
  // Regression: PROJECT_REFERENCE.md §16 — the shell indicator stays animated without a Framer controller.
  it('moves one persistent active-tab indicator across the five tab slots', () => {
    const { rerender } = render(
      <BottomNav activeTab="home" onTabChange={vi.fn()} />
    );

    const indicator = screen.getByTestId('active-tab-indicator');
    expect(indicator).toHaveStyle({ transform: 'translateX(0%)' });

    rerender(<BottomNav activeTab="account" onTabChange={vi.fn()} />);

    expect(screen.getByTestId('active-tab-indicator')).toBe(indicator);
    expect(indicator).toHaveStyle({ transform: 'translateX(400%)' });
  });
});
