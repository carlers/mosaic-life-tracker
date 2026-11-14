import type { CategoryDocument, TaskDocument } from '../db/schema';
import { selectCommandTasks, type CommandSelection } from './taskCommandScopes';

export type ClipboardDraft =
  | { status: 'preview'; ownerId: string; selection: CommandSelection; matches: TaskDocument[]; categoryNames: Record<string,string> }
  | { status: 'needs_review' | 'unsupported'; reason: string };

const MAX_COPY_ROWS = 100;

/** Preview only: no clipboard side effects. User must explicitly press Copy. */
export function previewTaskClipboardCommand(
  input: string, ownerId: string | null, categories: readonly CategoryDocument[],
  tasks: readonly TaskDocument[], now = new Date(),
): ClipboardDraft | null {
  const text = input.trim().replace(/\s+/g, ' ').replace(/[.!?]+$/, '');
  if (!/^(?:copy|export)\b/i.test(text)) return null;
  const match = /^(?:copy|export) all (.+?) to (?:my |the )?clipboard$/i.exec(text);
  if (!match) return { status: 'unsupported',
    reason: 'Use “Copy all my tasks today to clipboard” and review the matches.' };
  const chosen = selectCommandTasks(match[1], ownerId, categories, tasks, now);
  if (chosen.status !== 'preview') return chosen;
  if (chosen.selection.matches.length > MAX_COPY_ROWS) return {
    status: 'needs_review', reason: 'Over 100 tasks match. Narrow the category or date.',
  };
  return { status: 'preview', ownerId: chosen.selection.ownerId,
    selection: chosen.selection, matches: chosen.selection.matches,
    categoryNames: Object.fromEntries(categories.filter(c => c.userId === ownerId && !c.isDeleted)
      .map(c => [c.id, c.name.trim()])) };
}

/** Plain-text output is only built after a user-initiated click and owner check. */
export function formatTasksForClipboard(draft: ClipboardDraft, ownerId: string): string {
  if (draft.status !== 'preview' || draft.ownerId !== ownerId ||
      draft.matches.length > MAX_COPY_ROWS ||
      draft.matches.some(row => row.userId !== ownerId || row.isDeleted))
    throw Error('Task selection is no longer valid for this account.');
  const names = new Map(Object.entries(draft.categoryNames));
  return draft.matches.map(t => {
    const title = t.title.trim().replace(/[\r\n\t]+/g, ' ').slice(0,255);
    const category = names.get(t.categoryId);
    return `- ${t.completed ? '[x]' : '[ ]'} ${title} (${t.date || 'Backlogs'}${category ? '; ' + category : ''})`;
  }).join('\n');
}
