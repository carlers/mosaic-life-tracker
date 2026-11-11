import { getDatabase } from '../db/database';
import type { TaskDocument } from '../db/schema';
import { runBulkTaskActions, type BulkTaskActionProgress } from './bulkTaskActions';

type BulkTaskUpdates = Partial<Pick<TaskDocument, 'date' | 'visibility' | 'isDeleted'>>;

export async function updateOwnerTasksBatch(
  ownerId: string | undefined,
  taskSnapshots: readonly Pick<TaskDocument, 'id' | 'date'>[],
  updates: BulkTaskUpdates | ((task: TaskDocument) => BulkTaskUpdates),
  onProgress?: (progress: BulkTaskActionProgress) => void
): Promise<Set<string>> {
  const expectedDates = new Map(taskSnapshots.map(task => [task.id, task.date]));
  const selectedTaskIds = [...expectedDates.keys()];
  if (selectedTaskIds.length === 0) {
    onProgress?.({ completed: 0, total: 0, failed: 0 });
    return new Set<string>();
  }
  if (!ownerId) {
    return runBulkTaskActions(selectedTaskIds.map(id => ({ id })), async () => {
      throw new Error('Task owner unavailable');
    }, onProgress);
  }

  // One owner-scoped query replaces one findOne request per selected task.
  const docs = await getDatabase().tasks.find({
    selector: {
      userId: ownerId,
      id: { $in: selectedTaskIds },
      isDeleted: false,
    },
  }).exec();
  const docsById = new Map(docs.map(doc => [doc.id, doc]));
  const work = selectedTaskIds.map(id => ({ id, doc: docsById.get(id) }));
  const updatedAt = new Date().toISOString();

  return runBulkTaskActions(work, async ({ doc }) => {
    if (!doc) throw new Error('Task no longer belongs to this account');
    await doc.incrementalModify(current => {
      if (current.userId !== ownerId || current.isDeleted || current.date !== expectedDates.get(current.id)) {
        throw new Error('Task no longer belongs to this account');
      }
      const patch = typeof updates === 'function' ? updates(current) : updates;
      return { ...current, ...patch, updatedAt };
    });
  }, onProgress);
}
