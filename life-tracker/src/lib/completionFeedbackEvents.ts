/** Small task-action boundary, independent of optional animation/audio settings.
 * Keep event listeners registered in the authenticated Preview layer only. */
/** Tasks are grouped by the user's scheduled calendar date, not UTC midnight. */
export function isScheduledCompletionDay(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [year, month, day] = date.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() + 1 === month && parsed.getUTCDate() === day;
}

interface DayTask {
  id: string;
  userId: string;
  date: string;
  completed: boolean;
  isDeleted: boolean;
}

/** Called only after a real local incomplete→complete transition has persisted. */
export function isCompletedDayAfterTaskChange(
  tasks: readonly DayTask[], userId: string, day: string, completedTaskId: string
): boolean {
  if (!userId || !completedTaskId || !isScheduledCompletionDay(day)) return false;
  const included = tasks.filter(task => task.userId === userId &&
    task.date === day && !task.isDeleted);
  return included.some(task => task.id === completedTaskId && task.completed) &&
    included.every(task => task.completed);
}

export type CompletionFeedbackPhase = 'prepare' | 'complete' | 'day-complete';
export interface CompletionFeedbackEvent {
  phase: CompletionFeedbackPhase;
  userId: string;
  taskId: string;
  day?: string;
}
type Listener = (event: CompletionFeedbackEvent) => void;
const listeners = new Set<Listener>();

export function subscribeCompletionFeedback(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function publishCompletionFeedback(
  phase: CompletionFeedbackPhase, userId: string, taskId: string, day?: string
): void {
  if (!userId || !taskId) return;
  const event: CompletionFeedbackEvent = { phase, userId, taskId, ...(day ? { day } : {}) };
  for (const listener of listeners) {
    try { listener(event); }
    catch { /* Optional effects must never interrupt task persistence. */ }
  }
}
