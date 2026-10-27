import type { TaskDocument, CategoryDocument, DiaryDocument, SettingsDocument, BucketListDocument, BucketTaskLinkDocument } from '../db/schema';
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
  key: 'Preference', value: 'Value', bucketListId: 'Bucket List goal', taskId: 'Task',
  description: 'Description', achieved: 'Achieved', achievedAt: 'Achieved at',
};
const display = (value: unknown) => value === true ? 'Yes' : value === false ? 'No' :
  value === undefined || value === null || value === '' ? 'None' : String(value);

type PersonalDocument = TaskDocument | CategoryDocument | DiaryDocument | SettingsDocument | BucketListDocument | BucketTaskLinkDocument;
export function presentSupabaseConflicts(input: Record<string, CandidateConflictReview<PersonalDocument>[]>): SyncConflict[] {
  return Object.values(input).flat().map(review => {
    if (!['tasks', 'categories', 'diary', 'settings', 'buckets', 'bucket_task_links'].includes(review.domain))
      throw new Error('Unrecognized Supabase personal conflict domain');
    const local = review.local as unknown as Record<string, unknown>;
    const remote = review.remote as unknown as Record<string, unknown> | null;
    return {
      domain: review.domain as SyncConflict['domain'], documentId: review.documentId,
      title: String(local.title ?? local.name ?? local.key ??
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
        )) &&
        (review.domain !== 'settings' || local.key === remote?.key) &&
        (review.domain !== 'buckets' || local.createdAt === remote?.createdAt) &&
        (review.domain !== 'bucket_task_links' || local.taskId === remote?.taskId &&
          local.bucketListId === remote?.bucketListId && local.createdAt === remote?.createdAt),
      fields: Object.entries(labels).filter(([key]) =>
        (key in local || remote && key in remote) &&
        display(local[key]) !== (remote ? display(remote[key]) : 'Missing'),
      ).map(([key, label]) => ({
        label, local: display(local[key]), remote: remote ? display(remote[key]) : 'Missing',
      })),
    };
  });
}
