import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CategoryDocument } from '../../src/db/schema';
import { DayViewCategoryReorder } from '../../src/components/home/views/DayViewCategoryReorder';
import { CategoryPillActionContext, CategoryReorderDragContext } from '../../src/components/home/views/categoryPillActionContext';
import { CategorySection } from '../../src/components/home/views/CategorySection';

const mocks = vi.hoisted(() => ({ addTask: vi.fn() }));

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

// Simulate different-sized category sections to exercise the actual header-
// based collision algorithm. JSDOM does not measure rendered layout.
const mockHeaderGeometry = () => vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
  const row = this.closest('[data-category-reorder-id]') as HTMLElement | null;
  const rows = Array.from(document.querySelectorAll('[data-category-reorder-id]'));
  const index = row ? rows.indexOf(row) : 0;
  const top = 20 + Math.max(0, index) * 190;
  return {
    x: 30, y: top, left: 30, top, width: 210, height: 40,
    right: 240, bottom: top + 40, toJSON: () => ({}),
  } as DOMRect;
});

const down = (label: HTMLElement, pointerId: number, pointerType: string, y: number) =>
  fireEvent.pointerDown(label, {
    isPrimary: true, button: 0, pointerId, pointerType, clientX: 70, clientY: y,
  });
const move = (pointerId: number, pointerType: string, y: number) =>
  fireEvent.pointerMove(window, { pointerId, pointerType, clientX: 70, clientY: y });
const up = (pointerId: number, pointerType: string) =>
  fireEvent.pointerUp(window, { pointerId, pointerType });

describe('Day View category gesture isolation', () => {
  beforeEach(() => { mocks.addTask.mockReset(); });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it('reuses mounted category subtrees across in-flight reorder previews', () => {
    mockHeaderGeometry();
    const props = createProps();
    const renderCategory = vi.fn((category: CategoryDocument) => <FakeCategory category={category} />);
    render(<DayViewCategoryReorder {...props} renderCategory={renderCategory} />);
    const work = screen.getByText('Work');
    down(work, 1, 'mouse', 40);
    move(1, 'mouse', 245);
    expect(screen.getByTestId('category-reorder').textContent?.indexOf('Home'))
      .toBeLessThan(screen.getByTestId('category-reorder').textContent?.indexOf('Work'));
    move(1, 'mouse', 5);
    expect(renderCategory).toHaveBeenCalledTimes(categories.length);
    up(1, 'mouse');
  });

  it('suppresses nested layout projection only during a category drag', () => {
    const props = createProps();
    const CategoryDragProbe = ({ category }: { category: CategoryDocument }) => {
      const active = React.useContext(CategoryReorderDragContext);
      return <div data-testid={`category-${category.id}-nested-projection`}
        data-category-drag-active={active ? 'true' : 'false'}>
        <FakeCategory category={category} />
      </div>;
    };
    render(<DayViewCategoryReorder {...props}
      renderCategory={category => <CategoryDragProbe category={category} />} />);
    const probe = screen.getByTestId('category-work-nested-projection');
    const label = screen.getByText('Work');
    expect(probe).toHaveAttribute('data-category-drag-active', 'false');
    down(label, 2, 'mouse', 40);
    move(2, 'mouse', 70);
    expect(probe).toHaveAttribute('data-category-drag-active', 'true');
    expect(document.querySelector('[data-category-drag-overlay="work"]')).not.toBeNull();
    up(2, 'mouse');
    expect(probe).toHaveAttribute('data-category-drag-active', 'false');
    expect(document.querySelector('[data-category-drag-overlay]')).toBeNull();
    expect(props.onDragActiveChange).toHaveBeenCalledWith(true);
    expect(props.onDragActiveChange).toHaveBeenLastCalledWith(false);
  });

  it('commits final order only on release and tracks the original pointer offset', async () => {
    mockHeaderGeometry();
    const props = createProps();
    render(<DayViewCategoryReorder {...props}/>);
    const work = screen.getByText('Work');
    down(work, 3, 'mouse', 40);
    move(3, 'mouse', 240);
    expect(props.onCommit).not.toHaveBeenCalled();
    expect(document.querySelector('[data-category-drag-overlay="work"]')).toHaveProperty('style.transform',
      'translate3d(0px,200px,0)');
    expect(screen.getByTestId('category-reorder').textContent?.indexOf('Home'))
      .toBeLessThan(screen.getByTestId('category-reorder').textContent?.indexOf('Work'));
    up(3, 'mouse');
    await waitFor(() => expect(props.onCommit).toHaveBeenCalledWith([categories[1], categories[0]]));
    expect(document.querySelector('[data-category-drag-overlay]')).toBeNull();
  });

  it('stationary desktop hold opens Edit; a subsequent drag dismisses it without adding a task', () => {
    vi.useFakeTimers();
    render(<DayViewCategoryReorder {...createProps()}/>);
    const work = screen.getByText('Work');
    down(work, 4, 'mouse', 10);
    act(() => { vi.advanceTimersByTime(500); });
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    move(4, 'mouse', 35);
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    up(4, 'mouse');
    fireEvent.click(work.closest('button')!);
    expect(mocks.addTask).not.toHaveBeenCalled();
  });

  it('touch requires a hold and then follows the original touch location', () => {
    vi.useFakeTimers();
    render(<DayViewCategoryReorder {...createProps()}/>);
    const home = screen.getByText('Home');
    down(home, 5, 'touch', 10);
    expect(document.querySelector('[data-category-drag-overlay]')).toBeNull();
    act(() => { vi.advanceTimersByTime(500); });
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    move(5, 'touch', 35);
    expect(document.querySelector('[data-category-drag-overlay="home"]')).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    up(5, 'touch');
    fireEvent.click(home.closest('button')!);
    expect(mocks.addTask).not.toHaveBeenCalled();
  });

  it('holds the plus area to show Edit without starting a drag', () => {
    vi.useFakeTimers();
    const props = createProps();
    render(<DayViewCategoryReorder {...props}/>);
    const pill = screen.getByText('Work').closest('button')!;
    fireEvent.pointerDown(pill, {
      isPrimary: true, button: 0, pointerId: 6, pointerType: 'mouse', clientX: 70, clientY: 10,
    });
    act(() => { vi.advanceTimersByTime(500); });
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    move(6, 'mouse', 35);
    expect(document.querySelector('[data-category-drag-overlay]')).toBeNull();
    up(6, 'mouse');
    fireEvent.click(pill);
    expect(mocks.addTask).not.toHaveBeenCalled();
    expect(props.onCommit).not.toHaveBeenCalled();
  });

  it('moving before touch hold cancels category drag and leaves scrolling free', () => {
    vi.useFakeTimers();
    const props = createProps();
    render(<DayViewCategoryReorder {...props}/>);
    down(screen.getByText('Work'), 7, 'touch', 10);
    move(7, 'touch', 35);
    act(() => { vi.advanceTimersByTime(600); });
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(document.querySelector('[data-category-drag-overlay]')).toBeNull();
    up(7, 'touch');
    expect(props.onCommit).not.toHaveBeenCalled();
  });

  it('unmoved touch release does not drag or show Edit', () => {
    render(<DayViewCategoryReorder {...createProps()}/>);
    down(screen.getByText('Work'), 8, 'touch', 10);
    up(8, 'touch');
    expect(document.querySelector('[data-category-drag-overlay]')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it('Escape cancels the drag without committing its projected order', () => {
    mockHeaderGeometry();
    const props = createProps();
    render(<DayViewCategoryReorder {...props}/>);
    const work = screen.getByText('Work');
    down(work, 9, 'mouse', 40);
    move(9, 'mouse', 245);
    expect(screen.getByTestId('category-reorder').textContent?.indexOf('Home'))
      .toBeLessThan(screen.getByTestId('category-reorder').textContent?.indexOf('Work'));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByTestId('category-reorder').textContent?.indexOf('Work'))
      .toBeLessThan(screen.getByTestId('category-reorder').textContent?.indexOf('Home'));
    up(9, 'mouse');
    expect(props.onCommit).not.toHaveBeenCalled();
  });

  it('pointer cancellation after an active drag restores order and unlocks swiping', () => {
    mockHeaderGeometry();
    const props = createProps();
    render(<DayViewCategoryReorder {...props}/>);
    down(screen.getByText('Work'), 10, 'mouse', 40);
    move(10, 'mouse', 245);
    fireEvent.pointerCancel(window, { pointerId: 10, pointerType: 'mouse' });
    expect(props.onCommit).not.toHaveBeenCalled();
    expect(props.onDragActiveChange).toHaveBeenLastCalledWith(false);
    expect(document.querySelector('[data-category-drag-overlay]')).toBeNull();
    expect(screen.getByTestId('category-reorder').textContent?.indexOf('Work'))
      .toBeLessThan(screen.getByTestId('category-reorder').textContent?.indexOf('Home'));
  });

  it('keeps native touch context menu open if iOS cancels its pointer', () => {
    vi.useFakeTimers();
    render(<DayViewCategoryReorder {...createProps()}/>);
    const pill = screen.getByText('Work').closest('button')!;
    down(screen.getByText('Work'), 11, 'touch', 10);
    fireEvent.contextMenu(pill);
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    fireEvent.pointerCancel(window, { pointerId: 11, pointerType: 'touch' });
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(600); });
    expect(document.querySelector('[data-category-drag-overlay]')).toBeNull();
  });

  it('queues reverse reorder while the previous save is pending', async () => {
    mockHeaderGeometry();
    let finishFirst!: () => void;
    const first = new Promise<void>(resolve => { finishFirst = resolve; });
    const props = createProps();
    props.onCommit.mockImplementationOnce(() => first);
    render(<DayViewCategoryReorder {...props}/>);
    const label = screen.getByText('Work');
    down(label, 12, 'mouse', 40);
    move(12, 'mouse', 245);
    up(12, 'mouse');
    expect(props.onCommit).toHaveBeenCalledWith([categories[1], categories[0]]);
    down(label, 13, 'mouse', 230);
    move(13, 'mouse', 0);
    up(13, 'mouse');
    await waitFor(() => expect(props.onCommit).toHaveBeenCalledTimes(2));
    expect(props.onCommit).toHaveBeenLastCalledWith([categories[0], categories[1]]);
    finishFirst();
  });

  it('does not enable category drag in read-only views', () => {
    const props = createProps();
    render(<DayViewCategoryReorder {...props} enabled={false} />);
    down(screen.getByText('Work'), 14, 'mouse', 40);
    move(14, 'mouse', 245);
    up(14, 'mouse');
    expect(document.querySelector('[data-category-drag-overlay]')).toBeNull();
    expect(props.onCommit).not.toHaveBeenCalled();
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
