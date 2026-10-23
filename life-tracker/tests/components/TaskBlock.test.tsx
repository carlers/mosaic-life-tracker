import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TaskBlock } from '../../src/components/home/views/TaskBlock';
import { IncompleteTaskBlockColorContext } from '../../src/hooks/incompleteTaskBlockColorContext';
import type { TaskDocument } from '../../src/db/schema';

vi.mock('../../src/hooks/useImageLoadGate', () => ({
  useImageLoadGate: () => ({ targetRef: () => {}, shouldLoad: true }),
}));
vi.mock('../../src/hooks/useTaskImage', () => ({
  useTaskImage: () => ({
    imageUrl: 'data:image/png;base64,AA==',
    isLoading: false,
  }),
}));

const task: TaskDocument = {
  id: 'test_task', title: 'A long calendar task title', date: '2026-10-18',
  categoryId: 'cat', userId: 'user', completed: false, order: 0,
  createdAt: '2026-10-18T00:00:00.000Z',
  updatedAt: '2026-10-18T00:00:00.000Z',
  completedAt: '', visibility: 'private', isDeleted: false,
};

describe('Calendar TaskBlock previews', () => {
  it('preserves full hover title and hard-clipped visible text for text-only tasks', () => {
    const { container } = render(
      <TaskBlock task={task} categoryColor="#DD3355" />
    );
    const preview = container.querySelector('[title="A long calendar task title"]');
    expect(preview).not.toBeNull();
    expect(preview).toHaveTextContent(task.title);
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('preserves category-color completion semantics and unchanged text in category mode', () => {
    const { container, rerender } = render(
      <IncompleteTaskBlockColorContext.Provider value="text">
        <TaskBlock task={task} categoryColor="#DD3355" />
      </IncompleteTaskBlockColorContext.Provider>
    );
    expect(container.querySelector('[title]')).toHaveTextContent(task.title);
    rerender(
      <IncompleteTaskBlockColorContext.Provider value="text">
        <TaskBlock task={{ ...task, completed: true }} categoryColor="#DD3355" />
      </IncompleteTaskBlockColorContext.Provider>
    );
    expect(container.querySelector('[title]')).toHaveTextContent(task.title);
  });

  it('retains real thumbnail and shared-task marker on the rich preview path', () => {
    const { container } = render(
      <TaskBlock task={{ ...task, image: 'image_1' }} categoryColor="#DD3355" isShared />
    );
    expect(container.querySelector('img')?.getAttribute('src')).toBe('data:image/png;base64,AA==');
    expect(container.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(container.querySelector('[title]')).toHaveTextContent(task.title);
  });
});
