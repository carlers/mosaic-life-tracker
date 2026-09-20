// Regression: pre-Phase-4 UI bug batch — day-view task images stay responsive and rectangular.
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { TaskDocument } from '../../src/db/schema';

vi.mock('../../src/hooks/useImageLoadGate', () => ({
  useImageLoadGate: () => ({
    targetRef: () => {},
    shouldLoad: true,
  }),
}));

vi.mock('../../src/hooks/useTaskImage', () => ({
  useTaskImage: () => ({
    imageUrl: 'blob:task-image',
    isLoading: false,
  }),
}));

import { TaskItem } from '../../src/components/home/views/TaskItem';

const task: TaskDocument = {
  id: 'task_1',
  title: 'Photo task',
  completed: false,
  categoryId: 'cat_1',
  date: '2026-09-20',
  createdAt: '2026-09-20T00:00:00.000Z',
  updatedAt: '2026-09-20T00:00:00.000Z',
  userId: 'user_1',
  isDeleted: false,
  visibility: '',
  image: 'image_1',
};

describe('TaskItem image layout', () => {
  it('fills the available day-sheet width using a responsive landscape aspect ratio', () => {
    render(
      <TaskItem
        task={task}
        categoryColor="#3B82F6"
        currentUserId="user_1"
        onToggle={vi.fn()}
        onOpenActions={vi.fn()}
        onOpenMemo={vi.fn()}
        onViewImage={vi.fn()}
        isEditing={false}
        editValue=""
        onEditChange={vi.fn()}
        onEditSave={vi.fn()}
        onEditCancel={vi.fn()}
      />
    );

    const imageButton = screen.getByRole('button', { name: 'View image' });
    expect(imageButton).toHaveClass('w-full', 'aspect-[16/9]', 'max-h-64');
    expect(screen.getByRole('img', { name: 'Photo task' })).toHaveClass(
      'w-full',
      'h-full',
      'object-cover'
    );
  });
});
