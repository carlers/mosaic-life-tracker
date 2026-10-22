import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CategoryDocument } from '../../src/db/schema';

const mocks = vi.hoisted(() => ({ startDrag: vi.fn(), cancelDrag: vi.fn(), addTask: vi.fn() }));
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
      Item: ({ children, onDragStart, onDragEnd }: React.PropsWithChildren<{
        onDragStart: () => void;
        onDragEnd: () => void;
      }>) => <div>
        {children}
        <button onClick={onDragStart}>Start category drag</button>
        <button onClick={onDragEnd}>Drop category</button>
      </div>,
    },
    useDragControls: () => ({ start: mocks.startDrag, cancel: mocks.cancelDrag }),
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
        onContextMenu={actions?.onContextMenu}
        onClickCapture={actions?.consumeClick} onClick={mocks.addTask}>
        <span data-category-drag-handle>{category.name}</span>
        <span aria-hidden="true">+</span>
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
  beforeEach(() => { mocks.startDrag.mockReset(); mocks.cancelDrag.mockReset(); mocks.addTask.mockReset(); });
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

  it('opens Edit on a stationary desktop hold while keeping its drag session', () => {
    vi.useFakeTimers();
    render(<DayViewCategoryReorder {...createProps()}/>);
    const workLabel = screen.getByText('Work');
    fireEvent.pointerDown(workLabel, {
      isPrimary: true, button: 0, pointerId: 1, pointerType: 'mouse', clientX: 10, clientY: 10,
    });
    expect(mocks.startDrag).toHaveBeenCalledTimes(1);
    expect(mocks.startDrag.mock.calls[0][0].type).toBe('pointerdown');
    act(() => { vi.advanceTimersByTime(500); });
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    fireEvent.pointerUp(window, { pointerId: 1, pointerType: 'mouse' });
    fireEvent.click(workLabel.closest('button')!);
    expect(mocks.addTask).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Start category drag' })[0]);
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it('opens Edit on touch hold and hands Motion the original pointerdown to allow dragging', () => {
    vi.useFakeTimers();
    render(<DayViewCategoryReorder {...createProps()}/>);
    const homeLabel = screen.getByText('Home');
    fireEvent.pointerDown(homeLabel, {
      isPrimary: true, button: 0, pointerId: 4, pointerType: 'touch', clientX: 10, clientY: 10,
    });
    // Mobile browsers need Motion to register its pointer listener from the
    // original *live* touch press. Starting after 500ms lets native text
    // selection / pointercancel steal the gesture on actual phones.
    expect(mocks.startDrag).toHaveBeenCalledTimes(1);
    expect(mocks.startDrag.mock.calls[0][0].type).toBe('pointerdown');
    act(() => { vi.advanceTimersByTime(500); });
    expect(mocks.startDrag).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    fireEvent.pointerMove(window, {
      pointerId: 4, pointerType: 'touch', clientX: 30, clientY: 10,
    });
    expect(mocks.startDrag).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getAllByRole('button', { name: 'Start category drag' })[1]);
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    fireEvent.pointerUp(window, { pointerId: 4, pointerType: 'touch' });
    fireEvent.click(homeLabel.closest('button')!);
    expect(mocks.addTask).not.toHaveBeenCalled();
    expect(mocks.cancelDrag).not.toHaveBeenCalled();
  });

  it('does not arm a drag when the mouse holds the plus area, but still opens Edit', () => {
    vi.useFakeTimers();
    render(<DayViewCategoryReorder {...createProps()}/>);
    const pill = screen.getByText('Work').closest('button')!;
    fireEvent.pointerDown(pill, {
      isPrimary: true, button: 0, pointerId: 3, pointerType: 'mouse', clientX: 10, clientY: 10,
    });
    expect(mocks.startDrag).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(500); });
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    fireEvent.pointerUp(window, { pointerId: 3, pointerType: 'mouse' });
    fireEvent.click(pill);
    expect(mocks.addTask).not.toHaveBeenCalled();
  });

  it('allows long press on the full pill but not dragging from its plus affordance', () => {
    vi.useFakeTimers();
    render(<DayViewCategoryReorder {...createProps()}/>);
    const pill = screen.getByText('Work').closest('button')!;
    fireEvent.pointerDown(pill, {
      isPrimary: true, button: 0, pointerId: 5, pointerType: 'touch', clientX: 10, clientY: 10,
    });
    act(() => { vi.advanceTimersByTime(500); });
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    fireEvent.pointerMove(window, {
      pointerId: 5, pointerType: 'touch', clientX: 25, clientY: 10,
    });
    expect(mocks.startDrag).not.toHaveBeenCalled();
    fireEvent.pointerUp(window, { pointerId: 5, pointerType: 'touch' });
    fireEvent.click(pill);
    expect(mocks.addTask).not.toHaveBeenCalled();
  });

  it('aborts a mouse hold on movement, without opening Edit mid-drag', () => {
    vi.useFakeTimers();
    render(<DayViewCategoryReorder {...createProps()}/>);
    const label = screen.getByText('Work');
    fireEvent.pointerDown(label, {
      isPrimary: true, button: 0, pointerId: 15, pointerType: 'mouse', clientX: 5, clientY: 5,
    });
    fireEvent.pointerMove(window, {
      pointerId: 15, pointerType: 'mouse', clientX: 22, clientY: 5,
    });
    act(() => { vi.advanceTimersByTime(600); });
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(mocks.startDrag).toHaveBeenCalledTimes(1);
    fireEvent.pointerUp(window, { pointerId: 15, pointerType: 'mouse' });
  });

  it('cancels an armed touch drag on a swipe before the hold threshold', () => {
    vi.useFakeTimers();
    render(<DayViewCategoryReorder {...createProps()}/>);
    const label = screen.getByText('Work');
    fireEvent.pointerDown(label, {
      isPrimary: true, button: 0, pointerId: 18, pointerType: 'touch', clientX: 10, clientY: 10,
    });
    expect(mocks.startDrag).toHaveBeenCalledTimes(1);
    fireEvent.pointerMove(window, {
      pointerId: 18, pointerType: 'touch', clientX: 12, clientY: 32,
    });
    expect(mocks.cancelDrag).toHaveBeenCalledTimes(1);
    act(() => { vi.advanceTimersByTime(600); });
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    fireEvent.pointerUp(window, { pointerId: 18, pointerType: 'touch' });
    expect(mocks.cancelDrag).toHaveBeenCalledTimes(1);
  });

  it('cancels an armed but unmoved touch drag on release', () => {
    render(<DayViewCategoryReorder {...createProps()}/>);
    fireEvent.pointerDown(screen.getByText('Work'), {
      isPrimary: true, button: 0, pointerId: 19, pointerType: 'touch', clientX: 10, clientY: 10,
    });
    expect(mocks.startDrag).toHaveBeenCalledTimes(1);
    fireEvent.pointerUp(window, { pointerId: 19, pointerType: 'touch' });
    expect(mocks.cancelDrag).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it('cancels a touch hold after a pre-hold swipe or pointer cancellation', () => {
    vi.useFakeTimers();
    render(<DayViewCategoryReorder {...createProps()}/>);
    const pill = screen.getByText('Work').closest('button')!;
    fireEvent.pointerDown(pill, {
      isPrimary: true, button: 0, pointerId: 6, pointerType: 'touch', clientX: 10, clientY: 10,
    });
    fireEvent.pointerMove(window, {
      pointerId: 6, pointerType: 'touch', clientX: 10, clientY: 40,
    });
    act(() => { vi.advanceTimersByTime(600); });
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    fireEvent.pointerUp(window, { pointerId: 6, pointerType: 'touch' });
    fireEvent.pointerDown(pill, {
      isPrimary: true, button: 0, pointerId: 7, pointerType: 'touch', clientX: 10, clientY: 10,
    });
    fireEvent.pointerCancel(window, { pointerId: 7, pointerType: 'touch' });
    act(() => { vi.advanceTimersByTime(600); });
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(mocks.startDrag).not.toHaveBeenCalled();
  });

  it('does not skip reversing a reorder while the first save is pending', async () => {
    let finishFirst!: () => void;
    const first = new Promise<void>(resolve => { finishFirst = resolve; });
    const props = createProps();
    props.onCommit.mockImplementationOnce(() => first);
    render(<DayViewCategoryReorder {...props}/>);
    fireEvent.click(screen.getByRole('button', { name: 'Reorder categories' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Drop category' })[0]);
    expect(props.onCommit).toHaveBeenCalledWith([categories[1], categories[0]]);
    fireEvent.click(screen.getByRole('button', { name: 'Reorder categories' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Drop category' })[0]);
    await waitFor(() => expect(props.onCommit).toHaveBeenCalledTimes(2));
    expect(props.onCommit).toHaveBeenLastCalledWith([categories[0], categories[1]]);
    finishFirst();
  });

  it('preserves the native touch context menu when iOS cancels its pointer', () => {
    vi.useFakeTimers();
    render(<DayViewCategoryReorder {...createProps()}/>);
    const pill = screen.getByText('Work').closest('button')!;
    fireEvent.pointerDown(pill, {
      isPrimary: true, button: 0, pointerId: 9, pointerType: 'touch', clientX: 10, clientY: 10,
    });
    fireEvent.contextMenu(pill);
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    fireEvent.pointerCancel(window, { pointerId: 9, pointerType: 'touch' });
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(600); });
    expect(mocks.startDrag).not.toHaveBeenCalled();
  });

  it('does not offer drag controls in read-only views', () => {
    const props = createProps();
    render(<DayViewCategoryReorder {...props} enabled={false}/>);
    expect(screen.queryByTestId('category-reorder')).not.toBeInTheDocument();
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Work' }), {
      button: 0, pointerType: 'mouse',
    });
    expect(mocks.startDrag).not.toHaveBeenCalled();
    expect(mocks.cancelDrag).not.toHaveBeenCalled();
  });
});


describe('inline category actions', () => {
  afterEach(() => { vi.useRealTimers(); });
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
      name: 'Career', visibility: 'public', color: '#345678',
    }));
  });

  it('allows changing category color without changing its identity or visibility', async () => {
    const props = renderRealSection();
    fireEvent.click(screen.getByRole('button', { name: 'Category options for Work' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

    expect(screen.getByText('Current color: #345678')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Select color #FF6B6B' }));
    expect(screen.getByRole('radio', { name: 'Select color #FF6B6B' }))
      .toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(props.onUpdate).toHaveBeenCalledExactlyOnceWith('work', {
      name: 'Work', visibility: 'private', color: '#FF6B6B',
    }));
  });

  it('discards cancelled color edits and retains a failed edit for retry', async () => {
    const props = renderRealSection();
    fireEvent.click(screen.getByRole('button', { name: 'Category options for Work' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Select color #FF6B6B' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(props.onUpdate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Category options for Work' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByText('Current color: #345678')).toBeInTheDocument();
    props.onUpdate.mockRejectedValueOnce(new Error('write failed'));
    fireEvent.click(screen.getByRole('radio', { name: 'Select color #FF6B6B' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('alert');
    expect(screen.getByRole('radio', { name: 'Select color #FF6B6B' }))
      .toHaveAttribute('aria-checked', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(props.onUpdate).toHaveBeenCalledTimes(2));
    expect(props.onUpdate).toHaveBeenLastCalledWith('work', {
      name: 'Work', visibility: 'private', color: '#FF6B6B',
    });
  });

  it('disables native text selection only on the interactive category pill', () => {
    renderRealSection();
    const pill = screen.getByRole('button', { name: 'Add a task to Work' });
    const handle = pill.querySelector('[data-category-drag-handle]') as HTMLElement;
    expect(pill.style.userSelect).toBe('none');
    expect(pill.style.WebkitUserSelect).toBe('none');
    expect(handle.style.userSelect).toBe('none');
    expect(handle.style.touchAction).toBe('none');
  });

  it('opens the actual category actions from a touch hold anywhere on the pill', () => {
    vi.useFakeTimers();
    renderRealSection();
    const pill = screen.getByRole('button', { name: 'Add a task to Work' });
    fireEvent.pointerDown(pill, {
      isPrimary: true, button: 0, pointerId: 8, pointerType: 'touch', clientX: 10, clientY: 10,
    });
    act(() => { vi.advanceTimersByTime(500); });
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    fireEvent.pointerUp(window, { pointerId: 8, pointerType: 'touch' });
    fireEvent.click(pill);
    expect(screen.queryByRole('textbox', { name: 'New task title' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByRole('textbox', { name: 'Category name' })).toBeInTheDocument();
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
