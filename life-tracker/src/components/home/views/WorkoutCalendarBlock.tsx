import React from 'react';
import { Activity } from 'lucide-react';
import type { ActivityDocument } from '../../../db/schema';
import { getReadableTextColor } from '../../../constants/colors';

/** Owner-only completed workout preview with the same density as a TaskBlock.
 * This is never a TaskDocument and does not affect real task completion state.
 */
const WorkoutCalendarBlockComponent: React.FC<{ activity: ActivityDocument; categoryColor: string }> = ({
  activity, categoryColor,
}) => <div
  data-calendar-workout={activity.id}
  className="mosaic-done w-full overflow-hidden rounded-[4.5px] pt-0.5 text-[10.5px] font-semibold"
  style={{ backgroundColor: categoryColor, color: getReadableTextColor(categoryColor) }}
  title={activity.title}>
  <div className="flex min-w-0 items-center gap-1 px-[0.3rem] pb-0.5">
    <Activity aria-hidden="true" size={10} className="shrink-0"/>
    <span className="block min-w-0 overflow-hidden whitespace-nowrap">{activity.title}</span>
  </div>
</div>;
export const WorkoutCalendarBlock = React.memo(WorkoutCalendarBlockComponent);
