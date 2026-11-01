import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const paused = vi.hoisted(() => new Set<string>());
vi.mock('../../src/hooks/useFeatureEnabled', () => ({
  useFeatureEnabled: (flag: string) => !paused.has(flag),
}));
vi.mock('../../src/lib/featureControls', () => ({
  isFeatureEnabled: (flag: string) => !paused.has(flag),
}));
vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({ user: { $id: 'owner' } }),
}));
const mocks = vi.hoisted(() => ({
  setAchieved: vi.fn(async () => undefined),
  editItem: vi.fn(async () => undefined),
  deleteItem: vi.fn(async () => undefined),
  setLinked: vi.fn(async () => undefined),
  addTask: vi.fn(async () => 'task_1'),
}));
vi.mock('../../src/hooks/useBucketList', () => ({
  useBucketList: () => ({
    items: [{ id: 'g_1', userId: 'owner', title: 'Hike a mountain', description: '',
      isDeleted: false, achieved: false, achievedAt: '' }],
    editItem: mocks.editItem, setAchieved: mocks.setAchieved,
    deleteItem: mocks.deleteItem,
  }),
}));
vi.mock('../../src/hooks/useBucketTaskLinks', () => ({
  useBucketTaskLinks: () => ({ links: [], setLinked: mocks.setLinked }),
}));
vi.mock('../../src/hooks/useTasks', () => ({
  useTasks: () => ({ tasks: [], addTask: mocks.addTask, toggleTaskCompletion: vi.fn() }),
}));
vi.mock('../../src/hooks/useCategories', () => ({
  useCategories: () => ({ categories: [] }),
}));
vi.mock('../../src/hooks/useTaskImage', () => ({
  useTaskImage: () => ({ imageUrl: '', isLoading: false }),
}));
import { BucketListDetailPage } from '../../src/pages/BucketListDetailPage';
import { DiaryEntrySheet } from '../../src/components/home/views/DiaryEntrySheet';

beforeEach(() => paused.clear());
describe('Diary and Bucket controls', () => {
  it('pauses Diary emoji selection without hiding the text editor', () => {
    paused.add('mosaic_disable_diary_emoji_picker');
    const props = { isOpen: true, date: '2026-11-02', author: 'Me', onClose: vi.fn(), onSave: vi.fn(async () => undefined) };
    const { rerender } = render(<DiaryEntrySheet {...props} />);
    expect(screen.queryByRole('button', { name: 'Choose diary emoji' })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Diary text' })).toBeInTheDocument();
    paused.clear();
    rerender(<DiaryEntrySheet {...props} />);
    expect(screen.getByRole('button', { name: 'Choose diary emoji' })).toBeInTheDocument();
  });
  it('pauses optional Bucket commands but preserves the goal and edit/delete', () => {
    const view = () => <MemoryRouter initialEntries={['/bucket-list/g_1']}>
      <Routes><Route path="/bucket-list/:id" element={<BucketListDetailPage />} /></Routes>
    </MemoryRouter>;
    const { rerender } = render(view());
    expect(screen.getByRole('button', { name: 'I lived it' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New task' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Link existing' })).toBeInTheDocument();
    paused.add('mosaic_disable_bucket_achievement_toggle');
    paused.add('mosaic_disable_bucket_step_creation');
    paused.add('mosaic_disable_task_bucket_link');
    rerender(view());
    expect(screen.queryByRole('button', { name: 'I lived it' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New task' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Link existing' })).not.toBeInTheDocument();
    expect(screen.getByText('Hike a mountain')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit aspiration' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Delete aspiration/ })).toBeInTheDocument();
  });
});
