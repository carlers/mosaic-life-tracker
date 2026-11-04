/** Ephemeral user-action events. Database replication never publishes them. */
export const COMPLETION_FEEDBACK_SETTING_KEY = 'taskCompletionFeedback';

export type CompletionSoundStyle =
  'pop' | 'chime' | 'click' | 'sparkle' | 'ding' | 'bubble' | 'arcade' | 'tada';
export type CompletionAnimation = 'off' | 'subtle' | 'celebrate';

export const COMPLETION_SOUND_OPTIONS: readonly { value: CompletionSoundStyle; label: string }[] = [
  { value: 'pop', label: 'Soft pop' },
  { value: 'chime', label: 'Chime' },
  { value: 'click', label: 'Click' },
  { value: 'sparkle', label: 'Sparkle' },
  { value: 'ding', label: 'Ding' },
  { value: 'bubble', label: 'Bubble' },
  { value: 'arcade', label: 'Arcade' },
  { value: 'tada', label: 'Ta-da' },
];

export function isCompletionSoundStyle(value: unknown): value is CompletionSoundStyle {
  return COMPLETION_SOUND_OPTIONS.some(option => option.value === value);
}

export interface CompletionFeedbackSettings {
  animation: CompletionAnimation;
  soundEnabled: boolean;
  soundStyle: CompletionSoundStyle;
  volume: number;
  dayConfettiEnabled: boolean;
}

export const DEFAULT_COMPLETION_FEEDBACK: Readonly<CompletionFeedbackSettings> = {
  animation: 'subtle',
  soundEnabled: false,
  soundStyle: 'pop',
  volume: 0.6,
  dayConfettiEnabled: false,
};

export function resolveCompletionFeedbackSettings(value: unknown): CompletionFeedbackSettings {
  const row = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
  return {
    animation: row.animation === 'off' || row.animation === 'celebrate' ? row.animation : 'subtle',
    soundEnabled: row.soundEnabled === true,
    soundStyle: isCompletionSoundStyle(row.soundStyle) ? row.soundStyle : 'pop',
    volume: typeof row.volume === 'number' && Number.isFinite(row.volume)
      ? Math.min(1, Math.max(0, row.volume)) : DEFAULT_COMPLETION_FEEDBACK.volume,
    dayConfettiEnabled: row.dayConfettiEnabled === true,
  };
}

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
