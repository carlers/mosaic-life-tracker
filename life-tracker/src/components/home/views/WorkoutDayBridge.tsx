import React from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { useRxCollection } from '../../../hooks/useRxCollection';
import type { ActivityDocument, ActivityTaskLinkDocument, CategoryDocument, TaskDocument } from '../../../db/schema';
import type { TaskOrderGroup } from '../../../lib/taskOrder';
import { buildWorkoutPresentation, buildWorkoutOrderAssignments, type WorkoutPresentation } from '../../../lib/workoutDayPlacement';
import { reorderWorkoutRows } from '../../../lib/workoutActivity';
const WorkoutHistorySheet = React.lazy(() => import('../../modals/WorkoutHistorySheet'));

export interface WorkoutDayData {
  presentation: WorkoutPresentation;
  onOpenWorkout: (id: string) => void;
  onReorderMixed: (dateStr: string, groups: readonly TaskOrderGroup[]) => Promise<void>;
}

/** Lazy owner-only day observer. No friend calendar, route or month-grid subscription. */
const WorkoutDayBridge: React.FC<{
  dateStr: string;
  currentUserId: string;
  tasks: readonly TaskDocument[];
  categories: readonly CategoryDocument[];
  onReorderTasks?: (dateStr: string, groups: readonly TaskOrderGroup[]) => void | Promise<void>;
  onUpdate: (data: WorkoutDayData) => void;
}> = ({ dateStr, currentUserId, tasks, categories, onReorderTasks, onUpdate }) => {
  const { user } = useAuth();
  const owner = user?.$id ?? '';
  const enabled = !!owner && owner === currentUserId;
  const { data: activities } = useRxCollection<ActivityDocument>({
    collection: 'activities',
    selector: { userId: enabled ? owner : '', localDate: dateStr, isDeleted: false },
    enabled,
    logPrefix: '[WorkoutDayBridge]',
  });
  const { data: links } = useRxCollection<ActivityTaskLinkDocument>({
    collection: 'activityTaskLinks',
    selector: { userId: enabled ? owner : '', isDeleted: false },
    enabled,
    logPrefix: '[WorkoutLinksBridge]',
  });
  const presentation = React.useMemo(() => buildWorkoutPresentation(
    enabled ? activities : [], enabled ? links : [], tasks, categories, owner, dateStr
  ), [enabled, activities, links, tasks, categories, owner, dateStr]);
  const onReorderMixed = React.useCallback(async (
    day: string, groups: readonly TaskOrderGroup[]
  ) => {
    if (!enabled || day !== dateStr) throw new Error('Workout owner or day changed.');
    const taskIds = new Set(tasks.filter(task => task.userId === owner && !task.isDeleted).map(task => task.id));
    const workoutIds = new Set(presentation.proxies.map(task => task.id));
    const assignments = buildWorkoutOrderAssignments(groups, taskIds, workoutIds);
    // The existing validated task reorder never sees activity IDs.
    const taskGroups = groups.map(group => ({
      categoryId: group.categoryId, taskIds: group.taskIds.filter(id => taskIds.has(id)),
    }));
    if (taskGroups.length && onReorderTasks) await onReorderTasks(day, taskGroups);
    await reorderWorkoutRows(owner, day, assignments);
  }, [enabled, owner, dateStr, tasks, presentation, onReorderTasks]);

  const [selectedActivityId, setSelectedActivityId] = React.useState<string | null>(null);
  // The caller keys this bridge by owner/day; a new day gets fresh disclosure
  // state without cascading updates in an effect.
  const onOpenWorkout = React.useCallback((id: string) => setSelectedActivityId(id), []);
  // Publish owner-private data without ever mounting a second temporary
  // task tree. The permanent Day View keeps its scroll/drag node identities.
  React.useEffect(() => {
    onUpdate({ presentation, onOpenWorkout, onReorderMixed });
  }, [onUpdate, presentation, onOpenWorkout, onReorderMixed]);
  return <>
    <React.Suspense fallback={null}>
      {enabled && selectedActivityId &&
        <WorkoutHistorySheet key={selectedActivityId}
          isOpen onClose={() => setSelectedActivityId(null)}
          date={dateStr} focusActivityId={selectedActivityId}/>}
    </React.Suspense>
  </>;
};
export default WorkoutDayBridge;
