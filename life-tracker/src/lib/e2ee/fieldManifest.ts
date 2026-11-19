/**
 * Preliminary field classification for E2EE M0 (#2083). Compile-time
 * completeness guard against adding unclassified owner-local fields.
 * This is NOT an assertion that encrypted backend paths exist.
 * routing = necessary server-visible or opaque ID; public = intentionally
 * exposed social data; encrypted = client-only payload on future cutover.
 */
import type {
  TaskDocument, CategoryDocument, DiaryDocument, BucketListDocument,
  BucketTaskLinkDocument, SettingsDocument, FriendshipDocument, MessageDocument,
} from '../../db/schema';

export type PrivacyClass = 'encrypted' | 'routing' | 'public';

export const ownerPrivacyFields = {
  tasks: {
    id:'routing', title:'encrypted', completed:'encrypted', categoryId:'encrypted',
    order:'encrypted', tags:'encrypted', date:'routing', memo:'encrypted', image:'encrypted',
    createdAt:'routing', completedAt:'encrypted', updatedAt:'routing',
    source:'encrypted', userId:'routing', isDeleted:'routing', routineId:'encrypted',
    reminderTime:'routing', reactions:'encrypted', visibility:'routing',
  } satisfies Record<keyof TaskDocument, PrivacyClass>,
  categories: {
    id:'routing', name:'encrypted', color:'encrypted', order:'encrypted',
    visibility:'routing', userId:'routing', isDeleted:'routing', icon:'encrypted',
    updatedAt:'routing', retiredOn:'encrypted',
  } satisfies Record<keyof CategoryDocument, PrivacyClass>,
  diary: {
    id:'routing', date:'routing', content:'encrypted', emoji:'encrypted',
    photos:'encrypted', visibility:'routing', userId:'routing',
    createdAt:'routing', updatedAt:'routing', isDeleted:'routing',
  } satisfies Record<keyof DiaryDocument, PrivacyClass>,
  bucketList: {
    id:'routing', userId:'routing', title:'encrypted', description:'encrypted',
    achieved:'encrypted', achievedAt:'encrypted', createdAt:'routing',
    updatedAt:'routing', isDeleted:'routing',
  } satisfies Record<keyof BucketListDocument, PrivacyClass>,
  bucketTaskLinks: {
    id:'routing', userId:'routing', bucketListId:'encrypted',
    taskId:'encrypted', createdAt:'routing', updatedAt:'routing', isDeleted:'routing',
  } satisfies Record<keyof BucketTaskLinkDocument, PrivacyClass>,
  settings: {
    id:'routing', userId:'routing', key:'encrypted', value:'encrypted',
    isDeleted:'routing', updatedAt:'routing',
  } satisfies Record<keyof SettingsDocument, PrivacyClass>,
  friendships: {
    id:'routing', userId:'routing', friendId:'routing',
    friendUsername:'public', friendDisplayName:'public', friendAvatarFileId:'public',
    friendBio:'public', status:'routing', createdAt:'routing',
    updatedAt:'routing', isDeleted:'routing',
  } satisfies Record<keyof FriendshipDocument, PrivacyClass>,
  messages: {
    id:'routing', userId:'routing', threadId:'routing', senderId:'routing',
    recipientId:'routing', direction:'encrypted', content:'encrypted',
    attachmentType:'encrypted', attachmentFileId:'encrypted',
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
