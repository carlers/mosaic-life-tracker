import { useAuth } from './useAuth';
import { useRxCollection } from './useRxCollection';
import type { CategoryDocument, TaskDocument } from '../db/schema';

/**
 * Read-only Home owner subscriptions. Keep task mutations in useTasks and
 * category mutations in useCategories, which are loaded by their editing views.
 * Query selectors, sort order and startup marks match the existing domain hooks.
 */
export function useHomeOwnerCollections() {
  const { user } = useAuth();
  const uid = user?.$id ?? '';
  const { data: tasks, isLoading: isTasksLoading } = useRxCollection<TaskDocument>({
    collection: 'tasks',
    selector: { userId: uid, isDeleted: false },
    sort: [{ date: 'asc' }, { createdAt: 'desc' }],
    logPrefix: '[useTasks]',
    enabled: true,
    startupMark: 'home:tasks-ready',
  });
  const { data: categories, isLoading: isCategoriesLoading } = useRxCollection<CategoryDocument>({
    collection: 'categories',
    selector: { userId: uid, isDeleted: false },
    sort: [{ order: 'asc' }],
    logPrefix: '[useCategories]',
    enabled: true,
    startupMark: 'home:categories-ready',
  });
  return { tasks, categories, isTasksLoading, isCategoriesLoading };
}
