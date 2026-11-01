import type { CategoryDocument, TaskDocument } from '../db/schema';

export type BulkMoveDraft =
  | { status: 'preview'; sourceCategory: CategoryDocument;
      destination: { type: 'backlogs' } | { type: 'category'; category: CategoryDocument };
      matches: TaskDocument[]; noOps: TaskDocument[]; ownerId: string }
  | { status: 'needs_review'; reason: string }
  | { status: 'unsupported'; reason: string };

/**
 * A read-only, deliberately narrow preview. Never use returned task objects or
 * IDs as authorization to mutate: global selection/hydration is not proven.
 */
export function previewBulkMoveCommand(
  input: string,
  ownerId: string | null,
  categories: readonly CategoryDocument[],
  tasks: readonly TaskDocument[],
): BulkMoveDraft | null {
  const text = input.trim().replace(/\s+/g, ' ');
  if (!/^(?:move|transfer)\s+/i.test(text)) return null;
  const match = /^(?:move|transfer) all (?:(unfinished|uncompleted|incomplete|completed) )?tasks from (.+?) to (.+)$/i.exec(text);
  if (!match) return { status: 'unsupported', reason: 'This bulk command is not supported yet. No tasks were changed.' };
  if (!ownerId) return { status: 'needs_review', reason: 'Sign in before previewing your own tasks.' };
  const [, completedFilter, source, destination] = match;
  const matchOwnedCategory = (name: string) => categories.filter(c =>
    c.userId === ownerId && !c.isDeleted &&
    c.name.trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase()
  );
  const from = matchOwnedCategory(source);
  if (from.length !== 1) return { status: 'needs_review',
    reason: 'Source category was missing or ambiguous. Choose an existing category.' };
  const isBacklogs = destination.trim().toLocaleLowerCase() === 'backlogs';
  const to = isBacklogs ? [] : matchOwnedCategory(destination);
  if (!isBacklogs && to.length !== 1) return { status: 'needs_review',
    reason: 'Destination was missing or ambiguous. Choose an existing category or Backlogs.' };
  const matching = tasks.filter(t => t.userId === ownerId && !t.isDeleted &&
    t.categoryId === from[0].id &&
    (!completedFilter || (completedFilter.toLowerCase() === 'completed' ? t.completed : !t.completed)));
  const sorted = [...matching].sort((a, b) => a.date.localeCompare(b.date) ||
    a.order - b.order || a.id.localeCompare(b.id));
  const noOps = sorted.filter(t => isBacklogs ? !t.date : t.categoryId === to[0].id);
  return { status: 'preview', sourceCategory: from[0], ownerId,
    destination: isBacklogs ? { type: 'backlogs' } : { type: 'category', category: to[0] },
    matches: sorted, noOps };
}
