import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskBlock } from '../../src/components/home/views/TaskBlock';
import type { TaskDocument } from '../../src/db/schema';

const gates = vi.hoisted(() => ({
  imageGate: vi.fn(() => ({ targetRef: () => {}, shouldLoad: true })),
  taskImage: vi.fn(() => ({ imageUrl: null, isLoading: true })),
}));
vi.mock('../../src/hooks/useImageLoadGate', () => ({
  useImageLoadGate: gates.imageGate,
}));
vi.mock('../../src/hooks/useTaskImage', () => ({
  useTaskImage: gates.taskImage,
}));

const makeTask = (image?: string): TaskDocument => ({
  id: 'one', userId: 'owner', title: 'Visible preview',
  date: '2026-10-17', categoryId: 'work', order: 0,
  completed: false, createdAt: '2026-10-17T00:00:00.000Z',
  updatedAt: '2026-10-17T00:00:00.000Z', isDeleted: false,
  visibility: 'private', ...(image ? { image } : {}),
});

describe('Calendar task image isolation', () => {
  beforeEach(() => { gates.imageGate.mockClear(); gates.taskImage.mockClear(); });

  it('keeps text-only task previews without allocating an image load gate', () => {
    render(<TaskBlock task={makeTask()} categoryColor="#245678" />);
    expect(screen.getByText('Visible preview')).toBeInTheDocument();
    expect(gates.imageGate).not.toHaveBeenCalled();
    expect(gates.taskImage).not.toHaveBeenCalled();
  });

  it('loads image-bearing previews lazily without losing the task title', () => {
    render(<TaskBlock task={makeTask('file-image-id')} categoryColor="#245678" />);
    expect(screen.getByText('Visible preview')).toBeInTheDocument();
    expect(gates.imageGate).toHaveBeenCalledTimes(1);
    expect(gates.taskImage).toHaveBeenCalledWith('file-image-id', true);
  });
});
