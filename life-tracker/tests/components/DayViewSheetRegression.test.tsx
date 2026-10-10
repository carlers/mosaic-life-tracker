// Regression: §2/§13 (Day View header and nested sheet context).
import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
}));

const feedbackMocks = vi.hoisted(() => ({ show: vi.fn() }));

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
  }: {
    tasks: TaskDocument[];
    onOpenActions: (task: TaskDocument) => void;
    selectionMode?: boolean;
    selectedTaskIds?: ReadonlySet<string>;
    onToggleTaskSelection?: (taskId: string) => void;
  }) =>
    tasks.length > 0 ? (
      <button onClick={() => selectionMode ? onToggleTaskSelection?.(tasks[0].id) : onOpenActions(tasks[0])}>
        {selectionMode ? `${selectedTaskIds?.has(tasks[0].id) ? 'Deselect' : 'Select'} mocked task` : 'Open actions'}
      </button>
    ) : null,
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

vi.mock('../../src/components/home/views/ImageViewer', () => ({
  ImageViewer: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="image-viewer">Image viewer</div> : null,
}));

vi.mock('../../src/hooks/useTasks', () => ({
  useTasks: () => ({
    tasks: [fixture.task],
    addTask: vi.fn(),
    toggleTaskCompletion: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
    reorderTasks: vi.fn(),
    moveTasksToCategory: taskMocks.moveTasksToCategory,
  }),
}));

vi.mock('../../src/hooks/useCategories', () => ({
  useCategories: () => ({ categories: [fixture.category, fixture.secondCategory] }),
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
  return render(
    <DayViewSheet
      isOpen
      onClose={vi.fn()}
      selectedDate={new Date(2026, 8, 20)}
      onDateChange={vi.fn()}
      deferContentUntilAnimationComplete={false}
    />
  );
}

describe('DayViewSheet nested task actions', () => {
  beforeEach(() => {
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
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
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

  it('maps unmodified horizontal arrow keys to day navigation while open', () => {
    renderSheet();

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    fireEvent.keyDown(window, { key: 'ArrowRight' });

    expect(swiperFixture.slidePrev).toHaveBeenCalledTimes(1);
    expect(swiperFixture.slideNext).toHaveBeenCalledTimes(1);
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

  // Supplied task/category rendering is covered through the real DaySlide in
  // TodoListIntegration.test.tsx; an "Open actions" smoke assertion here could
  // also pass with fallback hook data and did not establish that contract.

  it.each([
    ['Memo', 'memo-sheet'],
    ['Add Photo', 'image-picker-sheet'],
    ['Change Date', 'date-sheet'],
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
