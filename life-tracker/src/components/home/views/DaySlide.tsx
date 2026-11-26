import React from 'react';
import { DaySlideContent, type DaySlideProps } from './DaySlideContent';
import { TaskReorderRuntime } from './TaskReorderRuntime';
import { useDiary } from '../../../hooks/useDiary';
import { OwnerDiaryContext } from '../../../hooks/ownerDiaryContext';
import { useSettings } from '../../../hooks/useSettings';
import {
  buildTaskPlacement,
  materializeTaskDocument,
  sortTaskPlacementByCompletion,
} from '../../../lib/taskOrder';
import { buildRenderedTasksByCategory } from './taskReorder';
import { canAddNewTaskToCategory } from '../../../lib/categoryLifecycle';

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

/** Owner-only Diary subscriber keeps the reusable task DnD runtime auth-free.
 * Direct task-drag renderers and isolated DnD tests have no Diary dependencies. */
const OwnerDiaryReorderRuntime: React.FC<React.ComponentProps<typeof TaskReorderRuntime>> = props => {
  const snapshot = React.useContext(OwnerDiaryContext);
  const { entries: localEntries } = useDiary(!snapshot);
  const { getSetting, setSetting } = useSettings();
  const entries = snapshot?.entries ?? localEntries;
  return <TaskReorderRuntime {...props} diaryReorderEntries={entries}
    diaryReorderGetSetting={getSetting} diaryReorderSetSetting={setSetting}/>;
};

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

  const Runtime = props.diaryEnabled && !props.diaryEntryOverride
    ? OwnerDiaryReorderRuntime : TaskReorderRuntime;
  return (
    <Runtime
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
