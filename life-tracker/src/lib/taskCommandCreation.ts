import type { CategoryDocument, TaskDocument } from '../db/schema';

type AddCategory = (category: Omit<CategoryDocument,
  'id' | 'userId' | 'isDeleted' | 'updatedAt'>) => Promise<string | undefined>;
type AddTask = (task: Omit<TaskDocument,
  'id' | 'userId' | 'order' | 'createdAt' | 'updatedAt' | 'isDeleted'>,
  position: 'top' | 'bottom') => Promise<string | undefined>;

export async function createCommandTask(args: {
  uid: string | null;
  ownerValid: () => boolean;
  categories: CategoryDocument[];
  loading: boolean;
  addCategory: AddCategory;
  addTask: AddTask;
  task: { title: string; categoryId: string; date: string; newCategoryName?: string };
  position: 'top' | 'bottom';
}) {
  const { uid, ownerValid, categories, loading, addCategory, addTask, task, position } = args;
  if (!uid || loading || !ownerValid()) throw new Error('Owner data is unavailable. Try again.');
  const owned = categories.filter(c => c.userId === uid && !c.isDeleted);
  let categoryId = task.categoryId;
  const proposed = task.newCategoryName?.trim();
  if (proposed) {
    const existing = owned.filter(c => c.name.toLocaleLowerCase() === proposed.toLocaleLowerCase());
    if (existing.length > 1) throw new Error('Duplicate category names. Choose a category manually.');
    if (existing.length === 1) categoryId = existing[0].id;
    else {
      const added = await addCategory({
        name: proposed, color: '#10B981', visibility: 'private', order: owned.length, icon: '',
      });
      if (!added) throw new Error('Category could not be created. Task not created.');
      categoryId = added;
    }
  } else if (!owned.some(c => c.id === categoryId)) {
    throw new Error('Selected category is no longer available.');
  }
  if (!ownerValid()) throw new Error('Account changed. Review task before retrying.');
  const created = await addTask({
    title: task.title, categoryId, date: task.date,
    completed: false, visibility: task.date === '' ? 'private' : '',
  }, position);
  if (!created) throw new Error('Task could not be created; check tasks before retrying.');
}
