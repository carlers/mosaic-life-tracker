// Regression: PROJECT_REFERENCE.md §2 — global nav inset and Account sign-out remain in content flow.
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/components/layout/BottomNav', () => ({
  BottomNav: () => <nav>Bottom nav</nav>,
}));
vi.mock('../../src/components/ui/OfflineBanner', () => ({
  OfflineBanner: () => null,
}));
vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { $id: 'user_1', name: 'User', email: 'user@example.com' },
    logout: vi.fn(),
  }),
}));
vi.mock('../../src/hooks/useTasks', () => ({ useTasks: () => ({ tasks: [] }) }));
vi.mock('../../src/hooks/useCategories', () => ({ useCategories: () => ({ categories: [] }) }));
vi.mock('../../src/components/ui/Avatar', () => ({ Avatar: () => <div>Avatar</div> }));
vi.mock('../../src/components/ui/Button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

import { MainLayout } from '../../src/components/layout/MainLayout';
import { AccountPage } from '../../src/pages/AccountPage';

describe('layout polish', () => {
  it('reserves only the bottom-nav height instead of an extra pb-24 spacer', () => {
    render(
      <MainLayout activeTab="home" onTabChange={vi.fn()}>
        <div>Page</div>
      </MainLayout>
    );
    expect(screen.getByRole('main')).not.toHaveClass('pb-24');
    expect(screen.getByTestId('primary-route-content')).toHaveClass(
      'pb-[calc(4rem+env(safe-area-inset-bottom))]'
    );
  });

  it('keeps Account logout inside the normal account scroll flow', () => {
    render(
      <MemoryRouter>
        <AccountPage />
      </MemoryRouter>
    );
    const scroll = screen.getByTestId('account-scroll');
    expect(scroll).toContainElement(screen.getByRole('button', { name: 'Logout' }));
  });

  // Regression: PROJECT_REFERENCE.md §2 — Me no longer shows a decorative quote/author block.
  it('does not render the decorative Me-page quote', () => {
    render(
      <MemoryRouter>
        <AccountPage />
      </MemoryRouter>
    );

    expect(
      screen.queryByText(/Tact is the ability to describe others/i)
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Eleanor Chaffee')).not.toBeInTheDocument();
  });
});
