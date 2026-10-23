import type React from 'react';
import {
  act,
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

let visibleCategories = categories;

vi.mock('../../src/hooks/useCategories', () => ({
  useCategories: () => ({
    categories: visibleCategories,
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
        <div role="list" data-testid="category-order">
          {children}
          <button onClick={() => onReorder([...categories].reverse())}>
            Simulate reorder
          </button>
        </div>
      ),
      Item: ({ children, onDragEnd, 'aria-label': label }: React.PropsWithChildren<{
        onDragEnd: () => void;
        'aria-label'?: string;
      }>) => (
        <div role="listitem" aria-label={label}>
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
    mocks.addCategory.mockReset().mockResolvedValue(undefined);
    mocks.updateCategory.mockReset().mockResolvedValue(undefined);
    mocks.deleteCategory.mockReset().mockResolvedValue(undefined);
    mocks.reorderCategories.mockReset().mockResolvedValue(undefined);
    visibleCategories = categories;
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

  it('reverses the displayed category order and restores it on a second click', async () => {
    render(<CategoryManagerSheet isOpen onClose={vi.fn()} />);
    const reverse = screen.getByRole('button', { name: 'Reverse order' });

    fireEvent.click(reverse);
    await waitFor(() =>
      expect(mocks.reorderCategories).toHaveBeenLastCalledWith([...categories].reverse())
    );
    await waitFor(() => expect(reverse).toBeEnabled());
    expect(within(screen.getByTestId('category-order'))
      .getAllByText(/^(First|Second)$/)
      .map((label) => label.textContent)).toEqual(['Second', 'First']);

    fireEvent.click(reverse);
    await waitFor(() => expect(mocks.reorderCategories).toHaveBeenLastCalledWith(categories));
    await waitFor(() => expect(reverse).toBeEnabled());
    expect(within(screen.getByTestId('category-order'))
      .getAllByText(/^(First|Second)$/)
      .map((label) => label.textContent)).toEqual(['First', 'Second']);
  });

  it('reverses the current manual drag order, not the initial stored order', async () => {
    render(<CategoryManagerSheet isOpen onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Simulate reorder' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Simulate drag end' })[0]);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Reverse order' })).toBeEnabled());

    fireEvent.click(screen.getByRole('button', { name: 'Reverse order' }));
    await waitFor(() => expect(mocks.reorderCategories).toHaveBeenLastCalledWith(categories));
  });

  it('disables reverse with fewer than two categories', () => {
    visibleCategories = categories.slice(0, 1);
    const { unmount } = render(<CategoryManagerSheet isOpen onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Reverse order' })).toBeDisabled();
    unmount();

    visibleCategories = [];
    render(<CategoryManagerSheet isOpen onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Reverse order' })).toBeDisabled();
    expect(mocks.reorderCategories).not.toHaveBeenCalled();
  });

  it('blocks repeated reverse clicks until the previous order saves', async () => {
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => { finish = resolve; });
    mocks.reorderCategories.mockReturnValueOnce(pending);
    render(<CategoryManagerSheet isOpen onClose={vi.fn()} />);
    const reverse = screen.getByRole('button', { name: 'Reverse order' });

    act(() => {
      fireEvent.click(reverse);
      fireEvent.click(reverse);
    });
    expect(mocks.reorderCategories).toHaveBeenCalledTimes(1);
    expect(reverse).toBeDisabled();

    await act(async () => { finish(); await pending; });
    await waitFor(() => expect(reverse).toBeEnabled());
  });

  it('reports a rejected reversal and allows retry without displaying a false order', async () => {
    mocks.reorderCategories.mockRejectedValueOnce(new Error('database write failed'));
    render(<CategoryManagerSheet isOpen onClose={vi.fn()} />);
    const reverse = screen.getByRole('button', { name: 'Reverse order' });
    fireEvent.click(reverse);

    await screen.findByRole('alert');
    expect(screen.getByRole('alert')).toHaveTextContent(/could not reverse category order/i);
    expect(within(screen.getByTestId('category-order'))
      .getAllByText(/^(First|Second)$/)
      .map((label) => label.textContent)).toEqual(['First', 'Second']);

    fireEvent.click(reverse);
    await waitFor(() => expect(mocks.reorderCategories).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(within(screen.getByTestId('category-order'))
      .getAllByText(/^(First|Second)$/)
      .map((label) => label.textContent)).toEqual(['Second', 'First']);
  });

  it('keeps inline editing attached to its category after reversing', async () => {
    render(<CategoryManagerSheet isOpen onClose={vi.fn()} />);
    const first = screen.getByRole('listitem', { name: 'First category' });
    fireEvent.click(within(first).getByRole('button', { name: 'Edit category' }));
    expect(within(first).getByRole('textbox', { name: 'Name' })).toHaveValue('First');

    fireEvent.click(screen.getByRole('button', { name: 'Reverse order' }));
    await waitFor(() => expect(mocks.reorderCategories).toHaveBeenCalledWith([...categories].reverse()));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Reverse order' })).toBeEnabled());

    expect(within(first).getByRole('textbox', { name: 'Name' })).toHaveValue('First');
    expect(screen.getAllByRole('textbox', { name: 'Name' })).toHaveLength(1);
    expect(mocks.updateCategory).not.toHaveBeenCalled();
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

  it('shows the editor inside only the selected category, including after switching and reordering', () => {
    render(<CategoryManagerSheet isOpen onClose={vi.fn()} />);

    const first = screen.getByRole('listitem', { name: 'First category' });
    const second = screen.getByRole('listitem', { name: 'Second category' });
    fireEvent.click(within(first).getByRole('button', { name: 'Edit category' }));

    expect(within(first).getByRole('textbox', { name: 'Name' })).toHaveValue('First');
    expect(within(first).getByRole('button', { name: 'Edit category' }))
      .toHaveAttribute('aria-expanded', 'true');
    expect(within(second).queryByRole('textbox', { name: 'Name' })).toBeNull();

    fireEvent.click(within(second).getByRole('button', { name: 'Edit category' }));
    expect(within(first).queryByRole('textbox', { name: 'Name' })).toBeNull();
    expect(within(second).getByRole('textbox', { name: 'Name' })).toHaveValue('Second');
    expect(screen.getAllByRole('textbox', { name: 'Name' })).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Simulate reorder' }));
    expect(within(second).getByRole('textbox', { name: 'Name' })).toHaveValue('Second');
    expect(mocks.updateCategory).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Add Category' }));
    expect(screen.queryByRole('button', { name: 'Save Changes' })).toBeNull();
    expect(within(second).queryByRole('textbox', { name: 'Name' })).toBeNull();
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
        color: '#111111',
        visibility: 'followers',
      })
    );
  });

  it('edits category color with the creation palette and retains other fields', async () => {
    render(<CategoryManagerSheet isOpen onClose={vi.fn()} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit category' })[0]);

    expect(screen.getByText('Current color: #111111')).toBeInTheDocument();
    const palette = screen.getByRole('radiogroup', { name: 'Category color' });
    fireEvent.click(within(palette).getByRole('radio', { name: 'Select color #FF6B6B' }));
    expect(within(palette).getByRole('radio', { name: 'Select color #FF6B6B' }))
      .toHaveAttribute('aria-checked', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(mocks.updateCategory).toHaveBeenCalledExactlyOnceWith('first', {
      name: 'First', color: '#FF6B6B', visibility: 'private',
    }));
  });

  it('discards unsaved colors and reloads each category color on edit switch', () => {
    render(<CategoryManagerSheet isOpen onClose={vi.fn()} />);
    const edits = screen.getAllByRole('button', { name: 'Edit category' });
    fireEvent.click(edits[0]);
    fireEvent.click(screen.getByRole('radio', { name: 'Select color #FF6B6B' }));
    fireEvent.click(edits[1]);
    expect(screen.getByText('Current color: #222222')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Select color #FF6B6B' }))
      .toHaveAttribute('aria-checked', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(edits[0]);
    expect(screen.getByText('Current color: #111111')).toBeInTheDocument();
    expect(mocks.updateCategory).not.toHaveBeenCalled();
  });

  it('retains a color choice after failed update and retries the same value', async () => {
    mocks.updateCategory.mockRejectedValueOnce(new Error('write failed'));
    render(<CategoryManagerSheet isOpen onClose={vi.fn()} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit category' })[0]);
    fireEvent.click(screen.getByRole('radio', { name: 'Select color #FF6B6B' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await screen.findByRole('alert');
    expect(screen.getByRole('radio', { name: 'Select color #FF6B6B' }))
      .toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(mocks.updateCategory).toHaveBeenCalledTimes(2));
    expect(mocks.updateCategory).toHaveBeenLastCalledWith('first', {
      name: 'First', color: '#FF6B6B', visibility: 'private',
    });
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

  it('does not persist an edited visibility after cancel', () => {
    render(<CategoryManagerSheet isOpen onClose={vi.fn()} />);

    fireEvent.click(
      screen.getAllByRole('button', { name: 'Edit category' })[0]
    );

    let visibility = screen.getByRole('group', { name: 'Visibility' });
    fireEvent.click(within(visibility).getByRole('button', { name: /Friends/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(mocks.updateCategory).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getAllByRole('button', { name: 'Edit category' })[0]
    );
    visibility = screen.getByRole('group', { name: 'Visibility' });
    expect(
      within(visibility).getByRole('button', { name: /Private/ })
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('reloads visibility when switching directly between categories', () => {
    render(<CategoryManagerSheet isOpen onClose={vi.fn()} />);

    const editButtons = screen.getAllByRole('button', { name: 'Edit category' });
    fireEvent.click(editButtons[0]);

    let visibility = screen.getByRole('group', { name: 'Visibility' });
    expect(
      within(visibility).getByRole('button', { name: /Private/ })
    ).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(editButtons[1]);
    visibility = screen.getByRole('group', { name: 'Visibility' });
    expect(
      within(visibility).getByRole('button', { name: /Public/ })
    ).toHaveAttribute('aria-pressed', 'true');
  });


  it('keeps an unsaved category visible after rejection, and serializes rapid create clicks', async () => {
    let reject!: (error: Error) => void;
    const pending = new Promise<void>((_resolve, no) => { reject = no; });
    mocks.addCategory.mockReturnValueOnce(pending);

    render(<CategoryManagerSheet isOpen onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add Category' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), {
      target: { value: 'Keep me' },
    });
    const create = screen.getByRole('button', { name: 'Add Category' });
    act(() => {
      fireEvent.click(create);
      fireEvent.click(create);
    });
    expect(mocks.addCategory).toHaveBeenCalledOnce();

    await act(async () => {
      reject(new Error('disk error'));
      await pending.catch(() => undefined);
    });

    expect(screen.getByRole('alert')).toHaveTextContent(/could not add category/i);
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Keep me');
    expect(screen.getByRole('button', { name: 'Add Category' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Add Category' }));
    await waitFor(() => expect(mocks.addCategory).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Name' })).toBeNull());
  });

  it('leaves edit details available for retry after update failure', async () => {
    mocks.updateCategory.mockRejectedValueOnce(new Error('write failed'));
    render(<CategoryManagerSheet isOpen onClose={vi.fn()} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit category' })[0]);

    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), {
      target: { value: 'Renamed' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await screen.findByRole('alert');
    expect(screen.getByRole('alert')).toHaveTextContent(/could not update category/i);
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Renamed');
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(mocks.updateCategory).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Save Changes' })).toBeNull());
  });

  it('retains the delete confirmation when deletion rejects and allows retry', async () => {
    mocks.deleteCategory.mockRejectedValueOnce(new Error('write failed'));
    render(<CategoryManagerSheet isOpen onClose={vi.fn()} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete category' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await screen.findByRole('alert');
    expect(screen.getByRole('alert')).toHaveTextContent(/could not delete category/i);
    expect(screen.getByText('Delete this category?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(mocks.deleteCategory).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText('Delete this category?')).toBeNull());
  });

  it('focuses the edited category input, including when switching edited categories', () => {
    render(<CategoryManagerSheet isOpen onClose={vi.fn()} />);
    const edits = screen.getAllByRole('button', { name: 'Edit category' });

    fireEvent.click(edits[0]);
    const firstName = screen.getByRole('textbox', { name: 'Name' });
    expect(firstName).toHaveFocus();
    expect(firstName).toHaveValue('First');

    fireEvent.click(edits[1]);
    const secondName = screen.getByRole('textbox', { name: 'Name' });
    expect(secondName).toHaveFocus();
    expect(secondName).toHaveValue('Second');
  });

});
