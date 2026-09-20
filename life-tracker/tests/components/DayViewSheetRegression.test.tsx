// Regression: pre-Phase-4 UI bug batch — task actions must transition to sibling sheets without losing task context.
import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CategoryDocument, TaskDocument } from '../../src/db/schema';

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
  }: {
    children: ReactNode;
    onSwiper?: (swiper: unknown) => void;
  }) => {
    onSwiper?.({
      activeIndex: 90,
      slideTo: vi.fn(),
      slidePrev: vi.fn(),
      slideNext: vi.fn(),
    });
    return <div data-testid="day-swiper">{children}</div>;
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
  });

  it('renders the selected date in the draggable sheet header', () => {
    renderSheet();
    const dialog = screen.getByRole('dialog');
    const labelledBy = dialog.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    expect(document.getElementById(labelledBy as string)).toHaveTextContent(
      'Sunday, September 20, 2026'
    );
  });

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

    await waitFor(() =>
      expect(screen.getByTestId('image-viewer')).toBeInTheDocument()
    );
  });
});
