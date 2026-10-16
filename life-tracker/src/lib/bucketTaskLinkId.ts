import { hashString } from './settingsRowId';

/** A stable, Appwrite-safe edge key. Independent of task category, date or title. */
export function makeBucketTaskLinkId(userId: string, bucketListId: string, taskId: string): string {
  return 'bl_' + hashString([userId, bucketListId, taskId].map(value => value.length + ':' + value).join('|'));
}
