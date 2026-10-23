// Regression: §2/§13 (Day View header and nested sheet context).
import type { ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CategoryDocument, TaskDocument } from '../../src/db/schema';

const swiperFixture = vi.hoisted(() => ({
  slidePrev: vi.fn(),
  slideNext: vi.fn(),
  slideTo: vi.fn(),
  nested: undefined as boolean | undefined,
  noSwiping: undefined as boolean | undefined,
  touchStartPreventDefault: undefined as boolean | undefined,
  touchMoveStopPropagation: undefined as boolean | undefined,
}));

const taskMocks = vi.hoisted(() => ({
  moveTasksToCategory: vi.fn().mockResolvedValue(undefined),
  updateTask: vi.fn().mockResolvedValue(undefined),
  deleteTask: vi.fn().mockResolvedValue(undefined),
}));

const feedbackMocks = vi.hoisted(() => ({ show: vi.fn() }));
const firstCategoryFixture = vi.hoisted(() => ({
  categories: null as CategoryDocument[] | null,
  loading: false,
  addCategory: vi.fn().mockResolvedValue(undefined),
}));

const settingsFixture = vi.hoisted(() => ({
  values: {} as Record<string, unknown>,
}));

const fixture = vi.hoisted(() => ({
  task: {
    id: 'task_1',
    title: 'Task with photo',
    completed: false,
    categoryId: 'cat_1',
    order: 0,
    date: '2026-09-20',
    createdAt: '2026-09-20T00:00:00.000Z',
    updatedAt: '2026-09-20T00:00:00.000Z',
    userId: 'user_1',
    isDeleted: false,
    visibility: '',
    memo: '',
    image: 'image_1',
  } as TaskDocument,
  secondCategory: {
    id: 'cat_2',
    name: 'Personal',
    color: '#22C55E',
    order: 1,
    visibility: 'private',
    userId: 'user_1',
    isDeleted: false,
  } as CategoryDocument,
  category: {
    id: 'cat_1',
    name: 'Work',
    color: '#3B82F6',
    order: 0,
    visibility: 'private',
    userId: 'user_1',
    isDeleted: false,
  } as CategoryDocument,
}));

vi.mock('swiper/react', () => ({
  Swiper: ({
    children,
    onSwiper,
    nested,
    noSwiping,
    touchStartPreventDefault,
    touchMoveStopPropagation,
    className,
  }: {
    children: ReactNode;
    onSwiper?: (swiper: unknown) => void;
    nested?: boolean;
    noSwiping?: boolean;
    touchStartPreventDefault?: boolean;
    touchMoveStopPropagation?: boolean;
    className?: string;
  }) => {
    swiperFixture.nested = nested;
    swiperFixture.noSwiping = noSwiping;
    swiperFixture.touchStartPreventDefault = touchStartPreventDefault;
    swiperFixture.touchMoveStopPropagation = touchMoveStopPropagation;
    onSwiper?.({
      activeIndex: 90,
      slideTo: swiperFixture.slideTo,
      slidePrev: swiperFixture.slidePrev,
      slideNext: swiperFixture.slideNext,
    });
    return (
      <div data-testid="day-swiper" className={className}>
        {children}
      </div>
    );
  },
  SwiperSlide: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock('../../src/components/home/views/DaySlide', () => ({
  DaySlide: ({
    tasks,
    onOpenActions,
    selectionMode,
    selectedTaskIds,
    onToggleTaskSelection,
    onToggleCategorySelection,
    emptyCategoryPrompt,
    footerCategoryPrompt,
  }: {
    tasks: TaskDocument[];
    onOpenActions: (task: TaskDocument) => void;
    selectionMode?: boolean;
    selectedTaskIds?: ReadonlySet<string>;
    onToggleTaskSelection?: (taskId: string) => void;
    onToggleCategorySelection?: (categoryId: string) => void;
    emptyCategoryPrompt?: ReactNode;
    footerCategoryPrompt?: ReactNode;
  }) =>
    tasks.length > 0 ? (
      <>
        {emptyCategoryPrompt}
        {selectionMode && onToggleCategorySelection && (
          <button type="button" onClick={() => onToggleCategorySelection(tasks[0].categoryId)}>
            {selectionMode && tasks.every(task => selectedTaskIds?.has(task.id))
              ? 'Deselect category tasks'
              : 'Select category tasks'}
          </button>
        )}
        {tasks.map((task, index) => (
          <button key={task.id} onClick={() => selectionMode ? onToggleTaskSelection?.(task.id) : onOpenActions(task)}>
            {selectionMode
              ? `${selectedTaskIds?.has(task.id) ? 'Deselect' : 'Select'} mocked task${index ? ` ${task.id}` : ''}`
              : index ? `Open actions ${task.id}` : 'Open actions'}
          </button>
        ))}
        {footerCategoryPrompt}
      </>
    ) : footerCategoryPrompt ?? emptyCategoryPrompt ?? null,
}));

vi.mock('../../src/components/home/views/MemoSheet', () => ({
  MemoSheet: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="memo-sheet">Memo child</div> : null,
}));

vi.mock('../../src/components/home/views/DatePickerSheet', () => ({
  DatePickerSheet: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="date-sheet">Date child</div> : null,
}));

vi.mock('../../src/components/home/views/TaskVisibilitySheet', () => ({
  TaskVisibilitySheet: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="visibility-sheet">Visibility child</div> : null,
}));

vi.mock('../../src/components/home/views/ImagePickerSheet', () => ({
  ImagePickerSheet: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="image-picker-sheet">Image picker child</div> : null,
}));

vi.mock('../../src/components/home/views/ShareTaskSheet', () => ({
  ShareTaskSheet: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div role="dialog" aria-label="Share task" /> : null,
}));
vi.mock('../../src/components/home/views/LinkTaskToBucketSheet', () => ({
  LinkTaskToBucketSheet: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div role="dialog" aria-label="Link to Bucket List" /> : null,
}));

vi.mock('../../src/components/home/views/ImageViewer', () => ({
  ImageViewer: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="image-viewer">Image viewer</div> : null,
}));

vi.mock('../../src/hooks/useTasks', () => ({
  useTasks: () => ({
    tasks: [fixture.task],
    addTask: vi.fn(),
    toggleTaskCompletion: vi.fn(),
    updateTask: taskMocks.updateTask,
    deleteTask: taskMocks.deleteTask,
    reorderTasks: vi.fn(),
    moveTasksToCategory: taskMocks.moveTasksToCategory,
  }),
}));

vi.mock('../../src/hooks/useCategories', () => ({
  useCategories: () => ({
    categories: firstCategoryFixture.categories ?? [fixture.category, fixture.secondCategory],
    isLoading: firstCategoryFixture.loading,
    addCategory: firstCategoryFixture.addCategory,
  }),
}));

vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({ user: { $id: 'user_1' } }),
}));

vi.mock('../../src/hooks/useFeedback', () => ({
  useFeedback: () => ({ message: null, show: feedbackMocks.show, clear: vi.fn() }),
}));

vi.mock('../../src/hooks/useSettings', () => ({
  useSettings: () => ({
    getSetting: (key: string, defaultValue?: unknown) =>
      key in settingsFixture.values ? settingsFixture.values[key] : defaultValue,
    setSetting: vi.fn(),
  }),
}));

vi.mock('../../src/hooks/useSharedTasks', () => ({
  useSharedTasks: () => ({ items: [], activeItems: [], error: '', online: false,
    isLoading: false, pendingFor: () => undefined,
    updateCompletion: vi.fn(), updateMembership: vi.fn(), invite: vi.fn(), reload: vi.fn() }),
}));

vi.mock('../../src/hooks/useTaskImage', () => ({
  useTaskImage: () => ({ imageUrl: 'blob:image_1', isLoading: false }),
}));

vi.mock('../../src/lib/storage', () => ({
  deleteImage: vi.fn(),
}));

import { DayViewSheet } from '../../src/components/home/views/DayViewSheet';

function renderSheet() {
  // This suite verifies interactions *after* the sheet's paint-deferred
  // controls mount. The separate BottomSheet regression verifies that the
  // shell paints first, rather than accidentally testing an eager mount.
  const frames = new Map<number, FrameRequestCallback>();
  let nextFrame = 0;
  const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    const frameId = ++nextFrame;
    frames.set(frameId, callback);
    return frameId;
  });
  const cancel = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((frameId) => {
    frames.delete(frameId);
  });

  const result = render(
    <DayViewSheet
      isOpen
      onClose={vi.fn()}
      selectedDate={new Date(2026, 8, 20)}
      onDateChange={vi.fn()}
    />
  );
  try {
    for (let frame = 0; frame < 2; frame += 1) {
      const pending = [...frames.values()];
      frames.clear();
      act(() => pending.forEach((callback) => callback(performance.now())));
    }
  } finally {
    raf.mockRestore();
    cancel.mockRestore();
  }
  return result;
}

describe('DayViewSheet nested task actions', () => {
  beforeEach(() => {
    firstCategoryFixture.categories = null;
    firstCategoryFixture.loading = false;
    firstCategoryFixture.addCategory.mockReset().mockResolvedValue(undefined);
    settingsFixture.values = {};
    feedbackMocks.show.mockClear();
    fixture.task.image = 'image_1';
    swiperFixture.slidePrev.mockClear();
    swiperFixture.slideNext.mockClear();
    swiperFixture.slideTo.mockClear();
    swiperFixture.nested = undefined;
    swiperFixture.noSwiping = undefined;
    swiperFixture.touchStartPreventDefault = undefined;
    swiperFixture.touchMoveStopPropagation = undefined;
    taskMocks.moveTasksToCategory.mockClear();
    taskMocks.updateTask.mockReset().mockResolvedValue(undefined);
    taskMocks.deleteTask.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('defaults to a cancellable single-task delete confirmation', async () => {
    renderSheet();
    fireEvent.click(screen.getByRole('button', { name: 'Open actions' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByText('This task will be permanently removed.')).toBeInTheDocument();
    expect(taskMocks.deleteTask).not.toHaveBeenCalled();
    const message = screen.getByText('This task will be permanently removed.');
    fireEvent.click(within(message.closest('[role="dialog"]') as HTMLElement).getByRole('button', { name: 'Cancel' }));
    expect(taskMocks.deleteTask).not.toHaveBeenCalled();
  });

  it('deletes the confirmed task and reports a failed single delete', async () => {
    taskMocks.deleteTask.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
    renderSheet();
    fireEvent.click(screen.getByRole('button', { name: 'Open actions' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const message = screen.getByText('This task will be permanently removed.');
    const confirmation = message.closest('[role="dialog"]') as HTMLElement;
    fireEvent.click(within(confirmation).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(feedbackMocks.show).toHaveBeenCalledWith('Task could not be deleted'));
    expect(taskMocks.deleteTask).toHaveBeenCalledWith('task_1');
    fireEvent.click(within(confirmation).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(taskMocks.deleteTask).toHaveBeenCalledTimes(2));
  });

  it('skips confirmation for single task deletion only when explicitly disabled', async () => {
    settingsFixture.values = { confirmTaskDelete: false };
    renderSheet();
    fireEvent.click(screen.getByRole('button', { name: 'Open actions' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(taskMocks.deleteTask).toHaveBeenCalledWith('task_1'));
    expect(screen.queryByText('This task will be permanently removed.')).toBeNull();
  });

  it('keeps bulk delete confirmation enabled by default and supports cancellation', () => {
    render(<DayViewSheet isOpen onClose={vi.fn()} selectedDate={new Date(2026, 8, 20)} renderMode="inline" />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Select tasks' })
      .find(button => button.getAttribute('tabindex') === '0') as HTMLElement);
    fireEvent.click(screen.getByRole('button', { name: 'Select mocked task' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete selected tasks' }));
    const message = screen.getByText('The selected tasks will be removed from your calendar.');
    expect(taskMocks.deleteTask).not.toHaveBeenCalled();
    fireEvent.click(within(message.closest('[role="dialog"]') as HTMLElement).getByRole('button', { name: 'Cancel' }));
    expect(taskMocks.deleteTask).not.toHaveBeenCalled();
  });

  it('always confirms selected deletion even when individual prompts are off, retaining partial failures', async () => {
    settingsFixture.values = { confirmTaskDelete: false };
    taskMocks.deleteTask.mockImplementation(async (id: string) => {
      if (id === 'task_2') throw new Error('offline');
    });
    const second = { ...fixture.task, id: 'task_2', title: 'Second task' };
    render(<DayViewSheet isOpen onClose={vi.fn()} selectedDate={new Date(2026, 8, 20)}
      renderMode="inline" tasks={[fixture.task, second]}
      categories={[fixture.category, fixture.secondCategory]} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Select tasks' })
      .find(button => button.getAttribute('tabindex') === '0') as HTMLElement);
    fireEvent.click(screen.getByRole('button', { name: 'Select mocked task' }));
    fireEvent.click(screen.getByRole('button', { name: 'Select mocked task task_2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete selected tasks' }));
    const message = screen.getByText('The selected tasks will be removed from your calendar.');
    const confirmation = message.closest('[role="dialog"]') as HTMLElement;
    expect(taskMocks.deleteTask).not.toHaveBeenCalled();

    fireEvent.click(within(confirmation).getByRole('button', { name: 'Cancel' }));
    expect(taskMocks.deleteTask).not.toHaveBeenCalled();
    expect(screen.getByText('2 selected')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Delete selected tasks' }));
    const retryMessage = screen.getByText('The selected tasks will be removed from your calendar.');
    fireEvent.click(within(retryMessage.closest('[role="dialog"]') as HTMLElement)
      .getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(feedbackMocks.show).toHaveBeenCalledWith('1 task could not be deleted'));
    expect(taskMocks.deleteTask).toHaveBeenCalledTimes(2);
    expect(taskMocks.deleteTask).toHaveBeenCalledWith('task_1');
    expect(taskMocks.deleteTask).toHaveBeenCalledWith('task_2');
    await waitFor(() => expect(screen.queryByText('The selected tasks will be removed from your calendar.')).toBeNull());
    expect(screen.getByRole('button', { name: 'Select mocked task' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Deselect mocked task task_2' })).toBeInTheDocument();
  });

  it('still confirms selected Backlog deletion when individual prompts are off', () => {
    settingsFixture.values = { confirmTaskDelete: false };
    const undated = { ...fixture.task, date: '', image: '' };
    render(<DayViewSheet isOpen onClose={vi.fn()} selectedDate={new Date(2026, 8, 20)}
      renderMode="backlog" tasks={[undated]} categories={[fixture.category]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Select tasks' }));
    fireEvent.click(screen.getByRole('button', { name: 'Select mocked task' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete selected tasks' }));
    expect(screen.getByText('The selected tasks will be removed from your calendar.')).toBeInTheDocument();
    expect(taskMocks.deleteTask).not.toHaveBeenCalled();
  });

  it('applies the off preference to Backlog task deletion', async () => {
    settingsFixture.values = { confirmTaskDelete: false };
    const undated = { ...fixture.task, date: '', image: '' };
    render(<DayViewSheet isOpen onClose={vi.fn()} selectedDate={new Date(2026, 8, 20)}
      renderMode="backlog" tasks={[undated]} categories={[fixture.category]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open actions' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(taskMocks.deleteTask).toHaveBeenCalledWith('task_1'));
    expect(screen.queryByText('This task will be permanently removed.')).toBeNull();
  });

  // Regression: §2 (optional Today marker in the secondary header row).
  it('shows a Today tag for the active date only when the preference is enabled', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 20, 12));
    settingsFixture.values = { showDayViewTodayTag: true };

    render(
      <DayViewSheet
        isOpen
        onClose={vi.fn()}
        selectedDate={new Date(2026, 8, 20)}
        onDateChange={vi.fn()}
        renderMode="inline"
      />
    );

    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(
      screen.getByText('Sunday, September 20, 2026')
    ).toBeInTheDocument();
  });

  it('opens the warmed Link to Bucket List sheet through task actions', async () => {
    renderSheet();
    fireEvent.click(screen.getByRole('button', { name: 'Open actions' }));
    await act(async () => {
      await import('../../src/components/home/views/LinkTaskToBucketSheet');
      await Promise.resolve();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Link to Bucket List' }));
    expect(await screen.findByRole('dialog', { name: 'Link to Bucket List' })).toBeInTheDocument();
  });

  it('maps unmodified horizontal arrow keys to day navigation while open', () => {
    renderSheet();

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    fireEvent.keyDown(window, { key: 'ArrowRight' });

    expect(swiperFixture.slidePrev).toHaveBeenCalledTimes(1);
    expect(swiperFixture.slideNext).toHaveBeenCalledTimes(1);
  });

  it('category pill toggles day tasks only after entering Select mode', () => {
    renderSheet();
    expect(screen.queryByRole('button', { name: 'Select category tasks' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'More actions for selected tasks' })).toBeNull();
    const select = screen.getAllByRole('button', { name: 'Select tasks' })
      .find(button => button.getAttribute('tabindex') === '0');
    expect(select).toBeDefined();
    fireEvent.click(select as HTMLElement);
    expect(screen.getByRole('button', { name: 'Select category tasks' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'More actions for selected tasks' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Select category tasks' }));
    expect(screen.getByText('1 selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'More actions for selected tasks' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Deselect category tasks' }));
    expect(screen.getByText('0 selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'More actions for selected tasks' })).toBeDisabled();
  });

  it('selects tasks and exposes bulk controls without opening task actions', () => {
    renderSheet();

    const activeSelect = screen.getAllByRole('button', { name: 'Select tasks' })
      .find((button) => button.getAttribute('tabindex') === '0');
    expect(activeSelect).toBeDefined();
    fireEvent.click(activeSelect as HTMLElement);
    expect(screen.getByRole('button', { name: 'Exit selection mode' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'More actions for selected tasks' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Select mocked task' }));
    expect(screen.getByText('1 selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'More actions for selected tasks' })).toBeEnabled();
    expect(screen.queryByText('Visibility')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'More actions for selected tasks' }));
    expect(screen.getByRole('button', { name: 'Change Date' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Do It Today' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Do It Tomorrow' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Visibility' })).toBeInTheDocument();
  });

  it('copies selected task titles to the clipboard and keeps selection active', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', Object.create(navigator, { clipboard: { value: { writeText } } }));
    renderSheet();
    const activeSelect = screen.getAllByRole('button', { name: 'Select tasks' })
      .find((button) => button.getAttribute('tabindex') === '0');
    fireEvent.click(activeSelect as HTMLElement);
    const copyButton = screen.getByRole('button', { name: 'Copy selected tasks' });
    expect(copyButton).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Select mocked task' }));
    expect(copyButton).toBeEnabled();
    fireEvent.click(copyButton);
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('- Task with photo'));
    await waitFor(() => expect(feedbackMocks.show).toHaveBeenCalledWith('1 task copied'));
    expect(screen.getByRole('button', { name: 'Deselect mocked task' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Exit selection mode' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('reports clipboard rejection, retains selection, and supports retry', async () => {
    const writeText = vi.fn().mockRejectedValueOnce(new Error('Denied')).mockResolvedValue(undefined);
    vi.stubGlobal('navigator', Object.create(navigator, { clipboard: { value: { writeText } } }));
    renderSheet();
    fireEvent.click(screen.getAllByRole('button', { name: 'Select tasks' })
      .find((button) => button.getAttribute('tabindex') === '0') as HTMLElement);
    fireEvent.click(screen.getByRole('button', { name: 'Select mocked task' }));
    fireEvent.click(screen.getByRole('button', { name: 'Copy selected tasks' }));
    await waitFor(() => expect(feedbackMocks.show).toHaveBeenCalledWith('Could not copy selected tasks'));
    expect(screen.getByRole('button', { name: 'Deselect mocked task' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Copy selected tasks' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(feedbackMocks.show).toHaveBeenCalledWith('1 task copied'));
  });

  it('reports an unavailable clipboard without clearing selection', async () => {
    vi.stubGlobal('navigator', Object.create(navigator, { clipboard: { value: undefined } }));
    renderSheet();
    fireEvent.click(screen.getAllByRole('button', { name: 'Select tasks' })
      .find((button) => button.getAttribute('tabindex') === '0') as HTMLElement);
    fireEvent.click(screen.getByRole('button', { name: 'Select mocked task' }));
    fireEvent.click(screen.getByRole('button', { name: 'Copy selected tasks' }));
    await waitFor(() => expect(feedbackMocks.show).toHaveBeenCalledWith('Could not copy selected tasks'));
    expect(screen.getByRole('button', { name: 'Deselect mocked task' })).toBeInTheDocument();
  });

  it('moves selected tasks to a chosen category through the bulk action sheet', async () => {
    renderSheet();

    const activeSelect = screen.getAllByRole('button', { name: 'Select tasks' })
      .find((button) => button.getAttribute('tabindex') === '0');
    fireEvent.click(activeSelect as HTMLElement);
    fireEvent.click(screen.getByRole('button', { name: 'Select mocked task' }));
    fireEvent.click(screen.getByRole('button', { name: 'More actions for selected tasks' }));
    fireEvent.click(screen.getByRole('button', { name: 'Move to Category' }));
    fireEvent.click(screen.getByRole('button', { name: 'Personal' }));

    await waitFor(() =>
      expect(taskMocks.moveTasksToCategory).toHaveBeenCalledWith(
        '2026-09-20',
        ['task_1'],
        'cat_2'
      )
    );
    // The bulk picker retains its inert exit layer until dismissal finishes.
    // Users regain the Day View only after that shared animation settles.
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Select tasks' })
        .find((button) => button.getAttribute('tabindex') === '0'))
        .toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('moves multiple selected calendar tasks to Backlogs without recreating them', async () => {
    const second = { ...fixture.task, id: 'task_2', title: 'Second task' };
    render(
      <DayViewSheet
        isOpen
        onClose={vi.fn()}
        selectedDate={new Date(2026, 8, 20)}
        renderMode="inline"
        tasks={[fixture.task, second]}
        categories={[fixture.category, fixture.secondCategory]}
      />
    );

    fireEvent.click(screen.getAllByRole('button', { name: 'Select tasks' })
      .find((button) => button.getAttribute('tabindex') === '0') as HTMLElement);
    fireEvent.click(screen.getByRole('button', { name: 'Select mocked task' }));
    fireEvent.click(screen.getByRole('button', { name: 'Select mocked task task_2' }));
    expect(screen.getByText('2 selected')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'More actions for selected tasks' }));
    fireEvent.click(screen.getByRole('button', { name: 'Move to Backlog' }));

    await waitFor(() => expect(taskMocks.updateTask).toHaveBeenCalledTimes(2));
    expect(taskMocks.updateTask).toHaveBeenCalledWith('task_1', { date: '' });
    expect(taskMocks.updateTask).toHaveBeenCalledWith('task_2', { date: '' });
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Select tasks' })
      .find((button) => button.getAttribute('tabindex') === '0'))
      .toHaveAttribute('aria-pressed', 'false'));
  });

  it('retains only failed tasks selected after a partial Backlogs move', async () => {
    taskMocks.updateTask.mockImplementation(async (id: string) => {
      if (id === 'task_2') throw new Error('offline');
    });
    const second = { ...fixture.task, id: 'task_2', title: 'Second task' };
    render(
      <DayViewSheet isOpen onClose={vi.fn()} selectedDate={new Date(2026, 8, 20)}
        renderMode="inline" tasks={[fixture.task, second]}
        categories={[fixture.category, fixture.secondCategory]} />
    );
    fireEvent.click(screen.getAllByRole('button', { name: 'Select tasks' })
      .find((button) => button.getAttribute('tabindex') === '0') as HTMLElement);
    fireEvent.click(screen.getByRole('button', { name: 'Select mocked task' }));
    fireEvent.click(screen.getByRole('button', { name: 'Select mocked task task_2' }));
    fireEvent.click(screen.getByRole('button', { name: 'More actions for selected tasks' }));
    fireEvent.click(screen.getByRole('button', { name: 'Move to Backlog' }));

    await waitFor(() => expect(feedbackMocks.show).toHaveBeenCalledWith('1 task could not be updated'));
    expect(screen.getByRole('button', { name: 'Select mocked task' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Deselect mocked task task_2' })).toBeInTheDocument();
    expect(taskMocks.updateTask).toHaveBeenCalledTimes(2);
  });

  it('does not offer Move to Backlog when selecting already unscheduled tasks', () => {
    const undated = { ...fixture.task, date: '' };
    render(
      <DayViewSheet isOpen onClose={vi.fn()} selectedDate={new Date(2026, 8, 20)}
        renderMode="backlog" tasks={[undated]} categories={[fixture.category]} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Select tasks' }));
    fireEvent.click(screen.getByRole('button', { name: 'Select mocked task' }));
    fireEvent.click(screen.getByRole('button', { name: 'More actions for selected tasks' }));
    expect(screen.queryByRole('button', { name: 'Move to Backlog' })).toBeNull();
  });

  it('exits inline selection mode on Escape', () => {
    render(
      <DayViewSheet
        isOpen
        onClose={vi.fn()}
        selectedDate={new Date(2026, 8, 20)}
        renderMode="inline"
      />
    );

    const activeSelect = screen.getAllByRole('button', { name: 'Select tasks' })
      .find((button) => button.getAttribute('tabindex') === '0');
    expect(activeSelect).toBeDefined();
    fireEvent.click(activeSelect as HTMLElement);
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.getAllByRole('button', { name: 'Select tasks' }).find((button) => button.getAttribute('tabindex') === '0')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('toolbar')).toHaveStyle({ opacity: '0' });
  });

  // Regression: §2 (date and day arrows share the Day View navigation surface).
  it('places the selected date between the arrows inside the day swiper', () => {
    renderSheet();

    const swiper = screen.getByTestId('day-swiper');
    const date = within(swiper).getByText('Sunday, September 20, 2026');
    const row = date.closest<HTMLElement>('[data-day-view-navigation="true"]');
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByRole('button', { name: 'Previous day' })).toBeInTheDocument();
    expect(within(row as HTMLElement).getByRole('button', { name: 'Next day' })).toBeInTheDocument();
    expect(row).toHaveAttribute('data-bottom-sheet-directional-drag-handle');

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-label', 'Sunday, September 20, 2026');
  });


  // Regression: §16 (Day View keeps Swiper geometry with a bounded render window).
  it('mounts day navigation only inside the rendered swipe window', () => {
    renderSheet();

    expect(
      screen.getAllByRole('button', { name: 'Previous day' })
    ).toHaveLength(1);
    expect(
      screen.getAllByRole('button', { name: 'Next day' })
    ).toHaveLength(1);
  });

  // Regression: §2/§7 (Todo reuses Day View while retaining nested swipe ownership).
  it('supports the same day workspace inline with nested swipe ownership', () => {
    render(
      <DayViewSheet
        isOpen
        onClose={vi.fn()}
        selectedDate={new Date(2026, 8, 20)}
        onDateChange={vi.fn()}
        renderMode="inline"
      />
    );

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByTestId('inline-day-view')).toBeInTheDocument();
    expect(screen.getByTestId('day-swiper')).toBeInTheDocument();
    expect(swiperFixture.nested).toBe(true);
    expect(swiperFixture.noSwiping).toBe(false);
    expect(swiperFixture.touchStartPreventDefault).toBe(false);
    expect(swiperFixture.touchMoveStopPropagation).toBe(false);

    fireEvent.click(screen.getByText('Open actions'));
    expect(screen.getByText('Visibility')).toBeInTheDocument();
  });

  it('uses the same task workspace for undated Backlogs without date navigation', () => {
    const undatedTask = { ...fixture.task, id: 'task_backlog', date: '', image: '' };
    render(
      <DayViewSheet
        isOpen
        onClose={vi.fn()}
        selectedDate={new Date(2026, 8, 20)}
        renderMode="backlog"
        tasks={[fixture.task, undatedTask]}
        categories={[fixture.category, fixture.secondCategory]}
      />
    );

    expect(screen.getByTestId('backlog-day-view')).toBeInTheDocument();
    expect(screen.queryByTestId('day-swiper')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Previous day' })).toBeNull();
    expect(screen.queryByText('Sunday, September 20, 2026')).toBeNull();
    expect(screen.getByText('Open actions')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Open actions'));
    expect(screen.getByText('Schedule')).toBeInTheDocument();
    expect(screen.queryByText('Move to Backlog')).toBeNull();
  });

  // Supplied task/category rendering is covered through the real DaySlide in
  // TodoListIntegration.test.tsx; an "Open actions" smoke assertion here could
  // also pass with fallback hook data and did not establish that contract.

  it.each([
    ['Memo', 'memo-sheet'],
    ['Add Photo', 'image-picker-sheet'],
    ['Visibility', 'visibility-sheet'],
  ])('opens %s without falling back to the bare day sheet', (label, testId) => {
    fixture.task.image = label === 'Add Photo' ? '' : 'image_1';

    renderSheet();
    fireEvent.click(screen.getByText('Open actions'));
    fireEvent.click(screen.getByText(label));

    expect(screen.getByTestId(testId)).toBeInTheDocument();
    expect(
      document.querySelector('[role="dialog"][aria-hidden="true"]')
    ).not.toBeNull();
  });

  it('shows a calendar on the first Change Date tap inside the existing task sheet', () => {
    renderSheet();
    fireEvent.click(screen.getByText('Open actions'));
    fireEvent.click(screen.getByText('Change Date'));
    expect(screen.getByRole('group', { name: 'Calendar dates' })).toBeInTheDocument();
    expect(screen.getByText('Confirm Date')).toBeInTheDocument();
    expect(screen.queryByTestId('date-sheet')).toBeNull();
  });

  it('opens the image viewer from the View Photo action', async () => {
    fixture.task.image = 'image_1';
    renderSheet();

    fireEvent.click(screen.getByText('Open actions'));
    fireEvent.click(screen.getByText('View Photo'));

    await waitFor(
      () => expect(screen.getByTestId('image-viewer')).toBeInTheDocument(),
      { timeout: 5000 }
    );
  });
});

describe('Day View first category onboarding', () => {
  const ownerProps = {
    isOpen: true,
    onClose: vi.fn(),
    selectedDate: new Date(2026, 8, 20),
    renderMode: 'inline' as const,
    tasks: [] as TaskDocument[],
    categories: [] as CategoryDocument[],
  };
  beforeEach(() => {
    settingsFixture.values = {};
    firstCategoryFixture.categories = [];
    firstCategoryFixture.loading = false;
    firstCategoryFixture.addCategory.mockReset().mockResolvedValue(undefined);
  });

  it('offers one category creation flow in the active owner day and uses local-first addCategory', async () => {
    const { rerender } = render(<DayViewSheet {...ownerProps} />);
    expect(screen.getAllByRole('button', { name: 'Add category' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Add category' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Category name' }), {
      target: { value: '  Study  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add Category' }));
    await waitFor(() => expect(firstCategoryFixture.addCategory).toHaveBeenCalledWith({
      name: 'Study', color: '#3B82F6', visibility: 'private', order: 0, icon: '',
    }));
    firstCategoryFixture.categories = [fixture.category];
    rerender(<DayViewSheet {...ownerProps} categories={[fixture.category]} />);
    expect(screen.queryByRole('button', { name: 'Add category' })).toBeNull();
  });

  it('shows a repeatable footer for populated owner categories only when enabled', async () => {
    firstCategoryFixture.categories = [fixture.category, fixture.secondCategory];
    const { rerender } = render(<DayViewSheet {...ownerProps}
      categories={[fixture.category, fixture.secondCategory]} />);
    expect(screen.queryByRole('button', { name: 'Add category' })).toBeNull();
    settingsFixture.values = { showAddCategoryInDayView: true };
    rerender(<DayViewSheet {...ownerProps} categories={[fixture.category, fixture.secondCategory]} />);
    expect(screen.getAllByRole('button', { name: 'Add category' })).toHaveLength(1);
    expect(screen.queryByText('No categories yet')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add category' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Category name' }), {
      target: { value: '  Extra  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add Category' }));
    await waitFor(() => expect(firstCategoryFixture.addCategory).toHaveBeenCalledWith({
      name: 'Extra', color: '#3B82F6', visibility: 'private', order: 2, icon: '',
    }));
    expect(await screen.findByRole('button', { name: 'Add category' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Add category' }));
    expect(screen.getByRole('textbox', { name: 'Category name' })).toHaveValue('');
  });

  it('uses only one bottom action for an empty owner and hides it in select mode or another user view', () => {
    settingsFixture.values = { showAddCategoryInDayView: true };
    const { rerender } = render(<DayViewSheet {...ownerProps} />);
    expect(screen.getAllByRole('button', { name: 'Add category' })).toHaveLength(1);
    expect(screen.queryByText('No categories yet')).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: 'Select tasks' })
      .find(button => button.getAttribute('tabindex') === '0') as HTMLElement);
    expect(screen.queryByRole('button', { name: 'Add category' })).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: 'Exit selection mode' })
      .find(button => button.getAttribute('tabindex') === '0') as HTMLElement);
    expect(screen.getByRole('button', { name: 'Add category' })).toBeVisible();
    rerender(<DayViewSheet {...ownerProps} categories={[{ ...fixture.category, userId: 'other_user' }]} />);
    expect(screen.queryByRole('button', { name: 'Add category' })).toBeNull();
  });

  it('does not show first-category CTA before owner categories hydrate or in Backlogs', () => {
    settingsFixture.values = { showAddCategoryInDayView: true };
    firstCategoryFixture.loading = true;
    const { rerender } = render(<DayViewSheet {...ownerProps} />);
    expect(screen.queryByRole('button', { name: 'Add category' })).toBeNull();
    firstCategoryFixture.loading = false;
    rerender(<DayViewSheet {...ownerProps} renderMode="backlog" />);
    expect(screen.queryByRole('button', { name: 'Add category' })).toBeNull();
  });

  it('offers the same flow when Diary is enabled and in Timeline mode', async () => {
    settingsFixture.values = { dayViewMode: 'timeline' };
    render(<DayViewSheet {...ownerProps} showDiaryAlways />);
    expect(await screen.findByRole('button', { name: 'Add category' }, { timeout: 5000 })).toBeVisible();
  });

  it('keeps the timeline footer action after existing categories when enabled', async () => {
    firstCategoryFixture.categories = [fixture.category];
    settingsFixture.values = { dayViewMode: 'timeline', showAddCategoryInDayView: true };
    render(<DayViewSheet {...ownerProps} showDiaryAlways categories={[fixture.category]} />);
    expect(await screen.findByRole('button', { name: 'Add category' }, { timeout: 5000 })).toBeVisible();
    expect(screen.queryByText('No categories yet')).toBeNull();
  });
});
