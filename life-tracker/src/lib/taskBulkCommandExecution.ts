import type { CategoryDocument, TaskDocument } from '../db/schema';
import type { BulkMoveDraft } from './taskBulkCommandPreview';

export type FrozenMoveRow = Pick<TaskDocument,
  'id' | 'userId' | 'categoryId' | 'date' | 'completed' | 'updatedAt' | 'visibility' | 'isDeleted'>;
export type MovePatch = Pick<TaskDocument, 'updatedAt'> &
  Partial<Pick<TaskDocument, 'categoryId' | 'date' | 'visibility'>>;
export type BulkMovePlan = {
  ownerId: string; sourceCategoryId: string;
  destination: { type: 'backlogs' } | { type: 'category'; categoryId: string };
  rows: FrozenMoveRow[];
};
export type MoveRecord = { before: FrozenMoveRow; after: MovePatch };
export type BulkMoveOutcome = {
  applied: MoveRecord[]; noOps: string[]; conflicts: string[];
  failures: string[]; cancelled: boolean;
};

/**
 * Implementations must verify all expected snapshot fields inside an atomic
 * compare-and-patch, not in a prior read followed by an unconditional update.
 * Never accept an ID from the transcript as authority.
 */
export interface BulkMoveStore {
  currentOwner: () => string | null;
  readTask: (id: string) => Promise<TaskDocument | null>;
  readCategory: (id: string) => Promise<CategoryDocument | null>;
  comparePatch: (before: FrozenMoveRow, patch: MovePatch) => Promise<boolean>;
}

export function freezeMovePlan(draft: BulkMoveDraft): BulkMovePlan {
  if (draft.status !== 'preview') throw new Error('No reviewed move preview');
  const noOps = new Set(draft.noOps.map(row => row.id));
  const rows = draft.matches.filter(row => !noOps.has(row.id)).map(row => ({
    id: row.id, userId: row.userId, categoryId: row.categoryId,
    date: row.date, completed: row.completed, updatedAt: row.updatedAt,
    visibility: row.visibility, isDeleted: row.isDeleted,
  }));
  if (rows.length < 1 || rows.length > 100 ||
      new Set(rows.map(row => row.id)).size !== rows.length ||
      rows.some(row => row.userId !== draft.ownerId || row.isDeleted ||
        row.categoryId !== draft.sourceCategory.id)) {
    throw new Error('Review between 1 and 100 unique owned tasks');
  }
  return { ownerId: draft.ownerId, sourceCategoryId: draft.sourceCategory.id,
    destination: draft.destination.type === 'backlogs' ? { type: 'backlogs' } :
      { type: 'category', categoryId: draft.destination.category.id }, rows };
}

function unchanged(current: TaskDocument | null, frozen: FrozenMoveRow): boolean {
  return Boolean(current && current.id === frozen.id &&
    current.userId === frozen.userId && !current.isDeleted &&
    current.categoryId === frozen.categoryId && current.date === frozen.date &&
    current.completed === frozen.completed && current.visibility === frozen.visibility &&
    current.updatedAt === frozen.updatedAt);
}

async function validSource(plan: BulkMovePlan, store: BulkMoveStore): Promise<boolean> {
  const category = await store.readCategory(plan.sourceCategoryId);
  return Boolean(category && !category.isDeleted && category.userId === plan.ownerId);
}
async function validDestination(plan: BulkMovePlan, store: BulkMoveStore): Promise<boolean> {
  if (plan.destination.type !== 'category') return true;
  const category = await store.readCategory(plan.destination.categoryId);
  return Boolean(category && !category.isDeleted && category.userId === plan.ownerId);
}
function nextUpdatedAt(previous: string) {
  const now = Date.now();
  const prev = Date.parse(previous);
  return new Date(Number.isFinite(prev) ? Math.max(now, prev + 1) : now).toISOString();
}

/** Sequential, bounded writes; no false atomicity or background continuation. */
export async function executeMovePlan(plan: BulkMovePlan, store: BulkMoveStore,
  options: { cancelled?: () => boolean; onProgress?: (done: number, total: number) => void } = {},
): Promise<BulkMoveOutcome> {
  if (!plan.ownerId || !plan.sourceCategoryId || plan.rows.length < 1 ||
      plan.rows.length > 100 || new Set(plan.rows.map(row => row.id)).size !== plan.rows.length) {
    throw new Error('Invalid move batch');
  }
  if (store.currentOwner() !== plan.ownerId) throw new Error('Account changed');
  if (!(await validSource(plan, store))) throw new Error('Source category changed');
  if (!(await validDestination(plan, store))) throw new Error('Destination category changed');
  const outcome: BulkMoveOutcome = { applied: [], noOps: [], conflicts: [], failures: [], cancelled: false };
  for (const before of plan.rows) {
    if (options.cancelled?.() || store.currentOwner() !== plan.ownerId) {
      outcome.cancelled = true; break;
    }
    if (before.userId !== plan.ownerId || before.categoryId !== plan.sourceCategoryId ||
        before.isDeleted) { outcome.conflicts.push(before.id); continue; }
    try {
      if (!(await validSource(plan, store)) || !(await validDestination(plan, store)) ||
          !unchanged(await store.readTask(before.id), before)) {
        outcome.conflicts.push(before.id); continue;
      }
      const date = plan.destination.type === 'backlogs' ? '' : before.date;
      const categoryId = plan.destination.type === 'category' ? plan.destination.categoryId : before.categoryId;
      if (before.date === date && before.categoryId === categoryId) {
        outcome.noOps.push(before.id); continue;
      }
      const after: MovePatch = {
        updatedAt: nextUpdatedAt(before.updatedAt),
        ...(before.date !== date ? { date } : {}),
        ...(before.categoryId !== categoryId ? { categoryId } : {}),
        ...(date === '' ? { visibility: 'private' } : {}),
      };
      if (await store.comparePatch(before, after)) outcome.applied.push({ before, after });
      else outcome.conflicts.push(before.id);
    } catch { outcome.failures.push(before.id); }
    finally {
      options.onProgress?.(outcome.applied.length + outcome.noOps.length +
        outcome.conflicts.length + outcome.failures.length, plan.rows.length);
    }
  }
  return outcome;
}

/** Compensate only if the post-write state still matches the recorded write. */
export async function undoMovePlan(plan: BulkMovePlan, result: BulkMoveOutcome,
  store: BulkMoveStore): Promise<BulkMoveOutcome> {
  const outcome: BulkMoveOutcome = { applied: [], noOps: [], conflicts: [], failures: [], cancelled: false };
  for (const item of [...result.applied].reverse()) {
    if (store.currentOwner() !== plan.ownerId) { outcome.cancelled = true; break; }
    if (!(await validSource(plan, store))) { outcome.conflicts.push(item.before.id); continue; }
    let current: TaskDocument | null;
    try { current = await store.readTask(item.before.id); }
    catch { outcome.failures.push(item.before.id); continue; }
    if (!current || current.userId !== plan.ownerId || current.isDeleted ||
        current.updatedAt !== item.after.updatedAt ||
        (item.after.date !== undefined && current.date !== item.after.date) ||
        (item.after.categoryId !== undefined && current.categoryId !== item.after.categoryId) ||
        (item.after.visibility !== undefined && current.visibility !== item.after.visibility)) {
      outcome.conflicts.push(item.before.id); continue;
    }
    const before: FrozenMoveRow = {
      id: current.id, userId: current.userId, categoryId: current.categoryId,
      date: current.date, completed: current.completed, updatedAt: current.updatedAt,
      visibility: current.visibility, isDeleted: current.isDeleted,
    };
    try {
      const after: MovePatch = { date: item.before.date, categoryId: item.before.categoryId,
        visibility: item.before.visibility, updatedAt: nextUpdatedAt(before.updatedAt) };
      if (await store.comparePatch(before, after)) outcome.applied.push({ before, after });
      else outcome.conflicts.push(before.id);
    } catch { outcome.failures.push(before.id); }
  }
  return outcome;
}
