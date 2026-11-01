import React from 'react';
import type { DiaryDocument } from '../../src/db/schema';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const featureFlags = vi.hoisted(() => new Set<string>());
const operations = vi.hoisted(() => ({
  setAchieved: vi.fn(async () => undefined),
  setLinked: vi.fn(async () => undefined),
  addTask: vi.fn(async () => 'step2'),
}));
vi.mock('../../src/hooks/useFeatureEnabled', () => ({
  useFeatureEnabled: (flag: string) => !featureFlags.has(flag),
}));
vi.mock('../../src/lib/featureControls', () => ({
  isFeatureEnabled: (flag: string) => !featureFlags.has(flag),
}));
vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({ user: { $id: 'owner' } }),
}));
vi.mock('../../src/hooks/useBucketList', () => ({
  useBucketList: () => ({
    items: [{ id: 'goal1', title: 'Learn new skills', description: '', achieved: false, achievedAt: '' }],
    editItem: vi.fn(), deleteItem: vi.fn(), setAchieved: operations.setAchieved,
  }),
}));
vi.mock('../../src/hooks/useBucketTaskLinks', () => ({
  useBucketTaskLinks: () => ({
    links: [{ bucketListId: 'goal1', taskId: 'step1' }],
    setLinked: operations.setLinked,
  }),
}));
vi.mock('../../src/hooks/useTasks', () => ({
  useTasks: () => ({
    tasks: [{ id: 'step1', title: 'Existing linked step', categoryId: 'cat1',
      date: '', completed: false, isDeleted: false }],
    addTask: operations.addTask,
    toggleTaskCompletion: vi.fn(async () => undefined),
  }),
}));
vi.mock('../../src/hooks/useCategories', () => ({
  useCategories: () => ({
    categories: [{ id: 'cat1', name: 'Personal', color: '#888888', isDeleted: false }],
  }),
}));
vi.mock('../../src/hooks/useTaskImage', () => ({
  useTaskImage: () => ({ imageUrl: null, isLoading: false }),
}));
vi.mock('../../src/components/ui/BottomSheet', () => ({
  BottomSheet: ({ children, isOpen }: { children: React.ReactNode; isOpen: boolean }) =>
    isOpen ? <div>{children}</div> : null,
}));
vi.mock('../../src/components/ui/ConfirmSheet', () => ({
  ConfirmSheet: () => null,
}));
vi.mock('../../src/lib/friendData', () => ({
  fetchOwnerDiaryReactions: vi.fn(async () => []),
}));
import { BucketListDetailPage } from '../../src/pages/BucketListDetailPage';
import { DiaryEntrySheet } from '../../src/components/home/views/DiaryEntrySheet';

const bucketPage = () => (
  <MemoryRouter initialEntries={['/bucket-list/goal1']}>
    <Routes>
      <Route path="/bucket-list/:id" element={<BucketListDetailPage />} />
    </Routes>
  </MemoryRouter>
);

beforeEach(() => {
  featureFlags.clear();
  operations.setLinked.mockClear();
  operations.setAchieved.mockClear();
  operations.addTask.mockClear();
});

describe('non-destructive Diary and Bucket List controls', () => {
  it('pauses new Bucket List steps, linking and achievement while retaining existing steps and unlink', () => {
    featureFlags.add('mosaic_disable_bucket_step_creation');
    featureFlags.add('mosaic_disable_bucket_step_linking');
    featureFlags.add('mosaic_disable_bucket_achievement');
    const { rerender } = render(bucketPage());
    expect(screen.getByText('Existing linked step')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Unlink Existing linked step' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: /New task/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Link existing/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'I lived it' })).not.toBeInTheDocument();
    featureFlags.clear();
    rerender(bucketPage());
    expect(screen.getByRole('button', { name: /New task/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Link existing/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'I lived it' })).toBeEnabled();
    expect(operations.setLinked).not.toHaveBeenCalled();
    expect(operations.setAchieved).not.toHaveBeenCalled();
    expect(operations.addTask).not.toHaveBeenCalled();
  });

  it('pauses optional Diary emoji selection without hiding entry editing', () => {
    featureFlags.add('mosaic_disable_diary_emoji_picker');
    const props = {
      date: '2026-11-02', author: 'Me', isOpen: true,
      onClose: vi.fn(), onSave: vi.fn(async () => undefined),
    };
    const { rerender } = render(<DiaryEntrySheet {...props} />);
    expect(screen.queryByRole('button', { name: 'Choose diary emoji' })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Diary text' })).toBeInTheDocument();
    featureFlags.clear();
    rerender(<DiaryEntrySheet {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Choose diary emoji' }));
    expect(screen.getByRole('group', { name: 'Choose an emoji' })).toBeInTheDocument();
    expect(props.onSave).not.toHaveBeenCalled();
  });

  it('suppresses Diary social reactions and replies in global solo mode without hiding the entry', () => {
    featureFlags.add('mosaic_disable_all_social');
    const entry = {
      id: 'diary1', userId: 'owner', date: '2026-11-02',
      content: 'Today was productive', visibility: 'private', emoji: '📖', photos: '', reactions: '',
    };
    render(<DiaryEntrySheet date="2026-11-02" author="Me" isOpen
      entry={entry as DiaryDocument} onClose={vi.fn()} onSave={vi.fn(async () => undefined)}
      onReact={vi.fn(async () => undefined)} onReply={vi.fn(async () => undefined)} />);
    expect(screen.getByText('Today was productive')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'React' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reply' })).not.toBeInTheDocument();
  });

});
