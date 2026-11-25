/**
 * Preliminary field classification for E2EE M0 (#2083). Compile-time
 * completeness guard against adding unclassified owner-local fields.
 * This is NOT an assertion that encrypted backend paths exist.
 * Updated against dev v0.151.0 Activities, category start dates and task requests.
 * routing = necessary server-visible or opaque ID; public = intentionally
 * exposed social data; encrypted = client-only payload on future cutover.
 * Original local IDs must be encrypted: remote rows get separate opaque IDs.
 */
import type {
  TaskDocument, CategoryDocument, DiaryDocument, BucketListDocument,
  BucketTaskLinkDocument, SettingsDocument, FriendshipDocument, MessageDocument,
  ActivityDocument, ActivityTaskLinkDocument,
} from '../../db/schema';

export type PrivacyClass = 'encrypted' | 'routing' | 'public';

export const ownerPrivacyFields = {
  tasks: {
    id:'encrypted', title:'encrypted', completed:'encrypted', categoryId:'encrypted',
    order:'encrypted', tags:'encrypted', date:'routing', memo:'encrypted', image:'encrypted',
    createdAt:'routing', completedAt:'encrypted', updatedAt:'routing',
    source:'encrypted', userId:'routing', isDeleted:'routing', routineId:'encrypted',
    reminderTime:'routing', reactions:'encrypted', visibility:'routing',
  } satisfies Record<keyof TaskDocument, PrivacyClass>,
  categories: {
    id:'encrypted', name:'encrypted', color:'encrypted', order:'encrypted',
    visibility:'routing', userId:'routing', isDeleted:'routing', icon:'encrypted',
    updatedAt:'routing', startedOn:'encrypted', retiredOn:'encrypted',
  } satisfies Record<keyof CategoryDocument, PrivacyClass>,
  activities: {
    id:'encrypted', userId:'routing', title:'encrypted', sport:'encrypted',
    localDate:'encrypted', completedAt:'encrypted', distanceMeters:'encrypted',
    elapsedSeconds:'encrypted', source:'encrypted', fingerprint:'encrypted',
    categoryId:'encrypted', order:'encrypted', createdAt:'routing',
    updatedAt:'routing', isDeleted:'routing',
  } satisfies Record<keyof ActivityDocument, PrivacyClass>,
  activityTaskLinks: {
    id:'encrypted', userId:'routing', activityId:'encrypted', taskId:'encrypted',
    createdAt:'routing', updatedAt:'routing', isDeleted:'routing',
  } satisfies Record<keyof ActivityTaskLinkDocument, PrivacyClass>,
  diary: {
    id:'encrypted', date:'routing', content:'encrypted', emoji:'encrypted',
    photos:'encrypted', visibility:'routing', userId:'routing',
    createdAt:'routing', updatedAt:'routing', isDeleted:'routing',
  } satisfies Record<keyof DiaryDocument, PrivacyClass>,
  bucketList: {
    id:'encrypted', userId:'routing', title:'encrypted', description:'encrypted',
    achieved:'encrypted', achievedAt:'encrypted', createdAt:'routing',
    updatedAt:'routing', isDeleted:'routing',
  } satisfies Record<keyof BucketListDocument, PrivacyClass>,
  bucketTaskLinks: {
    id:'encrypted', userId:'routing', bucketListId:'encrypted',
    taskId:'encrypted', createdAt:'routing', updatedAt:'routing', isDeleted:'routing',
  } satisfies Record<keyof BucketTaskLinkDocument, PrivacyClass>,
  settings: {
    id:'encrypted', userId:'routing', key:'encrypted', value:'encrypted',
    isDeleted:'routing', updatedAt:'routing',
  } satisfies Record<keyof SettingsDocument, PrivacyClass>,
  friendships: {
    id:'encrypted', userId:'routing', friendId:'routing',
    friendUsername:'public', friendDisplayName:'public', friendAvatarFileId:'public',
    friendBio:'public', acceptedAt:'routing', status:'routing', createdAt:'routing',
    updatedAt:'routing', isDeleted:'routing',
  } satisfies Record<keyof FriendshipDocument, PrivacyClass>,
  messages: {
    id:'encrypted', userId:'routing', threadId:'routing', senderId:'routing',
    recipientId:'routing', direction:'encrypted', content:'encrypted',
    attachmentType:'encrypted', attachmentFileId:'encrypted',
    taskRequestId:'encrypted', taskRequestEvent:'encrypted',
    taskRefId:'encrypted', taskRefTitle:'encrypted', taskRefDate:'encrypted',
    taskRefColor:'encrypted', diaryRefId:'encrypted', diaryRefOwnerId:'encrypted',
    diaryRefDate:'encrypted', diaryRefExcerpt:'encrypted', diaryRefEpoch:'encrypted',
    replyToId:'encrypted', replyToContent:'encrypted', replyToSenderId:'encrypted',
    isUnsent:'encrypted', originalMessageId:'encrypted', reactions:'encrypted',
    readAt:'routing', deliveryStatus:'routing',
    createdAt:'routing', updatedAt:'routing', isDeleted:'routing',
  } satisfies Record<keyof MessageDocument, PrivacyClass>,
} as const;

/** Server metadata exceptions still require threat-model disclosure/validation. */
export function classifiedFields(collection: keyof typeof ownerPrivacyFields): string[] {
  return Object.keys(ownerPrivacyFields[collection]);
}
