import React, { useCallback, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useTasks } from '../../hooks/useTasks';
import { useCategories } from '../../hooks/useCategories';
import { createCommandTask } from '../../lib/taskCommandCreation';
import { HomeCommandSheet } from './HomeCommandSheet';

type Props = { isOpen: boolean; onClose: () => void };
type TaskDraft = { title: string; categoryId: string; date: string; newCategoryName?: string };

const OwnerCommandSheet: React.FC<Props & { ownerId: string }> = ({ ownerId, ...props }) => {
  // Mutating collections and speech/model modules are loaded only after the
  // owner explicitly opens the launcher. Keep them out of initial Home JS.
  const { user } = useAuth();
  const ownerRef = useRef(user?.$id ?? null);
  useEffect(() => { ownerRef.current = user?.$id ?? null; }, [user?.$id]);
  const { tasks = [], isLoading: tasksLoading, addTask } = useTasks();
  const { categories = [], isLoading: categoriesLoading, addCategory } = useCategories();
  const isLoading = tasksLoading || categoriesLoading;
  const onCreate = useCallback(async (task: TaskDraft, position: 'top' | 'bottom') => {
    await createCommandTask({
      uid: ownerId,
      ownerValid: () => ownerRef.current === ownerId,
      categories, loading: isLoading,
      addCategory, addTask, task, position,
    });
  }, [ownerId, categories, isLoading, addCategory, addTask]);

  return <HomeCommandSheet {...props} ownerId={ownerId}
    categories={categories} tasks={tasks} isLoading={isLoading}
    onCreate={onCreate} />;
};

export const HomeCommandEntry: React.FC<Props> = props => {
  const { user } = useAuth();
  const ownerId = user?.$id;
  if (!ownerId) return null;
  // Changing account remounts every transient command, microphone and undo
  // state; the previous per-owner command cannot write into the new account.
  return <OwnerCommandSheet key={ownerId} ownerId={ownerId} {...props} />;
};
