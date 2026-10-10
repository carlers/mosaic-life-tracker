import React from 'react';
import { DaySlideContent, type DaySlideProps } from './DaySlideContent';
import { TaskReorderRuntime } from './TaskReorderRuntime';
import {
  buildTaskPlacement,
  materializeTaskDocument,
  sortTaskPlacementByCompletion,
} from '../../../lib/taskOrder';
import { buildRenderedTasksByCategory } from './taskReorder';

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
  const categoryIds = React.useMemo(
    () => categories.map((category) => category.id),
    [categories]
  );
  const livePlacement = React.useMemo(
    () => buildTaskPlacement(materializedTasks, categoryIds),
    [categoryIds, materializedTasks]
  );

  if (categories.length === 0 && !props.sharedItems?.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400">
        <p className="text-sm">No categories yet</p>
      </div>
    );
  }

  const sharedProps = {
    ...props,
    tasks: materializedTasks,
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
      {...sharedProps}
      reorderRuntimeActive
      categoryIds={categoryIds}
      livePlacement={livePlacement}
    />
  );
};

export const DaySlide = React.memo(DaySlideComponent);
DaySlide.displayName = 'DaySlide';
