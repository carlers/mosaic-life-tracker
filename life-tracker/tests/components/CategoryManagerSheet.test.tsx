import type React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CategoryDocument } from '../../src/db/schema';

const mocks = vi.hoisted(() => ({
  addCategory: vi.fn().mockResolvedValue(undefined),
  updateCategory: vi.fn().mockResolvedValue(undefined),
  deleteCategory: vi.fn().mockResolvedValue(undefined),
  reorderCategories: vi.fn().mockResolvedValue(undefined),
  startDrag: vi.fn(),
}));

const categories: CategoryDocument[] = [
  {
    id: 'first',
    name: 'First',
    color: '#111111',
    icon: '',
    order: 0,
    visibility: 'private',
    userId: 'user',
    isDeleted: false,
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'second',
    name: 'Second',
    color: '#222222',
    icon: '',
    order: 1,
    visibility: 'public',
    userId: 'user',
    isDeleted: false,
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

vi.mock('../../src/hooks/useCategories', () => ({
  useCategories: () => ({
    categories,
    addCategory: mocks.addCategory,
    updateCategory: mocks.updateCategory,
    deleteCategory: mocks.deleteCategory,
    reorderCategories: mocks.reorderCategories,
  }),
}));

vi.mock('../../src/hooks/useTasks', () => ({
  useTasks: () => ({ tasks: [] }),
}));

vi.mock('../../src/components/ui/BottomSheet', () => ({
  BottomSheet: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));

vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return {
    ...actual,
    Reorder: {
      Group: ({ children, onReorder }: React.PropsWithChildren<{
        onReorder: (items: CategoryDocument[]) => void;
      }>) => (
        <div data-testid="category-order">
          {children}
          <button onClick={() => onReorder([...categories].reverse())}>
            Simulate reorder
          </button>
        </div>
      ),
      Item: ({ children, onDragEnd }: React.PropsWithChildren<{
        onDragEnd: () => void;
      }>) => (
        <div>
          {children}
          <button onClick={onDragEnd}>Simulate drag end</button>
        </div>
      ),
    },
    useDragControls: () => ({ start: mocks.startDrag }),
  };
});

import { CategoryManagerSheet } from '../../src/components/modals/CategoryManagerSheet';

describe('CategoryManagerSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts reordering only from the category grip button', () => {
    render(<CategoryManagerSheet isOpen onClose={vi.fn()} />);

    const grips = screen.getAllByRole('button', { name: 'Drag to reorder' });
    expect(grips[0]).toHaveAttribute('type', 'button');

    fireEvent.pointerDown(grips[0]);
    expect(mocks.startDrag).toHaveBeenCalledTimes(1);
  });

  it('keeps the dragged order visible while persisting it', () => {
    render(<CategoryManagerSheet isOpen onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Simulate reorder' }));

    const order = within(screen.getByTestId('category-order'))
      .getAllByText(/^(First|Second)$/)
      .map((label) => label.textContent);
    expect(order).toEqual(['Second', 'First']);
    expect(mocks.reorderCategories).not.toHaveBeenCalled();

    fireEvent.click(screen.getAllByRole('button', { name: 'Simulate drag end' })[0]);
    expect(mocks.reorderCategories).toHaveBeenCalledWith([...categories].reverse());
  });

  it('creates a category with the selected visibility', async () => {
    render(<CategoryManagerSheet isOpen onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Add Category' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), {
      target: { value: 'Shared' },
    });

    const visibility = screen.getByRole('group', { name: 'Visibility' });
    fireEvent.click(within(visibility).getByRole('button', { name: /Public/ }));

    expect(
      within(visibility).getByRole('button', { name: /Public/ })
    ).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Add Category' }));

    await waitFor(() =>
      expect(mocks.addCategory).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Shared',
          visibility: 'public',
        })
      )
    );
  });

  it('loads the existing visibility when editing a category', () => {
    render(<CategoryManagerSheet isOpen onClose={vi.fn()} />);

    fireEvent.click(
      screen.getAllByRole('button', { name: 'Edit category' })[1]
    );

    const visibility = screen.getByRole('group', { name: 'Visibility' });
    expect(
      within(visibility).getByRole('button', { name: /Public/ })
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      within(visibility).getByRole('button', { name: /Private/ })
    ).toHaveAttribute('aria-pressed', 'false');
  });

  it('updates a category with the selected visibility', async () => {
    render(<CategoryManagerSheet isOpen onClose={vi.fn()} />);

    fireEvent.click(
      screen.getAllByRole('button', { name: 'Edit category' })[0]
    );

    const visibility = screen.getByRole('group', { name: 'Visibility' });
    fireEvent.click(within(visibility).getByRole('button', { name: /Friends/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() =>
      expect(mocks.updateCategory).toHaveBeenCalledWith('first', {
        name: 'First',
        visibility: 'followers',
      })
    );
  });

  it('resets an unsaved new-category visibility selection after cancel', () => {
    render(<CategoryManagerSheet isOpen onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Add Category' }));
    let visibility = screen.getByRole('group', { name: 'Visibility' });
    fireEvent.click(within(visibility).getByRole('button', { name: /Public/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    fireEvent.click(screen.getByRole('button', { name: 'Add Category' }));
    visibility = screen.getByRole('group', { name: 'Visibility' });

    expect(
      within(visibility).getByRole('button', { name: /Private/ })
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      within(visibility).getByRole('button', { name: /Public/ })
    ).toHaveAttribute('aria-pressed', 'false');
    expect(mocks.addCategory).not.toHaveBeenCalled();
  });
});
