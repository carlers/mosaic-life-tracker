import type { TaskDocument, CategoryDocument, DiaryDocument } from '../db/schema';
import type { CandidateConflictReview } from '../../supabase-poc/candidateRxdbPilot';
import type { SyncConflict } from './syncConflictReview';

const labels: Record<string, string> = {
  title: 'Title', name: 'Name', completed: 'Completed', date: 'Date',
  memo: 'Notes', tags: 'Tags', categoryId: 'Category', order: 'Order',
  isDeleted: 'Deleted', color: 'Color', icon: 'Icon', image: 'Image',
  visibility: 'Visibility', routineId: 'Routine', reminderTime: 'Reminder',
  source: 'Source', createdAt: 'Created', completedAt: 'Completed at',
  updatedAt: 'Updated', reactions: 'Reactions',
  content: 'Diary entry', emoji: 'Mood', photos: 'Attachments',
};
const display = (value: unknown) => value === true ? 'Yes' : value === false ? 'No' :
  value === undefined || value === null || value === '' ? 'None' : String(value);

export function presentSupabaseConflicts(input: {
  tasks: CandidateConflictReview<TaskDocument>[];
  categories: CandidateConflictReview<CategoryDocument>[];
  diary?: CandidateConflictReview<DiaryDocument>[];
}): SyncConflict[] {
  return [...input.tasks, ...input.categories, ...(input.diary ?? [])].map(review => {
    if (review.domain !== 'tasks' && review.domain !== 'categories' && review.domain !== 'diary')
      throw new Error('Unrecognized Supabase personal conflict domain');
    const local = review.local as unknown as Record<string, unknown>;
    const remote = review.remote as unknown as Record<string, unknown> | null;
    return {
      domain: review.domain, documentId: review.documentId,
      title: String(local.title ?? local.name ??
        (review.domain === 'diary' ? 'Diary ' + String(local.date ?? 'entry') : 'Deleted item')),
      revision: review.remoteRevision,
      canKeepLocal: review.remoteRevision !== null && review.remote !== null &&
        review.reason !== 'protected-field-change' &&
        (review.domain !== 'tasks' || local.createdAt === remote?.createdAt &&
          (local.reactions ?? '') === (remote?.reactions ?? '')) &&
        (review.domain !== 'diary' || (
          local.date === remote?.date && local.createdAt === remote?.createdAt &&
          (local.photos ?? '[]') === (remote?.photos ?? '[]') &&
          local.visibility === 'private' && remote?.visibility === 'private'
        )),
      fields: Object.entries(labels).filter(([key]) =>
        (key in local || remote && key in remote) &&
        display(local[key]) !== (remote ? display(remote[key]) : 'Missing'),
      ).map(([key, label]) => ({
        label, local: display(local[key]), remote: remote ? display(remote[key]) : 'Missing',
      })),
    };
  });
}
