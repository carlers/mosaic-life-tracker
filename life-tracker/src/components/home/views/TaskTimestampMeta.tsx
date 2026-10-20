import React from 'react';
import { CalendarPlus2, CheckCircle2 } from 'lucide-react';
import type { TaskDocument } from '../../../db/schema';
import {
  effectiveTaskTimestamp,
  formatTaskTimestamp,
  type TaskTimestampDisplay,
  type TimelineSortBasis,
} from '../../../lib/taskTimeline';

interface Props {
  task: TaskDocument;
  display: TaskTimestampDisplay;
  timeline?: boolean;
  sortBasis?: TimelineSortBasis;
}

export const TaskTimestampMeta: React.FC<Props> = ({ task, display, timeline = false, sortBasis = 'completion' }) => {
  const events: { kind: 'created' | 'completed'; value: string }[] = [];
  if (timeline) {
    const event = effectiveTaskTimestamp(task, sortBasis);
    if (event) events.push(event);
  } else {
    if (display.showCreated) events.push({ kind: 'created', value: task.createdAt });
    if (display.showCompleted && task.completed && task.completedAt) {
      events.push({ kind: 'completed', value: task.completedAt });
    }
  }

  const labels = events.flatMap((event) => {
    const formatted = formatTaskTimestamp(event.value, task.date);
    return formatted ? [{ ...event, formatted }] : [];
  });
  if (!labels.length) return null;

  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-400" data-task-timestamps="true">
      {labels.map(({ kind, formatted }) => {
        const label = kind === 'created' ? 'Created' : 'Completed';
        const Icon = kind === 'created' ? CalendarPlus2 : CheckCircle2;
        return (
          <span key={kind} className="inline-flex items-center gap-1" aria-label={`${label} ${formatted}`}>
            {display.labelStyle === 'icons'
              ? <Icon aria-hidden="true" size={12} className="shrink-0" />
              : <span aria-hidden="true">{label}</span>}
            <time dateTime={kind === 'created' ? task.createdAt : task.completedAt}>{formatted}</time>
          </span>
        );
      })}
    </div>
  );
};
