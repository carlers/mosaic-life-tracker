import type { TaskDocument } from '../db/schema';

export const DAILY_REVIEW_PREFIX = 'daily_review_v1_';
export type ReviewResult = 'completed' | 'partial' | 'missed' | 'cancelled';
export type ReviewKind = 'plan' | 'execution' | 'day';

export interface ReviewRecord {
  version: 1;
  id: string;
  kind: ReviewKind;
  date: string;
  title: string;
  taskId: string;
  planId: string;
  /** Optional immutable category snapshot; absent on earlier records. */
  categoryName?: string;
  categoryColor?: string;
  result: ReviewResult | '';
  note: string;
  plannedAt: string;
  reviewedAt: string;
  createdAt: string;
}

export function validReviewDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [year, month, day] = date.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() + 1 === month && parsed.getUTCDate() === day;
}

export function parseReviewRecord(key: string, value: string): ReviewRecord | null {
  if (!key.startsWith(DAILY_REVIEW_PREFIX)) return null;
  try {
    const record: unknown = JSON.parse(value);
    if (!record || typeof record !== 'object') return null;
    const row = record as Partial<ReviewRecord>;
    if (row.version !== 1 || row.id !== key || !validReviewDate(row.date ?? '') ||
        !['plan', 'execution', 'day'].includes(row.kind ?? '') ||
        typeof row.title !== 'string' || row.title.length > 255 ||
        typeof row.note !== 'string' || row.note.length > 2000 ||
        typeof row.taskId !== 'string' || typeof row.planId !== 'string' ||
        (row.categoryName !== undefined && (typeof row.categoryName !== 'string' || row.categoryName.length > 100)) ||
        (row.categoryColor !== undefined && (typeof row.categoryColor !== 'string' || row.categoryColor.length > 20)) ||
        typeof row.createdAt !== 'string' ||
        typeof row.plannedAt !== 'string' || typeof row.reviewedAt !== 'string' ||
        !['completed', 'partial', 'missed', 'cancelled', ''].includes(row.result ?? '')) return null;
    return row as ReviewRecord;
  } catch {
    return null;
  }
}

export function planForDay(records: readonly ReviewRecord[], date: string): ReviewRecord[] {
  return records.filter(record => record.kind === 'plan' && record.date === date)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

export function executionForDay(records: readonly ReviewRecord[], date: string): ReviewRecord[] {
  return records.filter(record => record.kind === 'execution' && record.date === date)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

export function reviewDay(records: readonly ReviewRecord[], date: string): ReviewRecord | undefined {
  return records.find(record => record.kind === 'day' && record.date === date);
}

export function outcomeForPlan(
  records: readonly ReviewRecord[],
  plan: ReviewRecord,
  reviewed: boolean
): ReviewResult | 'not-recorded' {
  const latest = records.filter(record =>
    record.kind === 'execution' && record.planId === plan.id && record.result
  ).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))[0];
  if (latest) return latest.result as ReviewResult;
  return reviewed ? 'missed' : 'not-recorded';
}

export function taskCompletionOnDay(task: TaskDocument, date: string): boolean {
  if (!task.completed || !task.completedAt) return false;
  const completed = new Date(task.completedAt);
  if (Number.isNaN(completed.getTime())) return false;
  const local = [completed.getFullYear(), String(completed.getMonth() + 1).padStart(2, '0'), String(completed.getDate()).padStart(2, '0')].join('-');
  return local === date;
}
