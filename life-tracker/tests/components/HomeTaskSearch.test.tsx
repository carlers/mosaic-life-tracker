import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { HomeTaskSearch } from '../../src/components/home/HomeTaskSearch';
import type { CategoryDocument, TaskDocument } from '../../src/db/schema';

// Regression: §2 (Home search is owner-only, local, filterable, and selectable).

const categories: CategoryDocument[] = [
  {
    id: 'work',
    name: 'Work',
    color: '#3B82F6',
    order: 0,
    visibility: 'private',
    userId: 'user_A',
    isDeleted: false,
    updatedAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'life',
    name: 'Life',
    color: '#10B981',
    order: 1,
    visibility: 'private',
    userId: 'user_A',
    isDeleted: false,
    updatedAt: '2026-09-01T00:00:00.000Z',
  },
];

function task(
  id: string,
  title: string,
  date: string,
  categoryId: string,
  extras: Partial<TaskDocument> = {}
): TaskDocument {
  return {
    id,
    title,
    completed: false,
    categoryId,
    order: 0,
    date:
    createdAt: `${date}T00:00:00.000Z`,
    updatedAt: `${date}T00:00:00.000Z`,
    userId: 'user_A',
    isDeleted: false,
    visibility: 'private',
    ...extras,
  };
}

const tasks: TaskDocument[] = [
  task('launch', 'Plan launch', '2026-09-24', 'work', {
    memo: 'Checklist',
    image: 'image_1',
  }),
  task('walk', 'Evening walk', '2026-09-24', 'life', { completed: true }),
  task('review', 'Review plan', '2026-09-25', 'work'),
];

function renderSearch(
  overrides: Partial<React.ComponentProps<typeof HomeTaskSearch>> = {}
) {
  const props: React.ComponentProps<typeof HomeTaskSearch> = {
    isOpen: true,
    tasks,
    categories,
    now: new Date('2026-09-24T12:00:00'),
    onOpen: vi.fn(),
    onClose: vi.fn(),
    onSelectTask: vi.fn(),
    trailing: <button type="button">Menu</button>,
    ...overrides,
  };
  return { ...render(<HomeTaskSearch {...props} />), props };
}

describe('HomeTaskSearch', () => {
  it('opens from a named Search button when collapsed', () => {
    const onOpen = vi.fn();
    renderSearch({ isOpen: false, onOpen });
    fireEvent.click(screen.getByRole('button', { name: 'Search tasks' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('closes when the blurred backdrop is tapped', () => {
    const onClose = vi.fn();
    renderSearch({ onClose });

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss search overlay' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows guidance until a query/filter exists, then renders metadata icons and selects the task', async () => {
    const onSelectTask = vi.fn();
    renderSearch({ onSelectTask });

    expect(
      screen.getByText('Search by task title or choose a filter.')
    ).toBeInTheDocument();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search my tasks' }), {
      target: { value: 'plan' },
    });

    const launch = await screen.findByRole('button', { name: /Open task Plan launch/i });
    expect(within(launch).getByText('Work')).toBeInTheDocument();
    expect(within(launch).getByRole('img', { name: 'Has memo' })).toBeInTheDocument();
    expect(within(launch).getByRole('img', { name: 'Has image' })).toBeInTheDocument();

    fireEvent.click(launch);
    expect(onSelectTask).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'launch' })
    );
  });

  it('supports category and date filtering without requiring a text query', async () => {
    renderSearch();

    fireEvent.click(screen.getByRole('button', { name: 'Life' }));
    fireEvent.click(screen.getByRole('button', { name: 'Today' }));

    expect(
      await screen.findByRole('button', { name: /Open task Evening walk/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Open task Plan launch/i })
    ).toBeNull();
    expect(screen.getByRole('img', { name: 'Completed' })).toBeInTheDocument();
  });
});
