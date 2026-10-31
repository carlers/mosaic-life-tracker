import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { TaskDocument } from '../../src/db/schema';
import { TaskItem } from '../../src/components/home/views/TaskItem';

vi.mock('../../src/hooks/useImageLoadGate', () => ({
  useImageLoadGate: () => ({ targetRef: vi.fn(), shouldLoad: true }),
}));
vi.mock('../../src/hooks/useTaskImage', () => ({
  useTaskImage: () => ({
    imageUrl: 'data:image/png;base64,iVBORw0KGgo=',
    isLoading: false,
    retryImage: vi.fn(),
    handleImageError: vi.fn(),
  }),
}));

describe('TaskItem task photo', () => {
  it('prevents native browser image dragging while keeping photo activation', () => {
    const task = {
      id: 'task-photo',
      title: 'Task photo',
      image: 'photo-id',
      memo: '',
      reactions: '',
      completed: false,
      updatedAt: '2026-09-15T00:00:00.000Z',
    } as unknown as TaskDocument;
    const onViewImage = vi.fn();
    render(
      <TaskItem
        task={task}
        categoryColor="#888888"
        currentUserId="user_1"
        onToggle={vi.fn()}
        onOpenActions={vi.fn()}
        onOpenMemo={vi.fn()}
        onEditStart={vi.fn()}
        onViewImage={onViewImage}
        isEditing={false}
        editValue=""
        onEditChange={vi.fn()}
        onEditSave={vi.fn()}
        onEditCancel={vi.fn()}
        disableLayoutAnimation
      />,
    );
    const image = screen.getByRole('img', { name: 'Task photo' });
    expect(image).toHaveAttribute('draggable', 'false');
    const dragStart = new Event('dragstart', { bubbles: true, cancelable: true });
    expect(image.dispatchEvent(dragStart)).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'View image' }));
    expect(onViewImage).toHaveBeenCalledWith(task);
  });
});
