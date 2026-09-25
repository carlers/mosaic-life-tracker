// Regression: UIFIX-5/UIFIX-7/UIFIX-8/UIFIX-9 — day-sheet header and nested task surfaces retain context.
import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

const fixture = vi.hoisted(() => ({
  task: {
    id: 'task_1',
    title: 'Task with photo',
    completed: false,
    categoryId: 'cat_1',
    date: '2026-09-20',
    createdAt: '2026-09-20T00:00:00.000Z',
    updatedAt: '2026-09-20T00:00:00.000Z',
    userId: 'user_1',
    isDeleted: false,
    visibility: '',
    memo: '',
    image: 'image_1',
  } as TaskDocument,
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
  }: {
    tasks: TaskDocument[];
    onOpenActions: (task: TaskDocument) => void;
  }) =>
    tasks.length > 0 ? (
      <button onClick={() => onOpenActions(tasks[0])}>Open actions</button>
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
  }),
}));

vi.mock('../../src/hooks/useCategories', () => ({
  useCategories: () => ({ categories: [fixture.category] }),
}));

vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({ user: { $id: 'user_1' } }),
}));

vi.mock('../../src/hooks/useFeedback', () => ({
  useFeedback: () => ({ message: null }),
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
    />
  );
}

describe('DayViewSheet nested task actions', () => {
  beforeEach(() => {
    fixture.task.image = 'image_1';
    swiperFixture.slidePrev.mockClear();
    swiperFixture.slideNext.mockClear();
    swiperFixture.slideTo.mockClear();
    swiperFixture.nested = undefined;
    swiperFixture.noSwiping = undefined;
    swiperFixture.touchStartPreventDefault = undefined;
    swiperFixture.touchMoveStopPropagation = undefined;
  });

  it('maps unmodified horizontal arrow keys to day navigation while open', () => {
    renderSheet();

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    fireEvent.keyDown(window, { key: 'ArrowRight' });

    expect(swiperFixture.slidePrev).toHaveBeenCalledTimes(1);
    expect(swiperFixture.slideNext).toHaveBeenCalledTimes(1);
  });

  // Regression: task acceptance — date + arrows share the horizontal day-swipe surface.
  it('places the selected date between the arrows inside the day swiper', () => {
    renderSheet();

    const swiper = screen.getByTestId('day-swiper');
    const date = within(swiper).getByText('Sunday, September 20, 2026');
    const row = date.parentElement;
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByRole('button', { name: 'Previous day' })).toBeInTheDocument();
    expect(within(row as HTMLElement).getByRole('button', { name: 'Next day' })).toBeInTheDocument();
    expect(row).toHaveAttribute('data-bottom-sheet-directional-drag-handle');
    expect(date).toHaveClass('text-base');
    expect(row).not.toHaveClass('swiper-no-swiping');

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-label', 'Sunday, September 20, 2026');
  });

  // Regression: PROJECT_REFERENCE.md §2 — non-Swiper sheet chrome keeps the release fallback, while the date row stays native direct-manipulation.
  it('keeps the sheet-handle fallback without double-driving the Swiper-owned date row', () => {
    renderSheet();

    const dialog = screen.getByRole('dialog');
    const sheetHandle = dialog.firstElementChild as HTMLElement | null;
    expect(sheetHandle).not.toBeNull();

    fireEvent.pointerDown(sheetHandle as HTMLElement, {
      pointerId: 1,
      clientX: 300,
      clientY: 20,
    });
    fireEvent.pointerUp(sheetHandle as HTMLElement, {
      pointerId: 1,
      clientX: 80,
      clientY: 24,
    });
    expect(swiperFixture.slideNext).toHaveBeenCalledTimes(1);

    swiperFixture.slideNext.mockClear();
    const date = within(screen.getByTestId('day-swiper')).getByText(
      'Sunday, September 20, 2026'
    );
    const dateRow = date.parentElement as HTMLElement | null;
    expect(dateRow).not.toBeNull();
    expect(dateRow).toHaveAttribute(
      'data-bottom-sheet-directional-drag-handle'
    );
    expect(dateRow).not.toHaveClass('swiper-no-swiping');

    // The DOM mock cannot reproduce Swiper's native touch engine. Ownership
    // is pinned structurally here and direct manipulation is covered by the
    // Playwright interaction contract.
    expect(dateRow).not.toHaveClass('touch-none');
    expect(swiperFixture.slideNext).not.toHaveBeenCalled();
  });

  // Regression: PROJECT_REFERENCE.md §2 — sheet-mode Swiper fills the fixed content body so blank lower space stays swipeable.
  it('fills the sheet content height with the native day swipe surface', () => {
    renderSheet();

    expect(screen.getByTestId('day-sheet-swipe-surface')).toHaveClass(
      'flex',
      'h-full',
      'min-h-0',
      'flex-col'
    );
    expect(screen.getByTestId('day-swiper')).toHaveClass('flex-1');
  });

  // Regression: PROJECT_REFERENCE.md §2/§7 — Todo reuses DayView inline while owning nested swipes.
  it('supports the same day workspace inline with nested swipe ownership and bounded width', () => {
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
    expect(screen.getByTestId('inline-day-view')).toHaveClass('min-w-0');
    expect(screen.getByTestId('inline-day-view')).toHaveClass('overflow-x-hidden');
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
