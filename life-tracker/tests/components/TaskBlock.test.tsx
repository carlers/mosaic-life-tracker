import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { TaskDocument } from '../../src/db/schema';

vi.mock('../../src/hooks/useImageLoadGate', () => ({
  useImageLoadGate: () => ({
    targetRef: { current: null },
    shouldLoad: true,
  }),
}));

vi.mock('../../src/hooks/useTaskImage', () => ({
  useTaskImage: () => ({
    imageUrl: 'blob:task-image',
    isLoading: false,
  }),
}));

import { TaskBlock } from '../../src/components/home/views/TaskBlock';

const task: TaskDocument = {
  id: 'task_photo',
  title: 'Photo task',
  completed: false,
  categoryId: 'work',
  date: '2026-09-23',
  createdAt: '2026-09-23T00:00:00.000Z',
  completedAt: '',
  updatedAt: '2026-09-23T00:00:00.000Z',
  userId: 'user_1',
  isDeleted: false,
  visibility: 'private',
  image: 'image_1',
};

describe('TaskBlock image layout', () => {
  // Regression: PROJECT_REFERENCE.md §2 — Calendar task images span the full block width instead of inheriting title padding.
  it('keeps title padding separate from the edge-to-edge image thumbnail', () => {
    const { container } = render(
      <TaskBlock task={task} categoryColor="#3B82F6" />
    );

    const block = container.firstElementChild;
    expect(block).not.toBeNull();
    expect(block).not.toHaveClass('px-1');
    expect(screen.getByText('Photo task')).toHaveClass('px-1');

    const image = container.querySelector('img');
    expect(image).not.toBeNull();
    expect(image?.parentElement).toHaveClass('w-full');
  });
});
