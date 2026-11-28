import { useRxCollection } from './useRxCollection';
import type { ActivityDocument, ActivityTaskLinkDocument, TaskDocument } from '../db/schema';
import { useAuth } from './useAuth';

/** Owner-only live local queries; never subscribe for friend or social projections. */
export function useWorkouts(enabled = true) {
  const { user } = useAuth();
  const userId = user?.$id ?? '';
  const { data: workouts, isLoading } = useRxCollection<ActivityDocument>({
    collection: 'activities', selector: { userId, isDeleted: false }, enabled,
    logPrefix: '[useWorkouts]',
  });
  const { data: links } = useRxCollection<ActivityTaskLinkDocument>({
    collection: 'activityTaskLinks', selector: { userId, isDeleted: false }, enabled,
    logPrefix: '[useWorkoutTaskLinks]',
  });
  const { data: tasks } = useRxCollection<TaskDocument>({
    collection: 'tasks', selector: { userId, isDeleted: false }, enabled,
    logPrefix: '[useWorkoutTaskOwnerTasks]',
  });
  return { workouts, links, tasks, isLoading, userId };
}
