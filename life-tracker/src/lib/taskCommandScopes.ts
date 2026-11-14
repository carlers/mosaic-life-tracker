import type { CategoryDocument, TaskDocument } from '../db/schema';
import { isValidCommandDate } from './taskCommands';

export type CommandDateWindow = { start: string; end: string; label: string };
export type CommandSelection = {
  ownerId: string;
  category: CategoryDocument | null;
  dateWindow: CommandDateWindow | null;
  completionFilter: boolean | null;
  matches: TaskDocument[];
};
export type CommandSelectionResult =
  | { status: 'preview'; selection: CommandSelection }
  | { status: 'needs_review'; reason: string };

function localDate(d: Date): string {
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0')].join('-');
}
function plusDays(now: Date, days: number): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  d.setDate(d.getDate() + days);
  return d;
}
export function commandTargetDate(expression: string, now = new Date()): string | null {
  const text = expression.trim().replace(/^on\s+/i, '').toLowerCase();
  if (text === 'today') return localDate(now);
  if (text === 'tomorrow') return localDate(plusDays(now, 1));
  if (text === 'next monday') {
    const delta = (8 - now.getDay()) % 7 || 7;
    return localDate(plusDays(now, delta));
  }
  return isValidCommandDate(text) ? text : null;
}
export function commandDateWindow(expression: string, now = new Date()): CommandDateWindow | null {
  const phrase = expression.trim().toLowerCase().replace(/^on\s+/,'');
  const date = (offset: number) => localDate(plusDays(now, offset));
  if (phrase === 'today') return { start: date(0), end: date(1), label: 'Today' };
  if (phrase === 'tomorrow') return { start: date(1), end: date(2), label: 'Tomorrow' };
  if (phrase === 'yesterday') return { start: date(-1), end: date(0), label: 'Yesterday' };
  const thisMonday = -((now.getDay() + 6) % 7);
  if (phrase === 'last week') return {
    start: date(thisMonday - 7), end: date(thisMonday), label: 'Last week (Mon–Sun)',
  };
  if (phrase === 'this week') return {
    start: date(thisMonday), end: date(thisMonday + 7), label: 'This week (Mon–Sun)',
  };
  if (phrase === 'next week') return {
    start: date(thisMonday + 7), end: date(thisMonday + 14), label: 'Next week (Mon–Sun)',
  };
  if (isValidCommandDate(phrase)) return {
    start: phrase, end: localDate(plusDays(new Date(Number(phrase.slice(0,4)),
      Number(phrase.slice(5,7)) - 1, Number(phrase.slice(8)), 12), 1)), label: phrase,
  };
  return null;
}
const WINDOW = '(?:today|tomorrow|yesterday|last week|this week|next week|on \\d{4}-\\d{2}-\\d{2})';
const DESCRIPTION = new RegExp('^(?:(unfinished|uncompleted|incomplete|completed)\\s+)?(.*?)tasks?(?:\\s+(?:from\\s+)?(' + WINDOW + '))?$', 'i');

/** Strict read-only selector. Neither transcript text nor a category name is a write authority. */
export function selectCommandTasks(
  descriptor: string, ownerId: string | null,
  categories: readonly CategoryDocument[], tasks: readonly TaskDocument[],
  now = new Date(),
): CommandSelectionResult {
  if (!ownerId || !Number.isFinite(now.getTime())) return {
    status: 'needs_review', reason: 'Sign in and review a valid date.',
  };
  const normalized = descriptor.trim().replace(/^my\s+/i, '').replace(/\s+/g, ' ');
  const m = DESCRIPTION.exec(normalized);
  if (!m) return { status: 'needs_review',
    reason: 'Specify exact tasks, a category, and a supported date such as today or last week.' };
  const [, completion, categoryText, windowText] = m;
  const dateWindow = windowText ? commandDateWindow(windowText, now) : null;
  if (windowText && !dateWindow) return { status: 'needs_review', reason: 'Date is not valid.' };
  const categoryName = categoryText.trim().replace(/^in\s+/i, '');
  const matching = categoryName ? categories.filter(c =>
    c.userId === ownerId && !c.isDeleted &&
    c.name.trim().toLocaleLowerCase() === categoryName.toLocaleLowerCase()) : [];
  if (categoryName && matching.length !== 1) return { status: 'needs_review',
    reason: 'Choose one exact category owned by this account.' };
  if (!categoryName && !dateWindow) return { status: 'needs_review',
    reason: 'Include a category or date range before reviewing all tasks.' };
  const filter = completion ? completion.toLowerCase() === 'completed' : null;
  const matches = tasks.filter(t =>
    t.userId === ownerId && !t.isDeleted &&
    (!matching.length || t.categoryId === matching[0].id) &&
    (filter === null || t.completed === filter) &&
    (!dateWindow || (t.date >= dateWindow.start && t.date < dateWindow.end))
  ).sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order ||
    a.id.localeCompare(b.id));
  return { status: 'preview', selection: {
    ownerId, category: matching[0] ?? null, dateWindow, completionFilter: filter, matches,
  } };
}

export function matchesCommandSelection(task: Pick<TaskDocument, 'date' | 'categoryId' | 'completed'>,
  selection: Pick<CommandSelection, 'category' | 'dateWindow' | 'completionFilter'>): boolean {
  return (!selection.category || selection.category.id === task.categoryId) &&
    (selection.completionFilter === null || selection.completionFilter === task.completed) &&
    (!selection.dateWindow || (task.date >= selection.dateWindow.start &&
      task.date < selection.dateWindow.end));
}
