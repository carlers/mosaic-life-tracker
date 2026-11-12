import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
afterEach(() => vi.unstubAllGlobals());
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
  it('expands the diary textarea within one page scroll region and saves its text', async () => {
    const onSave = vi.fn(async () => undefined);
    render(<DiaryEntrySheet isOpen date="2026-11-02" author="Me" onClose={vi.fn()} onSave={onSave} />);
    const editor = screen.getByRole('textbox', { name: 'Diary text' }) as HTMLTextAreaElement;
    expect(screen.getByTestId('diary-writing-page')).toContainElement(editor);
    Object.defineProperty(editor, 'scrollHeight', { configurable: true, get: () => 920 });
    const text = 'First line\nA much longer diary entry';
    fireEvent.change(editor, { target: { value: text } });
    expect(editor.style.height).toBe('920px');
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('2026-11-02', text, 'private', '', '[]'));
  });

  it('fits only the Diary writing sheet to the keyboard-reduced viewport', async () => {
    const visual = Object.assign(new EventTarget(), { height: 490, offsetTop: 11, scale: 1 });
    vi.stubGlobal('visualViewport', visual);
    render(<DiaryEntrySheet isOpen date="2026-11-02" author="Me"
      onClose={vi.fn()} onSave={vi.fn(async () => undefined)} />);
    const sheet = screen.getByRole('dialog');
    await waitFor(() => expect(sheet).toHaveStyle({ height: '490px', top: '11px', bottom: 'auto' }));

    visual.height = 325;
    visual.offsetTop = 4;
    visual.dispatchEvent(new Event('resize'));
    await waitFor(() => expect(sheet).toHaveStyle({ height: '325px', top: '4px' }));

    visual.scale = 1.5;
    visual.dispatchEvent(new Event('scroll'));
    await waitFor(() => expect(sheet.style.height).toBe(''));
    expect(screen.getByRole('textbox', { name: 'Diary text' })).toBeInTheDocument();
  });

  it('pauses optional Bucket commands but preserves the goal and edit/delete', () => {
    const view = () => <MemoryRouter initialEntries={['/bucket-list/g_1']}>
      <Routes><Route path="/bucket-list/:id" element={<BucketListDetailPage />} /></Routes>
    </MemoryRouter>;
    const { rerender } = render(view());
    expect(screen.getByRole('button', { name: 'Mark completed' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New task' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Link existing' })).toBeInTheDocument();
    paused.add('mosaic_disable_bucket_achievement_toggle');
    paused.add('mosaic_disable_bucket_step_creation');
    paused.add('mosaic_disable_task_bucket_link');
    rerender(view());
    expect(screen.queryByRole('button', { name: 'Mark completed' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New task' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Link existing' })).not.toBeInTheDocument();
    expect(screen.getByText('Hike a mountain')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit item' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Delete item/ })).toBeInTheDocument();
  });
});
