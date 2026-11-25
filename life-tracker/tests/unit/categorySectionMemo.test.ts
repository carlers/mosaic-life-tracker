import { describe, expect, it } from 'vitest';
import { equalCategoryProps } from '../../src/components/home/views/MemoCategorySection';
import type { CategorySectionProps } from '../../src/components/home/views/CategorySection';
import type { TaskDocument } from '../../src/db/schema';

const noop = () => undefined;
const task = { id: 'synthetic1', completed: false, updatedAt: '2026-01-01' } as TaskDocument;
const second = { id: 'synthetic2', completed: false, updatedAt: '2026-01-01' } as TaskDocument;
const props: CategorySectionProps = {
  categoryId: 'c1', categoryName: 'Synthetic', categoryColor: '#fff',
  currentUserId: 'u1', tasks: [task, second], editingTaskId: null, editValue: '',
  onToggleTask: noop, onAddTask: noop, onOpenActions: noop, onOpenMemo: noop,
  onEditTask: noop, onEditChange: noop, onEditSave: noop, onEditCancel: noop,
};

describe('category render isolation does not hide legitimate changes', () => {
  it('accepts newly projected arrays with precisely the same task objects and order', () => {
    expect(equalCategoryProps(props, { ...props, tasks: [task, second] })).toBe(true);
  });
  it('invalidates when task fields, ordering or membership change', () => {
    expect(equalCategoryProps(props, { ...props, tasks: [task, {...second, completed: true}] })).toBe(false);
    expect(equalCategoryProps(props, { ...props, tasks: [second, task] })).toBe(false);
    expect(equalCategoryProps(props, { ...props, tasks: [task] })).toBe(false);
  });
  it('invalidates editor, gap, grouped diary, shared rows, category color, focus or action handlers', () => {
    expect(equalCategoryProps(props, { ...props, editingTaskId: 'synthetic1' })).toBe(false);
    expect(equalCategoryProps(props, { ...props, diaryNoteGhostIndex: 2 })).toBe(false);
    expect(equalCategoryProps(props, { ...props, diarySlot: 'new diary card' })).toBe(false);
    expect(equalCategoryProps(props, { ...props, sharedRows: 'shared' })).toBe(false);
    expect(equalCategoryProps(props, { ...props, categoryColor: '#333' })).toBe(false);
    expect(equalCategoryProps(props, { ...props, onAddTask: () => undefined })).toBe(false);
  });
});
