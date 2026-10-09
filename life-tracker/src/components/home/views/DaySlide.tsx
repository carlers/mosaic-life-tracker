import React from 'react';
import { DaySlideContent, type DaySlideProps } from './DaySlideContent';
import { TaskReorderRuntime } from './TaskReorderRuntime';
import {
  buildTaskPlacement,
  materializeTaskDocument,
  sortTaskPlacementByCompletion,
} from '../../../lib/taskOrder';
import { buildRenderedTasksByCategory } from './taskReorder';

const DaySlideComponent: React.FC<DaySlideProps> = ({
  reorderRuntimeActive = true,
  ...props
}) => {
  const { tasks, categories, taskSortMode = 'manual' } = props;

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

  if (categories.length === 0) {
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
      <DaySlideContent
        {...sharedProps}
        reorderEnabled={false}
        reorderRuntimeActive={false}
        tasksByCategory={buildRenderedTasksByCategory(
          materializedTasks,
          sortTaskPlacementByCompletion(
            livePlacement, materializedTasks, taskSortMode
          ),
          categoryIds
        )}
        activeDrag={null}
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
