import React from 'react';
const LazyWorkoutDayBridge = React.lazy(() => import('./WorkoutDayBridge'));
import { DaySlideContent, type DaySlideProps } from './DaySlideContent';
import { TaskReorderRuntime } from './TaskReorderRuntime';
import {
  buildTaskPlacement,
  materializeTaskDocument,
  sortTaskPlacementByCompletion,
} from '../../../lib/taskOrder';
import { buildRenderedTasksByCategory } from './taskReorder';
import { canAddNewTaskToCategory } from '../../../lib/categoryLifecycle';
import type { WorkoutDayData } from './WorkoutDayBridge';

interface ReadOnlySlideProps extends DaySlideProps {
  livePlacement: import('../../../lib/taskOrder').TaskPlacement;
  categoryIds: string[];
}

/** Keep the derived display projection outside the memoized task source. */
const ReadOnlySlide: React.FC<ReadOnlySlideProps> = ({
  livePlacement,
  categoryIds,
  taskSortMode = 'manual',
  ...props
}) => (
  <DaySlideContent
    {...props}
    reorderEnabled={false}
    reorderRuntimeActive={false}
    tasksByCategory={buildRenderedTasksByCategory(
      props.tasks,
      sortTaskPlacementByCompletion(livePlacement, props.tasks, taskSortMode),
      categoryIds
    )}
    activeDrag={null}
  />
);

const DaySlideComponent: React.FC<DaySlideProps> = ({
  reorderRuntimeActive = true,
  ...props
}) => {
  const { tasks, categories } = props;

  const materializedTasks = React.useMemo(
    () => [
      ...tasks.map(materializeTaskDocument),
      ...(props.workoutPresentation?.proxies ?? []),
    ],
    [tasks, props.workoutPresentation?.proxies]
  );
  const visibleCategories = React.useMemo(() => {
    const occupied = new Set(materializedTasks
      .filter(task => !task.isDeleted && task.date === props.dateStr)
      .map(task => task.categoryId));
    for (const item of props.sharedItems ?? []) {
      if (item.status === 'accepted' && item.date === props.dateStr) {
        const assigned = props.sharedCategoryFor?.(item);
        if (assigned) occupied.add(assigned);
      }
    }
    return categories.filter(category => !category.isDeleted &&
      (canAddNewTaskToCategory(category, props.dateStr) || occupied.has(category.id)));
  }, [categories, materializedTasks, props.dateStr, props.sharedItems, props.sharedCategoryFor]);
  const allCategoriesRendered = visibleCategories.length === categories.length;
  const categoryIds = React.useMemo(
    () => visibleCategories.map((category) => category.id),
    [visibleCategories]
  );
  const livePlacement = React.useMemo(
    () => buildTaskPlacement(materializedTasks, categoryIds),
    [categoryIds, materializedTasks]
  );

  if (visibleCategories.length === 0 && !props.workoutPresentation?.unassigned.length &&
      !props.sharedItems?.length && !props.diaryEnabled &&
      !props.emptyCategoryPrompt && !props.footerCategoryPrompt) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400">
        <p className="text-sm">No categories yet</p>
 
      </div>
    );
  }

  const sharedProps = {
    ...props,
    tasks: materializedTasks,
    categories: visibleCategories,
    reorderEnabled: allCategoriesRendered && props.reorderEnabled,
    onReorderCategories: allCategoriesRendered ? props.onReorderCategories : undefined,
  };

  if (!reorderRuntimeActive) {
    return (
      <ReadOnlySlide
        {...sharedProps}
        livePlacement={livePlacement}
        categoryIds={categoryIds}
      />
    );
  }

  return (
    <TaskReorderRuntime
      key={`${props.currentUserId}:${props.dateStr}`}
      {...sharedProps}
      reorderRuntimeActive
      categoryIds={categoryIds}
      livePlacement={livePlacement}
    />
  );
};

const BaseDaySlide = React.memo(DaySlideComponent);
type ScopedWorkoutSnapshot = {
  ownerId: string;
  dateStr: string;
  data: WorkoutDayData;
};
export const DaySlide: React.FC<DaySlideProps> = React.memo((props) => {
  const [workoutSnapshot, setWorkoutSnapshot] = React.useState<ScopedWorkoutSnapshot | null>(null);
  const publishWorkout = React.useCallback((data: WorkoutDayData) => {
    setWorkoutSnapshot(previous => {
      if (previous?.ownerId === props.currentUserId &&
          previous.dateStr === props.dateStr &&
          previous.data.presentation === data.presentation &&
          previous.data.onOpenWorkout === data.onOpenWorkout &&
          previous.data.onReorderMixed === data.onReorderMixed) return previous;
      return { ownerId: props.currentUserId, dateStr: props.dateStr, data };
    });
  }, [props.currentUserId, props.dateStr]);
  if (!props.dateStr) return <BaseDaySlide {...props}/>;
  // Day View stays mounted immediately, even as the optional activity observer
  // loads. Later owner-only workout updates change props, not DOM identity.
  // Task scroll handles, focus and DnD sources must never be detached by
  // replacing an initial Suspense fallback tree.
  const current = workoutSnapshot?.ownerId === props.currentUserId &&
    workoutSnapshot.dateStr === props.dateStr ? workoutSnapshot.data : null;
  return <>
    <BaseDaySlide {...props}
      workoutPresentation={current?.presentation}
      onOpenWorkout={current?.onOpenWorkout}
      onReorderTasks={current?.onReorderMixed ?? props.onReorderTasks}/>
    <React.Suspense fallback={null}>
      <LazyWorkoutDayBridge key={`${props.currentUserId}:${props.dateStr}`}
        dateStr={props.dateStr}
        currentUserId={props.currentUserId}
        tasks={props.tasks} categories={props.categories}
        onReorderTasks={props.onReorderTasks}
        onUpdate={publishWorkout}/>
    </React.Suspense>
  </>;
});
DaySlide.displayName = 'DaySlide';
