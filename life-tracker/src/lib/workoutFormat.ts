import type { ActivityDocument } from '../db/schema';

export function formatWorkoutDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const whole = Math.round(seconds);
  const hours = Math.floor(whole / 3600);
  const mins = Math.floor((whole % 3600) / 60);
  const secs = whole % 60;
  return hours > 0
    ? `${hours}:${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`
    : `${mins}:${String(secs).padStart(2,'0')}`;
}

export function workoutCompletedText(row: Pick<ActivityDocument, 'completedAt' | 'localDate'>): { day: string; time: string } {
  const time = new Date(row.completedAt);
  if (Number.isNaN(time.getTime())) return { day: row.localDate, time: '—' };
  return {
    day: new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(time),
    time: new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(time),
  };
}
