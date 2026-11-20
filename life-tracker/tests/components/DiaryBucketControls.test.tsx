import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const paused = vi.hoisted(() => new Set<string>());
const calendarSettings = vi.hoisted(() => ({
  values: new Map<string, unknown>(),
  set: vi.fn(async (key: string, value: unknown) => { calendarSettings.values.set(key, value); }),
}));
vi.mock('../../src/hooks/useSettings', () => ({
  useSettings: () => ({
    getSetting: (key: string, defaultValue?: unknown) => calendarSettings.values.get(key) ?? defaultValue,
    setSetting: calendarSettings.set,
  }),
}));
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
import { DIARY_EDITOR_WIDTH_SETTING_KEY, resolveDiaryEditorWidth } from '../../src/lib/diaryEditorWidth';

beforeEach(() => {
  paused.clear();
  calendarSettings.values.clear();
  calendarSettings.set.mockClear();
});
afterEach(() => vi.unstubAllGlobals());
describe('Diary and Bucket controls', () => {
  it('defaults the Diary editor width to the existing focused layout', () => {
    expect(resolveDiaryEditorWidth(undefined)).toBe('focused');
    expect(resolveDiaryEditorWidth('unexpected')).toBe('focused');
    expect(resolveDiaryEditorWidth('focused')).toBe('focused');
    expect(resolveDiaryEditorWidth('full')).toBe('full');
  });

  it('applies a full-width writing preference only to the owner editor', () => {
    calendarSettings.values.set(DIARY_EDITOR_WIDTH_SETTING_KEY, 'full');
    const { unmount } = render(<DiaryEntrySheet isOpen date="2026-11-02" author="Me"
      onClose={vi.fn()} onSave={vi.fn(async () => undefined)} />);
    expect(screen.getByTestId('diary-entry-sheet')).toHaveAttribute('data-diary-width', 'full');
    unmount();

    render(<DiaryEntrySheet isOpen date="2026-11-02" author="Friend" onClose={vi.fn()} />);
    expect(screen.queryByTestId('diary-writing-page')).not.toBeInTheDocument();
    expect(screen.getByTestId('diary-entry-sheet')).not.toHaveAttribute('data-diary-width');
  });

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

  it('saves an edited diary on backdrop tap and closes only after persistence resolves', async () => {
    let resolveSave: (() => void) | undefined;
    const onSave = vi.fn(() => new Promise<void>(resolve => { resolveSave = resolve; }));
    const onClose = vi.fn();
    render(<DiaryEntrySheet isOpen date="2026-11-02" author="Me" onClose={onClose} onSave={onSave} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Diary text' }), {
      target: { value: 'Saved by tapping outside' },
    });
    const backdrop = screen.getByTestId('bottom-sheet-backdrop');
    fireEvent.click(backdrop);
    fireEvent.click(backdrop);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith('2026-11-02', 'Saved by tapping outside', 'private', '', '[]');
    expect(onClose).not.toHaveBeenCalled();
    resolveSave?.();
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('retains an unsaved diary and shows an error when backdrop persistence fails', async () => {
    const onSave = vi.fn(async () => { throw new Error('Offline save failed'); });
    const onClose = vi.fn();
    render(<DiaryEntrySheet isOpen date="2026-11-02" author="Me" onClose={onClose} onSave={onSave} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Diary text' }), {
      target: { value: 'Keep this draft' },
    });
    fireEvent.click(screen.getByTestId('bottom-sheet-backdrop'));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Offline save failed'));
    expect(screen.getByRole('textbox', { name: 'Diary text' })).toHaveValue('Keep this draft');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not discard an invalid emptied diary on backdrop tap', () => {
    const onSave = vi.fn(async () => undefined);
    const onClose = vi.fn();
    const entry = {
      id: 'existing', userId: 'owner', date: '2026-11-02', content: 'Before editing',
      emoji: '', photos: '[]', visibility: 'private' as const, isDeleted: false,
      createdAt: '2026-11-02T00:00:00Z', updatedAt: '2026-11-02T00:00:00Z',
    };
    render(<DiaryEntrySheet isOpen date="2026-11-02" author="Me" entry={entry}
      initialEditing onClose={onClose} onSave={onSave} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Diary text' }), { target: { value: '' } });
    fireEvent.click(screen.getByTestId('bottom-sheet-backdrop'));
    expect(screen.getByRole('alert')).toHaveTextContent('Add text, an emoji, or a photo before saving.');
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('keeps explicit Close confirmation and closes unchanged/read-only diaries without saving', () => {
    const onSave = vi.fn(async () => undefined);
    const onClose = vi.fn();
    const { unmount } = render(<DiaryEntrySheet isOpen date="2026-11-02"
      author="Me" onClose={onClose} onSave={onSave} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Diary text' }), {
      target: { value: 'Unsaved text' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Close diary' }));
    expect(screen.getByText('Discard changes?')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
    unmount();

    const unchangedClose = vi.fn();
    const unchangedSave = vi.fn(async () => undefined);
    const unchanged = render(<DiaryEntrySheet isOpen date="2026-11-02"
      author="Me" onClose={unchangedClose} onSave={unchangedSave} />);
    fireEvent.click(screen.getByTestId('bottom-sheet-backdrop'));
    expect(unchangedClose).toHaveBeenCalledTimes(1);
    expect(unchangedSave).not.toHaveBeenCalled();
    unchanged.unmount();

    const readonlyClose = vi.fn();
    render(<DiaryEntrySheet isOpen date="2026-11-02" author="Friend"
      onClose={readonlyClose} />);
    fireEvent.click(screen.getByTestId('bottom-sheet-backdrop'));
    expect(readonlyClose).toHaveBeenCalledTimes(1);
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


  it('saves a new Diary Calendar override after its entry, before closing the sheet', async () => {
    const onSave = vi.fn(async () => undefined);
    const onClose = vi.fn();
    render(<DiaryEntrySheet isOpen date="2026-11-02" author="Me" onClose={onClose} onSave={onSave} />);
    fireEvent.click(screen.getByRole('combobox', { name: /Calendar block for this entry/ }));
    fireEvent.click(screen.getByRole('option', { name: 'Hide from Calendar' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Diary text' }), {
      target: { value: 'Sensitive diary content' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(calendarSettings.set).toHaveBeenCalledWith(
      'calendarDiaryEntryDisplay:owner_20261102', 'hidden'
    ));
    expect(onSave).toHaveBeenCalledWith('2026-11-02', 'Sensitive diary content', 'private', '', '[]');
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('updates an existing Diary block directly from its actions without editing or sharing', async () => {
    const onSave = vi.fn(async () => undefined);
    const entry = {
      id: 'diary_existing', userId: 'owner', date: '2026-11-02', content: 'Original text',
      emoji: '', photos: '[]', visibility: 'private' as const, isDeleted: false,
      createdAt: '2026-11-02T00:00:00Z', updatedAt: '2026-11-02T00:00:00Z',
    };
    const { rerender } = render(<DiaryEntrySheet isOpen date="2026-11-02" author="Me"
      entry={entry} onClose={vi.fn()} onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: 'Diary actions' }));
    fireEvent.click(screen.getByRole('combobox', { name: /Calendar block for this entry/ }));
    fireEvent.click(screen.getByRole('option', { name: 'Icon only' }));
    await waitFor(() => expect(calendarSettings.set).toHaveBeenCalledWith(
      'calendarDiaryEntryDisplay:diary_existing', 'icon'
    ));
    expect(onSave).not.toHaveBeenCalled();
    rerender(<DiaryEntrySheet isOpen date="2026-11-02" author="Friend"
      entry={{ ...entry, userId: 'friend' }} onClose={vi.fn()} />);
    expect(screen.queryByRole('combobox', { name: /Calendar block for this entry/ })).not.toBeInTheDocument();
  });

  it('keeps editor open if saving a Calendar override fails after Diary save', async () => {
    calendarSettings.set.mockRejectedValueOnce(new Error('Settings unavailable'));
    const onSave = vi.fn(async () => undefined);
    const onClose = vi.fn();
    render(<DiaryEntrySheet isOpen date="2026-11-02" author="Me" onClose={onClose} onSave={onSave}/>);
    fireEvent.click(screen.getByRole('combobox', { name: /Calendar block for this entry/ }));
    fireEvent.click(screen.getByRole('option', { name: 'Icon only' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Diary text' }), {
      target: { value: 'My journal' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Settings unavailable'));
    expect(onClose).not.toHaveBeenCalled();
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
