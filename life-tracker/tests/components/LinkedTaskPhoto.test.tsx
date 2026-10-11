import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TaskDocument } from '../../src/db/schema';

const photoMock = vi.hoisted(() => ({
  shouldLoad: true,
  loading: false,
  unavailable: false,
  calls: [] as Array<{ fileId: string | undefined; enabled: boolean }>,
}));
vi.mock('../../src/hooks/useImageLoadGate', () => ({
  useImageLoadGate: () => ({
    targetRef: () => {},
    shouldLoad: photoMock.shouldLoad,
  }),
}));
vi.mock('../../src/hooks/useTaskImage', () => ({
  useTaskImage: (fileId: string | undefined, enabled: boolean) => {
    photoMock.calls.push({ fileId, enabled });
    return {
      imageUrl: enabled && fileId && !photoMock.unavailable && !photoMock.loading ? `blob:${fileId}` : null,
      isLoading: enabled && photoMock.loading,
    };
  },
}));
import { LinkedTaskPhoto } from '../../src/pages/LinkedTaskPhoto';

const task: TaskDocument = {
  id: 'task_photo_one',
  title: 'Explore Kyoto',
  categoryId: 'travel',
  date: '2026-10-11',
  completed: false,
  order: 0,
  image: 'file_photo_one',
  createdAt: '2026-10-11T01:00:00.000Z',
  updatedAt: '2026-10-11T01:00:00.000Z',
  isDeleted: false,
  userId: 'owner',
  visibility: 'private',
};

describe('Bucket List linked task photo preview', () => {
  beforeEach(() => {
    photoMock.shouldLoad = true;
    photoMock.loading = false;
    photoMock.unavailable = false;
    photoMock.calls = [];
  });

  it('loads the canonical task image using the existing hook and opens that task on photo tap', () => {
    const onView = vi.fn();
    const { container } = render(<LinkedTaskPhoto task={task} onView={onView} />);
    expect(screen.getByRole('button', { name: 'View photo for Explore Kyoto' })).toBeInTheDocument();
    expect(container.querySelector('img')).toHaveAttribute('src', 'blob:file_photo_one');
    expect(photoMock.calls).toContainEqual({ fileId: 'file_photo_one', enabled: true });

    fireEvent.click(screen.getByRole('button', { name: 'View photo for Explore Kyoto' }));
    expect(onView).toHaveBeenCalledExactlyOnceWith(task);
  });

  it('does not render a photo control for tasks without an attachment', () => {
    render(<LinkedTaskPhoto task={{ ...task, image: '' }} onView={vi.fn()} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(document.querySelector('img')).toBeNull();
  });

  it('defers image acquisition until the row nears the viewport', () => {
    photoMock.shouldLoad = false;
    render(<LinkedTaskPhoto task={task} onView={vi.fn()} />);
    expect(photoMock.calls).toContainEqual({ fileId: 'file_photo_one', enabled: false });
    expect(screen.queryByRole('button', { name: /View photo/ })).toBeNull();
  });

  it('shows an accessible unavailable state rather than a dead photo button', () => {
    photoMock.unavailable = true;
    render(<LinkedTaskPhoto task={task} onView={vi.fn()} />);
    expect(screen.getByRole('status', { name: 'Photo unavailable for Explore Kyoto' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /View photo/ })).toBeNull();
  });

  it('renders a loading placeholder without opening a broken viewer', () => {
    photoMock.loading = true;
    render(<LinkedTaskPhoto task={task} onView={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /View photo/ })).toBeNull();
    expect(screen.queryByRole('status', { name: /unavailable/ })).toBeNull();
  });

  it('tracks the original task image when a synced attachment is replaced', () => {
    const onView = vi.fn();
    const { rerender, container } = render(<LinkedTaskPhoto task={task} onView={onView} />);
    const changed = { ...task, image: 'file_photo_two', title: 'Explore Osaka' };
    rerender(<LinkedTaskPhoto task={changed} onView={onView} />);
    expect(screen.getByRole('button', { name: 'View photo for Explore Osaka' })).toBeInTheDocument();
    expect(container.querySelector('img')).toHaveAttribute('src', 'blob:file_photo_two');
    fireEvent.click(screen.getByRole('button', { name: 'View photo for Explore Osaka' }));
    expect(onView).toHaveBeenCalledExactlyOnceWith(changed);
  });
});
