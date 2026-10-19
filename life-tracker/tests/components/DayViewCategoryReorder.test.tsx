import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CategoryDocument } from '../../src/db/schema';

const mocks = vi.hoisted(() => ({ startDrag: vi.fn() }));
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return {
    ...actual,
    Reorder: {
      Group: ({ children, values, onReorder }: React.PropsWithChildren<{
        values: string[];
        onReorder: (values: string[]) => void;
      }>) => <div data-testid="category-reorder">
        {children}
        <button onClick={() => onReorder([...values].reverse())}>Reorder categories</button>
      </div>,
      Item: ({ children, onDragEnd }: React.PropsWithChildren<{
        onDragEnd: () => void;
      }>) => <div>
        {children}
        <button onClick={onDragEnd}>Drop category</button>
      </div>,
    },
    useDragControls: () => ({ start: mocks.startDrag }),
  };
});
import { DayViewCategoryReorder } from '../../src/components/home/views/DayViewCategoryReorder';
import { CategoryPillActionContext } from '../../src/components/home/views/categoryPillActionContext';
import { CategorySection } from '../../src/components/home/views/CategorySection';

const categories: CategoryDocument[] = ['Work', 'Home'].map((name, index) => ({
  id: name.toLowerCase(), userId: 'owner', name, color: '#345678', icon: '',
  order: index, visibility: 'private', isDeleted: false, updatedAt: '2026-10-01T00:00:00.000Z',
}));

const FakeCategory = ({ category }: { category: CategoryDocument }) => {
  const actions = React.useContext(CategoryPillActionContext);
  return (
    <div>
      <button type="button" onPointerDown={actions?.onPointerDown}
        onClickCapture={actions?.consumeClick} onClick={mocks.startDrag}>
        {category.name}
      </button>
      {actions?.menuOpen && <button type="button" onClick={() => actions.setMenuOpen(false)}>Edit</button>}
    </div>
  );
};

const createProps = () => ({
  categories,
  enabled: true,
  canStartDrag: true,
  onCommit: vi.fn().mockResolvedValue(undefined),
  onUpdate: vi.fn().mockResolvedValue(undefined),
  onDragActiveChange: vi.fn(),
  onError: vi.fn(),
  renderCategory: (category: CategoryDocument) => <FakeCategory category={category} />,
});

describe('Day View category gesture isolation', () => {
  beforeEach(() => { mocks.startDrag.mockReset(); });
  afterEach(() => { vi.useRealTimers(); });

  it('persists the final order only on drop', async () => {
    const props = createProps();
    render(<DayViewCategoryReorder {...props}/>);
    fireEvent.click(screen.getByRole('button', { name: 'Reorder categories' }));
    expect(props.onCommit).not.toHaveBeenCalled();
    expect(screen.getByTestId('category-reorder').textContent?.indexOf('Home'))
      .toBeLessThan(screen.getByTestId('category-reorder').textContent?.indexOf('Work'));
    fireEvent.click(screen.getAllByRole('button', { name: 'Drop category' })[0]);
    await waitFor(() => expect(props.onCommit).toHaveBeenCalledWith([
      categories[1], categories[0],
    ]));
  });

  it('starts pointer dragging from the desktop pill and delays touch', () => {
    vi.useFakeTimers();
    const props = createProps();
    render(<DayViewCategoryReorder {...props}/>);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Work' }), {
      button: 0, pointerId: 1, pointerType: 'mouse', clientX: 10, clientY: 10,
    });
    expect(mocks.startDrag).toHaveBeenCalledTimes(1);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Home' }), {
      button: 0, pointerId: 2, pointerType: 'touch', clientX: 10, clientY: 10,
    });
    expect(mocks.startDrag).toHaveBeenCalledTimes(1);
    act(() => { vi.advanceTimersByTime(500); });
    expect(mocks.startDrag).toHaveBeenCalledTimes(2);
    fireEvent.pointerUp(window, { pointerId: 2, pointerType: 'touch' });
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
  });

  it('does not offer drag controls in read-only views', () => {
    const props = createProps();
    render(<DayViewCategoryReorder {...props} enabled={false}/>);
    expect(screen.queryByTestId('category-reorder')).not.toBeInTheDocument();
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Work' }), {
      button: 0, pointerType: 'mouse',
    });
    expect(mocks.startDrag).not.toHaveBeenCalled();
  });
});


describe('inline category actions', () => {
  const renderRealSection = () => {
    const props = createProps();
    render(<DayViewCategoryReorder {...props}
      renderCategory={(category) => (
        <CategorySection
          categoryId={category.id}
          categoryName={category.name}
          categoryColor={category.color}
          visibility={category.visibility}
          currentUserId="owner"
          tasks={[]}
          editingTaskId={null}
          editValue=""
          onToggleTask={vi.fn()}
          onAddTask={vi.fn()}
          onOpenActions={vi.fn()}
          onOpenMemo={vi.fn()}
          onEditTask={vi.fn()}
          onEditChange={vi.fn()}
          onEditSave={vi.fn()}
          onEditCancel={vi.fn()}
        />
      )}
    />);
    return props;
  };

  it('retains click-to-add, but supports editing without Category Manager', async () => {
    const props = renderRealSection();
    fireEvent.click(screen.getByRole('button', { name: 'Add a task to Work' }));
    expect(screen.getByRole('textbox', { name: 'New task title' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Category options for Work' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Category name' }), {
      target: { value: 'Career' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'Visibility' }), {
      target: { value: 'public' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(props.onUpdate).toHaveBeenCalledWith('work', {
      name: 'Career', visibility: 'public',
    }));
  });

  it('allows keyboard users to move a category using the visible action menu', async () => {
    const props = renderRealSection();
    fireEvent.click(screen.getByRole('button', { name: 'Category options for Work' }));
    fireEvent.click(screen.getByRole('button', { name: 'Move down' }));
    await waitFor(() => expect(props.onCommit).toHaveBeenCalledWith([
      categories[1], categories[0],
    ]));
  });
});
