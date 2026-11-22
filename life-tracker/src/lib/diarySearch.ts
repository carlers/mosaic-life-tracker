import { endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from 'date-fns';
import type { CategoryDocument, DiaryDocument } from '../db/schema';
import type { TaskSearchOptions } from './taskSearch';
import { noteCategoryId, noteDisplayTitle, noteTitleFor } from './diaryNotes';

export interface DiarySearchHit {
  entry: DiaryDocument;
  rank: number;
  title: string;
  excerpt: string;
  categoryId: string;
}
export interface DiarySearchResult {
  results: DiarySearchHit[];
  total: number;
}

function matchesDiaryDate(date: string, options: TaskSearchOptions, now: Date): boolean {
  const range = options.dateFilter;
  if (range === 'any') return true;
  const today = format(now, 'yyyy-MM-dd');
  if (range === 'today') return date === today;
  if (range === 'week')
    return date >= format(startOfWeek(now, { weekStartsOn: 0 }), 'yyyy-MM-dd') &&
      date <= format(endOfWeek(now, { weekStartsOn: 0 }), 'yyyy-MM-dd');
  if (range === 'month')
    return date >= format(startOfMonth(now), 'yyyy-MM-dd') &&
      date <= format(endOfMonth(now), 'yyyy-MM-dd');
  if (range !== 'custom') return true;
  const [start, end] = [options.customStart || '', options.customEnd || ''];
  const low = start && end && start > end ? end : start;
  const high = start && end && start > end ? start : end;
  return (!low || date >= low) && (!high || date <= high);
}

function excerpt(content: string, query: string): string {
  const singleLine = content.replace(/\s+/g, ' ').trim();
  if (!query) return singleLine.slice(0, 155);
  const index = singleLine.toLocaleLowerCase().indexOf(query);
  if (index < 0) return singleLine.slice(0, 155);
  const start = Math.max(0, index - 45);
  return (start ? '…' : '') + singleLine.slice(start, start + 155) +
    (start + 155 < singleLine.length ? '…' : '');
}

/** Searches only the supplied owner's Diary rows; caller must scope subscription. */
export function filterAndRankDiary(
  entries: readonly DiaryDocument[],
  options: TaskSearchOptions,
  categories: readonly CategoryDocument[],
  getSetting: (key: string) => unknown,
): DiarySearchResult {
  const query = options.query.trim().toLocaleLowerCase();
  const now = options.now ?? new Date();
  const selected = new Set(options.categoryIds);
  const matches: DiarySearchHit[] = [];
  for (const entry of entries) {
    if (entry.isDeleted || !matchesDiaryDate(entry.date, options, now)) continue;
    const categoryId = noteCategoryId(entry.id, getSetting, categories);
    if (selected.size && !selected.has(categoryId)) continue;
    const title = noteDisplayTitle(entry, getSetting);
    const explicitTitle = noteTitleFor(entry, getSetting).toLocaleLowerCase();
    const body = (entry.content ?? '').toLocaleLowerCase();
    const rank = !query ? 0 :
      explicitTitle === query ? 0 :
      explicitTitle.startsWith(query) ? 1 :
      explicitTitle.includes(query) ? 2 :
      body.includes(query) ? 3 : -1;
    if (rank < 0) continue;
    matches.push({ entry, rank, title,
      excerpt: excerpt(entry.content ?? '', query), categoryId });
  }
  matches.sort((a, b) => a.rank - b.rank ||
    b.entry.date.localeCompare(a.entry.date) ||
    b.entry.createdAt.localeCompare(a.entry.createdAt) ||
    a.entry.id.localeCompare(b.entry.id));
  const limit = Math.max(1, options.limit ?? 50);
  return { total: matches.length, results: matches.slice(0, limit) };
}
