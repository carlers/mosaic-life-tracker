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
const pausedControls = vi.hoisted(() => new Set<string>());
vi.mock('../../src/hooks/useFeatureEnabled', () => ({
  useFeatureEnabled: (flag: string) => !pausedControls.has(flag),
}));
vi.mock('../../src/lib/featureControls', () => ({
  isFeatureEnabled: (flag: string) => !pausedControls.has(flag),
}));


import type { CategoryDocument } from '../../src/db/schema';

const mocks = vi.hoisted(() => ({
  addCategory: vi.fn().mockResolvedValue(undefined),
  updateCategory: vi.fn().mockResolvedValue(undefined),
  retireCategory: vi.fn().mockResolvedValue(undefined),
  restoreCategory: vi.fn().mockResolvedValue(undefined),
  deleteCategory: vi.fn().mockResolvedValue(undefined),
  moveCategoryTasks: vi.fn().mockResolvedValue({ moved: 0, total: 0 }),
  reorderCategories: vi.fn().mockResolvedValue(undefined),
  categoryLifecycleInventory: vi.fn(),
  listRecoverableCategories: vi.fn(),
  recoverDeletedCategory: vi.fn().mockResolvedValue(undefined),
  executeCategoryLifecycle: vi.fn().mockResolvedValue(undefined),
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
let visibleTasks: Array<{ id: string; title: string; date: string; completed: boolean; categoryId: string; userId: string; isDeleted: boolean }> = [];

vi.mock('../../src/hooks/useCategories', () => ({
  useCategories: () => ({
    categories: visibleCategories,
    isLoading: false,
    addCategory: mocks.addCategory,
    updateCategory: mocks.updateCategory,
    retireCategory: mocks.retireCategory,
    restoreCategory: mocks.restoreCategory,
    deleteCategory: mocks.deleteCategory,
    reorderCategories: mocks.reorderCategories,
  }),
}));

vi.mock('../../src/hooks/useTasks', () => ({
  useTasks: () => ({ tasks: visibleTasks, isLoading: false, moveCategoryTasks: mocks.moveCategoryTasks }),
}));

vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({ user: { $id: 'user' } }),
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

vi.mock('../../src/components/ui/MosaicSelect', () => ({
  MosaicSelect: ({ label, value, onChange, options }: {
    label: string; value: string; onChange: (value: string) => void;
    options: { value: string; label: string }[];
  }) => (
    <select aria-label={label} value={value} onChange={event => onChange(event.target.value)}>
      <option value="">Select destination category</option>
      {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  ),
}));

vi.mock('../../src/lib/categoryLifecycleAction', () => ({
  categoryLifecycleInventory: mocks.categoryLifecycleInventory,
  listRecoverableCategories: mocks.listRecoverableCategories,
  recoverDeletedCategory: mocks.recoverDeletedCategory,
  executeCategoryLifecycle: mocks.executeCategoryLifecycle,
}));

import { CategoryManagerSheet } from '../../src/components/modals/CategoryManagerSheet';

beforeEach(() => pausedControls.clear());

describe('CategoryManagerSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.addCategory.mockReset().mockResolvedValue(undefined);
    mocks.updateCategory.mockReset().mockResolvedValue(undefined);
    mocks.retireCategory.mockReset().mockResolvedValue(undefined);
    mocks.restoreCategory.mockReset().mockResolvedValue(undefined);
    mocks.deleteCategory.mockReset().mockResolvedValue(undefined);
    mocks.categoryLifecycleInventory.mockReset().mockImplementation(async (categoryId: string) => ({categoryId, persistedTaskCount: 1, safeToDelete: false}));
    mocks.listRecoverableCategories.mockReset().mockResolvedValue({categories:[],nextCursor:null});
    mocks.recoverDeletedCategory.mockClear();
    mocks.moveCategoryTasks.mockReset().mockResolvedValue({ moved: 2, total: 2 });
    mocks.reorderCategories.mockReset().mockResolvedValue(undefined);
    visibleCategories = categories;
    visibleTasks = [];
  });

  it('filters active and retired categories as of today, searches names, and protects ordering', () => {
    visibleCategories = [
      {...categories[0], retiredOn: '2025-01-01', name: 'Archived School'},
      {...categories[1], name: 'Current Work'},
      {...categories[1], id: 'scheduled', order: 2, name: 'Future retirement', retiredOn: '2099-01-01'},
    ];
    render(<CategoryManagerSheet isOpen onClose={vi.fn()} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', {name: 'Retired (1)'}));
    expect(screen.getByRole('listitem', {name:'Archived School category'})).toBeInTheDocument();
    expect(screen.queryByRole('listitem', {name:'Current Work category'})).toBeNull();
    fireEvent.click(screen.getByRole('button', {name:'Simulate reorder'}));
    expect(mocks.reorderCategories).not.toHaveBeenCalled();
    expect(screen.getByRole('button', {name:'Reverse order'})).toBeDisabled();

    fireEvent.click(screen.getByRole('button', {name:'Active (2)'}));
    expect(screen.getByRole('listitem', {name:'Future retirement category'})).toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox', {name:'Search categories'}),
      {target:{value:'work'}});
    expect(screen.getByRole('listitem', {name:'Current Work category'})).toBeInTheDocument();
    expect(screen.queryByRole('listitem', {name:'Future retirement category'})).toBeNull();
    fireEvent.change(screen.getByRole('searchbox', {name:'Search categories'}),
      {target:{value:'not found'}});
    expect(screen.getByText('No matching categories.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name:'All (3)'}));
    fireEvent.change(screen.getByRole('searchbox', {name:'Search categories'}),
      {target:{value:''}});
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByRole('button', {name:'Reverse order'})).toBeEnabled();
  });

  it('permits editing and restoring categories within filtered or searched results', async () => {
    visibleCategories=[{...categories[0],name:'Old School',retiredOn:'2025-01-01'},categories[1]];
    render(<CategoryManagerSheet isOpen onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button',{name:'Retired (1)'}));
    const row=screen.getByRole('listitem',{name:'Old School category'});
    expect(within(row).getByRole('button',{name:'Drag to reorder'})).toBeDisabled();
    expect(within(row).getByRole('button',{name:'Manage retirement for Old School'})).toBeEnabled();
    fireEvent.click(within(row).getByRole('button',{name:'Manage retirement for Old School'}));
    expect(within(row).getByRole('button',{name:'Restore category'})).toBeEnabled();
    fireEvent.click(within(row).getByRole('button',{name:'Restore category'}));
    await waitFor(()=>expect(mocks.restoreCategory).toHaveBeenCalledWith('first'));
    fireEvent.change(screen.getByRole('searchbox',{name:'Search categories'}),{target:{value:'school'}});
    expect(within(row).getByRole('button',{name:'Edit category'})).toBeEnabled();
    fireEvent.click(within(row).getByRole('button',{name:'Edit category'}));
    expect(within(row).getByRole('textbox',{name:'Name'})).toHaveValue('Old School');
  });

  it('distinguishes future scheduled retirement from already retired categories', () => {
    visibleCategories=[{...categories[0],retiredOn:'2099-01-01'},
      {...categories[1],retiredOn:'2025-01-01'}];
    render(<CategoryManagerSheet isOpen onClose={vi.fn()} />);
    const upcoming=screen.getByRole('listitem',{name:'First category'});
    expect(within(upcoming).getByText('Retires: 2099-01-01')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'Retired (1)'}));
    expect(screen.queryByRole('listitem',{name:'First category'})).toBeNull();
    expect(screen.getByRole('listitem',{name:'Second category'})).toBeInTheDocument();
  });

  it('shows deleted categories only in the fourth filter and restores ordinary categories on return', async () => {
    mocks.listRecoverableCategories.mockResolvedValue({
      categories:[{id:'cat_deleted',name:'Old Tasks',deletedAt:'2026-10-20T00:00:00Z',status:'delete'}],
      nextCursor:null,
    });
    render(<CategoryManagerSheet isOpen onClose={vi.fn()} />);
    await waitFor(()=>expect(screen.getByRole('button',{name:'Recently deleted (1)'})).toBeInTheDocument());
    const tabs = within(screen.getByRole('group',{name:'Filter categories'})).getAllByRole('button');
    expect(tabs.map(tab => tab.textContent)).toEqual(['All (2)', 'Active (2)', 'Retired (0)', 'Recently deleted (1)']);
    expect(screen.queryByRole('region',{name:'Recently deleted categories'})).toBeNull();
    fireEvent.click(tabs[3]);
    expect(screen.getByRole('region',{name:'Recently deleted categories'})).toBeInTheDocument();
    expect(screen.queryByRole('listitem',{name:'First category'})).toBeNull();
    fireEvent.change(screen.getByRole('searchbox',{name:'Search categories'}),{target:{value:'missing'}});
    expect(screen.getByText('No matching deleted categories.')).toBeInTheDocument();
    fireEvent.click(tabs[0]);
    expect(screen.queryByRole('region',{name:'Recently deleted categories'})).toBeNull();
    expect(screen.getByRole('listitem',{name:'First category'})).toBeInTheDocument();
  });

  it('only offers server-tagged recoverable categories and requires exact name confirmation', async () => {
    mocks.listRecoverableCategories.mockResolvedValue({
      categories:[{id:'cat_deleted',name:'Old Tasks',deletedAt:'2026-10-20T00:00:00Z',status:'delete'}],
      nextCursor:null,
    });
    render(<CategoryManagerSheet isOpen onClose={vi.fn()} />);
    await waitFor(()=>expect(screen.getByRole('button',{name:'Recently deleted (1)'})).toBeInTheDocument());
    expect(screen.queryByRole('region',{name:'Recently deleted categories'})).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'Recently deleted (1)'}));
    expect(screen.getByRole('button',{name:'Recently deleted (1)'})).toHaveAttribute('aria-pressed','true');
    expect(screen.getByRole('region',{name:'Recently deleted categories'})).toBeInTheDocument();
    expect(screen.queryByRole('listitem',{name:'First category'})).toBeNull();
    expect(screen.queryByRole('button',{name:'Add Category'})).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'Recover category'}));
    const restore=screen.getByRole('button',{name:'Restore category and tasks'});
    expect(restore).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox',{name:'Type Old Tasks to confirm recovery'}),{target:{value:'Old Tasks'}});
    expect(restore).toBeEnabled();
    fireEvent.click(restore);
    await waitFor(()=>expect(mocks.recoverDeletedCategory).toHaveBeenCalledWith(
      'user','cat_deleted','Old Tasks',expect.any(Function)));
  });

  it('opens the requested retired category inline from Day View', async () => {
    visibleCategories = [
      categories[0],
      {...categories[1], retiredOn:'2025-01-01', name:'Old Projects'},
    ];
    render(<CategoryManagerSheet isOpen initialCategoryId="second" onClose={vi.fn()} />);
    const target = await screen.findByRole('listitem', {name:'Old Projects category'});
    expect(screen.getByRole('button', {name:'Retired (1)'})).toHaveAttribute('aria-pressed','true');
    expect(within(target).getByRole('textbox', {name:'Name'})).toHaveValue('Old Projects');
    expect(screen.queryByRole('listitem', {name:'First category'})).toBeNull();
  });

  it('positions the retirement form immediately inside the selected category and switches correctly', () => {
    render(<CategoryManagerSheet isOpen onClose={vi.fn()} />);
    const first = screen.getByRole('listitem', { name: 'First category' });
    const second = screen.getByRole('listitem', { name: 'Second category' });

    fireEvent.click(within(first).getByRole('button', { name: 'Manage retirement for First' }));
    expect(within(first).getByLabelText('Last active date (inclusive)')).toBeInTheDocument();
    expect(within(first).getByRole('button', { name: 'Retire category' })).toBeInTheDocument();
    expect(within(first).getByRole('button', { name: 'Manage retirement for First' }))
      .toHaveAttribute('aria-expanded', 'true');
    expect(within(second).queryByLabelText('Last active date (inclusive)')).toBeNull();

    fireEvent.click(within(second).getByRole('button', { name: 'Manage retirement for Second' }));
    expect(within(first).getByLabelText('Last active date (inclusive)').closest('[inert]'))
      .not.toBeNull();
    expect(within(second).getByLabelText('Last active date (inclusive)')).toBeInTheDocument();

    fireEvent.click(within(second).getByRole('button', { name: 'Edit category' }));
    expect(within(second).getByRole('textbox', { name: 'Name' })).toBeInTheDocument();
    expect(within(second).queryByLabelText('Last active date (inclusive)')).toBeNull();
    expect(within(second).getByRole('button', { name: 'Manage retirement for Second' }))
      .toHaveAttribute('aria-expanded', 'false');
  });

  it('requires server approval and exact confirmation before either destructive operation', async () => {
    mocks.categoryLifecycleInventory.mockImplementation(async (categoryId: string) => ({
      categoryId, persistedTaskCount: 13, safeToDelete: true,
    }));
    render(<CategoryManagerSheet isOpen onClose={vi.fn()} />);
    const first=screen.getByRole('listitem',{name:'First category'});
    fireEvent.click(within(first).getByRole('button',{name:'Manage deletion for First'}));
    const deleteAll=within(first).getByRole('button',{name:'Delete category and all tasks'});
    const moveDelete=within(first).getByRole('button',{name:'Move tasks & delete category'});
    await waitFor(()=>expect(within(first).getByText(/13 server-synced tasks/)).toBeInTheDocument());
    expect(deleteAll).toBeDisabled();
    expect(moveDelete).toBeDisabled();
    fireEvent.change(within(first).getByRole('textbox',{name:'Type First to confirm deletion'}),
      {target:{value:'First'}});
    expect(deleteAll).toBeEnabled();
    expect(moveDelete).toBeDisabled();
    fireEvent.change(within(first).getByRole('combobox',{name:'Move tasks to category before deleting'}),
      {target:{value:'second'}});
    expect(moveDelete).toBeEnabled();
    fireEvent.click(moveDelete);
    await waitFor(()=>expect(mocks.executeCategoryLifecycle).toHaveBeenCalledWith(
      'user','first','First','move','second',expect.any(Function)));
    expect(mocks.deleteCategory).not.toHaveBeenCalled();
  });

  it('shows category deletion safety details inside only the selected category', async () => {
    visibleTasks = [{ id: 'task_a', title: 'Keep me', date: '',
      completed: false, categoryId: 'first', userId: 'user', isDeleted: false }];
    render(<CategoryManagerSheet isOpen onClose={vi.fn()} />);
    const first = screen.getByRole('listitem', { name: 'First category' });
    const second = screen.getByRole('listitem', { name: 'Second category' });

    fireEvent.click(within(first).getByRole('button', { name: 'Manage deletion for First' }));
    expect(within(first).getByRole('region', { name: 'Category deletion options for First' })).toBeInTheDocument();
    expect(within(second).queryByRole('region', { name: 'Category deletion options for First' })).toBeNull();
    expect(within(first).getByRole('button', { name: 'Delete category and all tasks' })).toBeDisabled();
    await waitFor(() => expect(within(first).getByText(/1 server-synced task/)).toBeInTheDocument());
    expect(mocks.deleteCategory).not.toHaveBeenCalled();

    fireEvent.click(within(first).getByRole('button', { name: 'Retire instead' }));
    expect(within(first).getByLabelText('Last active date (inclusive)')).toBeInTheDocument();
    expect(within(first).queryByRole('region', { name: 'Category deletion options for First' })).toBeNull();

    fireEvent.click(within(second).getByRole('button', { name: 'Manage deletion for Second' }));
    expect(within(first).getByLabelText('Last active date (inclusive)').closest('[inert]')).not.toBeNull();
    expect(within(second).getByRole('region', { name: 'Category deletion options for Second' })).toBeInTheDocument();
    fireEvent.click(within(second).getByRole('button', { name: 'Cancel' }));
    expect(within(second).getByRole('button', { name: 'Manage deletion for Second' }))
      .toHaveAttribute('aria-expanded', 'false');
    expect(mocks.deleteCategory).not.toHaveBeenCalled();
  });

  it('moves local owner tasks across dates/Backlogs without deleting the category', async () => {
    visibleTasks = [
      { id: 'a', title: 'Dated', date: '2026-11-01', completed: true, categoryId: 'first', userId: 'user', isDeleted: false },
      { id: 'b', title: 'Backlog', date: '', completed: false, categoryId: 'first', userId: 'user', isDeleted: false },
    ];
    render(<CategoryManagerSheet isOpen onClose={vi.fn()} />);
    const first = screen.getByRole('listitem', { name: 'First category' });
    fireEvent.click(within(first).getByRole('button', { name: 'Move tasks from First' }));
    expect(within(first).getByText(/2 tasks available on this device/)).toBeInTheDocument();
    fireEvent.change(within(first).getByRole('combobox', { name: 'Move to category' }), {
      target: { value: 'second' },
    });
    fireEvent.click(within(first).getByRole('button', { name: 'Move 2 tasks' }));
    await waitFor(() => expect(mocks.moveCategoryTasks).toHaveBeenCalledWith('first', 'second'));
    expect(mocks.deleteCategory).not.toHaveBeenCalled();
    expect(mocks.retireCategory).not.toHaveBeenCalled();
  });

  it('retires the selected category using an inclusive calendar cutoff', async () => {
    render(<CategoryManagerSheet isOpen onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Manage retirement for First' }));
    fireEvent.change(screen.getByLabelText('Last active date (inclusive)'), {
      target: { value: '2026-11-01' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Retire category' }));
    await waitFor(() => expect(mocks.retireCategory).toHaveBeenCalledWith('first', '2026-11-01'));
    expect(mocks.deleteCategory).not.toHaveBeenCalled();
  });

  it('restores the same category without modifying any tasks', async () => {
    visibleCategories = [{ ...categories[0], retiredOn: '2026-10-31' }, categories[1]];
    render(<CategoryManagerSheet isOpen onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Manage retirement for First' }));
    fireEvent.click(screen.getByRole('button', { name: 'Restore category' }));
    await waitFor(() => expect(mocks.restoreCategory).toHaveBeenCalledWith('first'));
    expect(mocks.deleteCategory).not.toHaveBeenCalled();
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

  it('disables category deletion and makes orphaned owner tasks discoverable without modifying them', () => {
    visibleTasks = [
      { id: 'orphan', title: 'Preserved assignment', date: '2026-10-30', completed: false, categoryId: 'removed', userId: 'user', isDeleted: false },
      { id: 'valid', title: 'Current assignment', date: '2026-10-30', completed: false, categoryId: 'first', userId: 'user', isDeleted: false },
      { id: 'foreign', title: 'Foreign assignment', date: '2026-10-30', completed: false, categoryId: 'removed', userId: 'other', isDeleted: false },
    ];
    render(<CategoryManagerSheet isOpen onClose={vi.fn()} />);
    const first = screen.getByRole('listitem', { name: 'First category' });
    fireEvent.click(within(first).getByRole('button', { name: 'Manage deletion for First' }));
    expect(within(first).getByRole('button', { name: 'Delete category and all tasks' })).toBeDisabled();
    fireEvent.click(screen.getByText('Tasks without an active category (1)'));
    expect(screen.getByText('Preserved assignment')).toBeInTheDocument();
    expect(screen.queryByText('Foreign assignment')).toBeNull();
    expect(screen.queryByText('Current assignment')).toBeNull();
    expect(mocks.deleteCategory).not.toHaveBeenCalled();
    expect(mocks.updateCategory).not.toHaveBeenCalled();
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

  it('pauses category reorder without blocking category editing', () => {
    pausedControls.add('mosaic_disable_category_reorder');
    render(<CategoryManagerSheet isOpen onClose={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Reverse order' })).not.toBeInTheDocument();
    for (const control of screen.getAllByRole('button', { name: 'Drag to reorder' })) {
      expect(control).toBeDisabled();
    }
    expect(screen.getAllByRole('button', { name: 'Edit category' }).length).toBeGreaterThan(0);
  });

});
