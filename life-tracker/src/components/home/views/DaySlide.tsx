import React from 'react';
import { DaySlideContent, type DaySlideProps } from './DaySlideContent';
import { TaskReorderRuntime } from './TaskReorderRuntime';
import {
  buildTaskPlacement,
  materializeTaskDocument,
  sortTaskPlacementByCompletion,
} from '../../../lib/taskOrder';
import { buildRenderedTasksByCategory } from './taskReorder';
import { categoriesForDay } from '../../../lib/categoryLifecycle';

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
    () => tasks.map(materializeTaskDocument),
    [tasks]
  );
  const visibleCategories = React.useMemo(() => {
    const occupiedShares = (props.sharedItems ?? [])
      .filter(item => item.status === 'accepted' && item.date === props.dateStr)
      .map(item => props.sharedCategoryFor?.(item) ?? '')
      .filter(Boolean);
    return categoriesForDay(categories, materializedTasks, props.dateStr, occupiedShares)
      .map(item => item.category);
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

  if (visibleCategories.length === 0 && !props.sharedItems?.length && !props.diaryEnabled && !props.emptyCategoryPrompt && !props.footerCategoryPrompt) {
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

export const DaySlide = React.memo(DaySlideComponent);
DaySlide.displayName = 'DaySlide';
