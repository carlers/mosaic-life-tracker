/**
 * Synthetic, deterministic, provider-neutral RxDB contract fixtures for #967/#975.
 * Never import into the shipped app or submit to a hosted provider.
 * IDs represent disposable records; photo IDs represent references, not file bytes.
 */
import type {
  BucketListDocument,
  BucketTaskLinkDocument,
  CategoryDocument,
  DiaryDocument,
  FriendshipDocument,
  MessageDocument,
  SettingsDocument,
  TaskDocument,
} from '../../src/db/schema';

export interface BackendParityDocuments {
  tasks: TaskDocument[];
  categories: CategoryDocument[];
  diary: DiaryDocument[];
  settings: SettingsDocument[];
  friendships: FriendshipDocument[];
  messages: MessageDocument[];
  bucketList: BucketListDocument[];
  bucketTaskLinks: BucketTaskLinkDocument[];
}

export const PARITY_OWNERS = {
  a: 'synthetic_owner_a',
  b: 'synthetic_owner_b',
} as const;

const createdAt = '2026-10-15T10:00:00.000Z';
const updatedAt = '2026-10-19T10:00:00.000Z';
const deletedAt = '2026-10-19T11:00:00.000Z';

function forOwner(ownerId: string, peerId: string, label: 'a' | 'b'): BackendParityDocuments {
  const taskId = 'task_' + label;
  const categoryId = 'category_' + label;
  const goalId = 'goal_' + label;
  const outboundId = 'msg_' + label + '_to_' + (label === 'a' ? 'b' : 'a');
  const inboundSender = label === 'a' ? 'b' : 'a';
  const baseMessage: Omit<MessageDocument, 'id' | 'direction' | 'senderId' | 'recipientId' | 'originalMessageId'> = {
    userId: ownerId,
    threadId: 'synthetic_thread_a_b',
    content: 'synthetic message, no personal data',
    taskRefId: '',
    taskRefTitle: '',
    taskRefDate: '',
    taskRefColor: '',
    replyToId: '',
    replyToContent: '',
    replyToSenderId: '',
    isUnsent: false,
    reactions: '',
    readAt: '',
    deliveryStatus: 'delivered',
    createdAt,
    updatedAt,
    isDeleted: false,
  };
  const original: BackendParityDocuments = {
    tasks: [{
      id: taskId, title: 'synthetic private task', completed: false,
      categoryId, order: 2, date: '2026-10-19', tags: '',
      memo: 'synthetic newline\nand unicode ✓', image: '',
      createdAt, completedAt: '', updatedAt, source: '', routineId: '',
      reminderTime: '', reactions: '', visibility: 'private',
      userId: ownerId, isDeleted: false,
    }],
    categories: [{
      id: categoryId, name: 'synthetic category', color: '#336699',
      order: 1, visibility: 'private', userId: ownerId,
      isDeleted: false, icon: '', retiredOn: '', updatedAt,
    }],
    diary: [{
      id: 'diary_' + label, date: '2026-10-19',
      content: 'synthetic private diary, no personal data',
      emoji: '', photos: '["synthetic_photo_' + label + '"]',
      visibility: 'private', userId: ownerId,
      createdAt, updatedAt, isDeleted: false,
    }],
    settings: [{
      id: 'setting_' + label, userId: ownerId, key: 'syntheticPreference',
      value: '{"enabled":true}', updatedAt, isDeleted: false,
    }],
    friendships: [{
      id: 'friend_' + label, userId: ownerId, friendId: peerId,
      friendUsername: 'synthetic_' + inboundSender,
      friendDisplayName: 'Synthetic peer',
      friendAvatarFileId: '', friendBio: '', status: 'accepted',
      createdAt, updatedAt, isDeleted: false,
    }, {
      id: 'blocked_' + label, userId: ownerId, friendId: 'synthetic_blocked_' + label,
      friendUsername: '', friendDisplayName: '',
      friendAvatarFileId: '', friendBio: '', status: 'blocked',
      createdAt, updatedAt, isDeleted: false,
    }],
    messages: [{
      ...baseMessage, id: outboundId, direction: 'outgoing',
      senderId: ownerId, recipientId: peerId, originalMessageId: outboundId,
    }, {
      ...baseMessage, id: 'rmsg_' + inboundSender + '_to_' + label,
      direction: 'incoming', senderId: peerId, recipientId: ownerId,
      originalMessageId: 'msg_' + inboundSender + '_to_' + label,
      readAt: updatedAt,
    }],
    bucketList: [{
      id: goalId, userId: ownerId, title: 'synthetic goal',
      description: 'synthetic note', achieved: false, achievedAt: '',
      createdAt, updatedAt, isDeleted: false,
    }],
    bucketTaskLinks: [{
      id: 'link_' + label, userId: ownerId, bucketListId: goalId,
      taskId, createdAt, updatedAt, isDeleted: false,
    }],
  };

  // A second fixture per domain exercises logical tombstones without physical deletes.
  // The normal row stays intact so references remain meaningful for parity checks.
  return {
    tasks: [...original.tasks, { ...original.tasks[0], id: 'task_old_' + label, updatedAt: deletedAt, isDeleted: true }],
    categories: [...original.categories, { ...original.categories[0], id: 'category_old_' + label, updatedAt: deletedAt, isDeleted: true }],
    diary: [...original.diary, { ...original.diary[0], id: 'diary_old_' + label, updatedAt: deletedAt, isDeleted: true }],
    settings: [...original.settings, { ...original.settings[0], id: 'setting_old_' + label, updatedAt: deletedAt, isDeleted: true }],
    friendships: [...original.friendships, { ...original.friendships[0], id: 'friend_old_' + label, updatedAt: deletedAt, isDeleted: true }],
    messages: [...original.messages, { ...original.messages[0], id: 'msg_old_' + label, updatedAt: deletedAt, isDeleted: true }],
    bucketList: [...original.bucketList, { ...original.bucketList[0], id: 'goal_old_' + label, updatedAt: deletedAt, isDeleted: true }],
    bucketTaskLinks: [...original.bucketTaskLinks, { ...original.bucketTaskLinks[0], id: 'link_old_' + label, updatedAt: deletedAt, isDeleted: true }],
  };
}

export function makeBackendParityFixtures(): {
  a: BackendParityDocuments;
  b: BackendParityDocuments;
} {
  return {
    a: forOwner(PARITY_OWNERS.a, PARITY_OWNERS.b, 'a'),
    b: forOwner(PARITY_OWNERS.b, PARITY_OWNERS.a, 'b'),
  };
}
