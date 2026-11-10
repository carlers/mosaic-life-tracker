import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
vi.mock('../../src/components/home/views/DiaryDayPreview', () => ({
  DiaryDayPreview: ({ date }: { date: string }) =>
    <div data-testid="timeline-diary">Diary {date}</div>,
  DiaryDayCard: () => <div>Diary drag overlay</div>,
}));
vi.mock('../../src/components/home/views/DraggableDiaryDayPreview', () => ({
  DraggableDiaryDayPreview: ({ date }: { date: string }) =>
    <div data-testid="timeline-diary">Draggable diary {date}</div>,
}));
vi.mock('../../src/components/home/views/SharedTaskRows', () => ({
  SharedTaskRows: ({ items, actionsOnly }: {
    items: { id: string; title: string }[]; actionsOnly?: boolean;
  }) => actionsOnly ? <div data-testid="timeline-shared-actions" /> :
    <div data-testid="timeline-shared-items">{items.map(item => (
      <span key={item.id}>{item.title}</span>
    ))}</div>,
}));
import { TaskTimelineList } from '../../src/components/home/views/TaskTimelineList';

const categories = [
  { id: 'work', name: 'Work', color: '#3B82F6' },
  { id: 'personal', name: 'Personal', color: '#F59E0B' },
] as React.ComponentProps<typeof TaskTimelineList>['categories'];

function renderTimeline(
  onAddTask = vi.fn(),
  sortBasis: React.ComponentProps<typeof TaskTimelineList>['sortBasis'] = 'completion',
  granularity: React.ComponentProps<typeof TaskTimelineList>['granularity'] = 'three',
  options: Partial<React.ComponentProps<typeof TaskTimelineList>> = {},
) {
  const onSortBasisChange = vi.fn();
  const onDirectionChange = vi.fn();
  render(
    <TaskTimelineList
      dateStr="2026-10-20"
      tasks={[]}
      categories={categories}
      currentUserId="owner"
      editingTaskId={null}
      editValue=""
      onToggleTask={vi.fn()}
      onAddTask={onAddTask}
      onAddTimelineTask={onAddTask}
      onTimelineMove={vi.fn().mockResolvedValue(undefined)}
      granularity={granularity}
      placements={{}}
      allowReorder
      onOpenActions={vi.fn()}
      onOpenMemo={vi.fn()}
      onEditTask={vi.fn()}
      onViewImage={vi.fn()}
      onEditChange={vi.fn()}
      onEditSave={vi.fn()}
      onEditCancel={vi.fn()}
      direction="desc"
      sortBasis={sortBasis}
      onSortBasisChange={onSortBasisChange}
      onDirectionChange={onDirectionChange}
      timestampDisplay={{ showCreated: false, showCompleted: false, labelStyle: 'icons' }}
      {...options}
    />
  );
  return { onAddTask, onSortBasisChange, onDirectionChange };
}

describe('Timeline category menus', () => {
  it('filters using the accessible custom category menu', async () => {
    renderTimeline();
    fireEvent.click(screen.getByRole('combobox', { name: 'Filter timeline by category: All categories' }));
    const menu = await screen.findByRole('listbox', { name: 'Filter timeline by category' });
    expect(menu).toBeInTheDocument();
    fireEvent.click(screen.getByRole('option', { name: 'Work' }));
    expect(screen.getByRole('combobox', { name: 'Filter timeline by category: Work' })).toHaveAttribute('aria-expanded', 'false');
    await waitFor(() => expect(screen.queryByRole('listbox', { name: 'Filter timeline by category' })).toBeNull());
  });

  it('opens by keyboard and closes with Escape without changing category', async () => {
    renderTimeline();
    const trigger = screen.getByRole('combobox', { name: 'New task category: Work' });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    const menu = await screen.findByRole('listbox', { name: 'New task category' });
    expect(menu).toBeInTheDocument();
    fireEvent.keyDown(menu, { key: 'End' });
    expect(screen.getByRole('option', { name: 'Personal' })).toHaveFocus();
    fireEvent.keyDown(menu, { key: 'Escape' });
    expect(screen.queryByRole('listbox', { name: 'New task category' })).toBeNull();
    expect(trigger).toHaveFocus();
    expect(screen.getByRole('combobox', { name: 'New task category: Work' })).toBeInTheDocument();
  });

  it('uses the chosen category when adding a task and keeps the category picker available', async () => {
    const { onAddTask } = renderTimeline();
    fireEvent.click(screen.getByRole('combobox', { name: 'New task category: Work' }));
    await screen.findByRole('listbox', { name: 'New task category' });
    fireEvent.click(screen.getByRole('option', { name: 'Personal' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'New timeline task title' }), {
      target: { value: '  Pay rent  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add timeline task' }));
    expect(onAddTask).toHaveBeenCalledWith('Pay rent', 'personal', '2026-10-20', 'all');
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'New timeline task title' })).toHaveValue(''));
    expect(screen.getByRole('combobox', { name: 'New task category: Personal' })).toBeInTheDocument();
  });

  it('submits the current timeline title on tap-away without requiring Done', async () => {
    const { onAddTask } = renderTimeline();
    const input = screen.getByRole('textbox', { name: 'New timeline task title' });
    fireEvent.change(input, { target: { value: '  Schedule trip  ' } });
    fireEvent.blur(input);
    await waitFor(() => expect(onAddTask).toHaveBeenCalledExactlyOnceWith('Schedule trip', 'work', '2026-10-20', 'all'));
    await waitFor(() => expect(input).toHaveValue(''));
  });

  it('does not submit a draft when tapping the category picker before choosing a category', async () => {
    const { onAddTask } = renderTimeline();
    const input = screen.getByRole('textbox', { name: 'New timeline task title' });
    fireEvent.change(input, { target: { value: 'Pack bag' } });
    const trigger = screen.getByRole('combobox', { name: 'New task category: Work' });
    input.focus();
    trigger.focus();
    expect(trigger).toHaveFocus();
    expect(onAddTask).not.toHaveBeenCalled();
    fireEvent.click(trigger);
    fireEvent.click(await screen.findByRole('option', { name: 'Personal' }));
    expect(onAddTask).not.toHaveBeenCalled();
    input.focus();
    input.blur();
    await waitFor(() => expect(onAddTask).toHaveBeenCalledExactlyOnceWith('Pack bag', 'personal', '2026-10-20', 'all'));
  });

  it('keeps an unsaved timeline title when persistence rejects and allows retry', async () => {
    const add = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);
    renderTimeline(add);
    const input = screen.getByRole('textbox', { name: 'New timeline task title' });
    fireEvent.change(input, { target: { value: 'Retry timeline' } });
    fireEvent.blur(input);
    expect(await screen.findByRole('alert')).toHaveTextContent('offline');
    expect(input).toHaveValue('Retry timeline');
    fireEvent.click(screen.getByRole('button', { name: 'Add timeline task' }));
    await waitFor(() => expect(input).toHaveValue(''));
    expect(add).toHaveBeenCalledTimes(2);
  });

  it('keeps the direction control in the timeline sorting group', () => {
    const { onDirectionChange } = renderTimeline();
    const sorting = screen.getByRole('group', { name: 'Timeline sorting' });
    const direction = screen.getByRole('button', { name: 'Timeline newest first; switch to oldest' });
    expect(sorting).toContainElement(direction);
    fireEvent.click(direction);
    expect(onDirectionChange).toHaveBeenCalledWith('asc');
    expect(screen.getByRole('combobox', { name: 'Arrange timeline tasks: Completed first' })).toBeInTheDocument();
  });

  it('offers completed last and creation date without duplicating sort controls', async () => {
    const { onSortBasisChange } = renderTimeline();
    const arrange = screen.getByRole('combobox', { name: 'Arrange timeline tasks: Completed first' });
    fireEvent.click(arrange);
    fireEvent.click(await screen.findByRole('option', { name: 'Completed last' }));
    expect(onSortBasisChange).toHaveBeenCalledWith('completion-last');
    fireEvent.click(arrange);
    fireEvent.click(await screen.findByRole('option', { name: 'Creation date' }));
    expect(onSortBasisChange).toHaveBeenCalledWith('creation');
  });  it('offers Day and Night section targets in manual mode', () => {
    renderTimeline(vi.fn().mockResolvedValue(undefined), 'manual', 'two');
    expect(screen.getByRole('heading', { name: /Day/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Night/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add task to Day' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Add task to Night' })).toBeEnabled();
  });

  it('renders Diary and only accepted same-day shared tasks in Timeline with existing callbacks', () => {
    renderTimeline(vi.fn(), 'manual', 'three', {
      diaryEnabled: true,
      diaryPlacement: { kind: 'top' },
      diaryDefaultPosition: 'bottom',
      sharedItems: [
        { id: 'share-1', taskId: 'remote-1', status: 'accepted', date: '2026-10-20', title: 'Shared appointment' },
        { id: 'share-2', taskId: 'remote-2', status: 'accepted', date: '2026-10-21', title: 'Tomorrow shared' },
        { id: 'share-3', taskId: 'remote-3', status: 'pending', date: '2026-10-20', title: 'Pending shared' },
      ] as React.ComponentProps<typeof TaskTimelineList>['sharedItems'],
      onSharedCompletion: vi.fn(),
      sharedPendingFor: vi.fn(),
    });
    expect(screen.getByTestId('timeline-diary')).toHaveTextContent('2026-10-20');
    expect(screen.getByTestId('timeline-shared-items')).toHaveTextContent('Shared appointment');
    expect(screen.queryByText('Tomorrow shared')).toBeNull();
    expect(screen.queryByText('Pending shared')).toBeNull();
    expect(screen.getByTestId('timeline-shared-actions')).toBeInTheDocument();
  });

  it('positions the borderless new-task composer at the selected top or bottom', () => {
    const top = renderTimeline(vi.fn(), 'manual', 'three', { newTaskPosition: 'top' });
    const firstHeading = screen.getByRole('heading', { name: /Morning/ });
    const topForm = screen.getByRole('form', { name: 'Add timeline task' });
    expect(topForm.compareDocumentPosition(firstHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Ensure changing an option does not mount duplicate task composers.
    expect(screen.getAllByRole('form', { name: 'Add timeline task' })).toHaveLength(1);
    void top;
  });

  it('renders the new-task composer after shared tasks with Bottom preference', () => {
    renderTimeline(vi.fn(), 'completion', 'three', {
      newTaskPosition: 'bottom',
      sharedItems: [
        { id: 'share-1', taskId: 'remote-1', status: 'accepted', date: '2026-10-20', title: 'Shared appointment' },
      ] as React.ComponentProps<typeof TaskTimelineList>['sharedItems'],
      onSharedCompletion: vi.fn(),
      sharedPendingFor: vi.fn(),
    });
    const form = screen.getByRole('form', { name: 'Add timeline task' });
    const shared = screen.getByTestId('timeline-shared-items');
    expect(shared.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('adds tasks to the chosen manual six-part section without a chronological direction control', async () => {
    const add = vi.fn().mockResolvedValue(undefined);
    renderTimeline(add, 'manual', 'six');
    expect(screen.getByRole('heading', { name: /Early Morning/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Timeline newest first/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add task to Late Afternoon' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'New timeline task title' }), { target: { value: 'Study' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add timeline task' }));
    expect(add).toHaveBeenCalledWith('Study', 'work', '2026-10-20', 'late-afternoon');
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'New timeline task title' })).toHaveValue(''));
  });
});
