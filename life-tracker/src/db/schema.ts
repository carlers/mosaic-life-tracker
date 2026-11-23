import type { RxJsonSchema } from 'rxdb';

// Build distinct property validators once at schema declaration time. Each call
// returns a fresh object, keeping RxDB's schema behavior and field isolation.
const boundedTextField = (maxLength: number) => ({ type: 'string' as const, maxLength });
const optionalTextField = (maxLength: number) => ({ type: 'string' as const, maxLength, default: '' });
export interface TaskDocument {
  id: string;
  title: string;
  completed: boolean;
  categoryId: string;
  order: number;
  tags?: string;
  date: string;
  memo?: string;
  image?: string;
  createdAt: string;
  completedAt?: string;
  updatedAt: string;
  source?: string;
  userId: string;
  isDeleted: boolean;
  routineId?: string;
  reminderTime?: string;
  reactions?: string;
  visibility: 'public' | 'followers' | 'private' | '';
}
export interface CategoryDocument {
  id: string;
  name: string;
  color: string;
  order: number;
  visibility: 'public' | 'followers' | 'private';
  userId: string;
  isDeleted: boolean;
  icon?: string;
  updatedAt: string;
  /** Inclusive owner-local date; empty means active. */
  startedOn?: string;
  retiredOn?: string;
}
export interface DiaryDocument {
  id: string;
  date: string;
  content?: string;
  /** Optional owner-selected day marker; legacy entries retain their original content. */
  emoji?: string;
  /** JSON-encoded ordered IDs; bounded to five owner-private photos. */
  photos?: string;
  visibility: 'public' | 'followers' | 'private';
  userId: string;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
}
export interface BucketListDocument {
  id: string;
  userId: string;
  title: string;
  description: string;
  achieved: boolean;
  achievedAt: string;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
}
export interface BucketTaskLinkDocument {
  id: string;
  userId: string;
  bucketListId: string;
  taskId: string;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
}
export interface SettingsDocument {
  id: string;
  userId: string;
  key: string;
  value: string;
  isDeleted: boolean;
  updatedAt: string;
}
export interface FriendshipDocument {
  id: string;
  userId: string;
  friendId: string;
  friendUsername: string;
  friendDisplayName: string;
  friendAvatarFileId: string;
  friendBio: string;
  /** Trusted acceptance time; empty for legacy accepted rows. */
  acceptedAt?: string;
  status: 'pending_outgoing' | 'pending_incoming' | 'accepted' | 'blocked';
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
}
export interface SyncMetaDocument {
  id: string;
  userId: string;
  collectionName:
    | 'tasks'
    | 'categories'
    | 'diary'
    | 'settings'
    | 'friendships'
    | 'messages'
    | 'bucketList'
    | 'bucketTaskLinks';
  replicationIdentifier: string;
  lastFreshAt: string;
}

export interface MessageDocument {
  id: string;
  userId: string;
  threadId: string;
  senderId: string;
  recipientId: string;
  direction: 'outgoing' | 'incoming';
  content: string;
  /** Optional chat photo reference, never a client-selected URL. */
  attachmentType?: 'image' | '';
  attachmentFileId?: string;
  /** Server-authored chat system event; empty for ordinary messages. */
  taskRequestId?: string;
  taskRequestEvent?: '' | 'created' | 'accepted' | 'declined' | 'withdrawn';
  taskRefId: string;
  taskRefTitle: string;
  taskRefDate: string;
  taskRefColor: string;
  diaryRefId?: string;
  diaryRefOwnerId?: string;
  diaryRefDate?: string;
  diaryRefExcerpt?: string;
  diaryRefEpoch?: number;
  replyToId: string;
  replyToContent: string;
  replyToSenderId: string;
  isUnsent: boolean;
  originalMessageId: string;
  reactions: string;
  readAt: string;
  deliveryStatus: 'pending' | 'delivered';
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
}
export const tasksSchema: RxJsonSchema<TaskDocument> = {
  version: 2,
  primaryKey: 'id',
  type: 'object',
  required: ['id', 'title', 'completed', 'categoryId', 'order', 'date', 'createdAt', 'updatedAt', 'userId', 'isDeleted'],
  properties: {
    id: boundedTextField(255),
    title: boundedTextField(255),
    completed: { type: 'boolean' },
    categoryId: boundedTextField(255),
    order: { type: 'integer', multipleOf: 1, minimum: 0, maximum: 999999 },
    tags: boundedTextField(1000),
    date: boundedTextField(50),
    memo: boundedTextField(2000),
    image: boundedTextField(1000000),
    createdAt: boundedTextField(50),
    completedAt: boundedTextField(50),
    updatedAt: boundedTextField(50),
    source: boundedTextField(50),
    userId: boundedTextField(255),
    isDeleted: { type: 'boolean' },
    routineId: boundedTextField(255),
    reminderTime: boundedTextField(50),
    reactions: boundedTextField(5000),
    visibility: {
      type: 'string',
      maxLength: 50,
      enum: ['public', 'followers', 'private', ''],
      default: '',
    },
  },
  indexes: [
    ['userId', 'isDeleted'],
    ['date', 'userId', 'isDeleted'],
    ['categoryId', 'userId', 'isDeleted'],
    ['completed', 'userId', 'isDeleted'],
  ],
};
export const categoriesSchema: RxJsonSchema<CategoryDocument> = {
  version: 3,
  primaryKey: 'id',
  type: 'object',
  required: [
    'id',
    'name',
    'color',
    'order',
    'visibility',
    'userId',
    'isDeleted',
    'updatedAt',
  ],
  properties: {
    id: boundedTextField(255),
    name: boundedTextField(100),
    color: boundedTextField(20),
    order: { type: 'integer', multipleOf: 1, minimum: 0, maximum: 999999 },
    visibility: {
      type: 'string',
      maxLength: 50,
      enum: ['public', 'followers', 'private'],
    },
    userId: boundedTextField(255),
    isDeleted: { type: 'boolean' },
    icon: boundedTextField(10),
    startedOn: optionalTextField(10),
    retiredOn: optionalTextField(10),
    updatedAt: boundedTextField(50),
  },
  indexes: [
    ['userId', 'isDeleted', 'order'],
    ['visibility', 'userId', 'isDeleted'],
  ],
};
export const diarySchema: RxJsonSchema<DiaryDocument> = {
  version: 2,
  primaryKey: 'id',
  type: 'object',
  required: ['id', 'date', 'visibility', 'userId', 'createdAt', 'updatedAt', 'isDeleted'],
  properties: {
    id: boundedTextField(255),
    date: boundedTextField(50),
    content: { type: 'string' },
    emoji: optionalTextField(32),
    photos: { type: 'string', maxLength: 512, default: '[]' },
    visibility: { type: 'string', maxLength: 50, enum: ['public', 'followers', 'private'] },
    userId: boundedTextField(255),
    createdAt: boundedTextField(50),
    updatedAt: boundedTextField(50),
    isDeleted: { type: 'boolean' },
  },
  indexes: [
    ['userId', 'date', 'isDeleted'],
    ['visibility', 'userId', 'isDeleted'],
  ],
};
export const bucketListSchema: RxJsonSchema<BucketListDocument> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  required: ['id', 'userId', 'title', 'description', 'achieved', 'achievedAt', 'createdAt', 'updatedAt', 'isDeleted'],
  properties: {
    id: boundedTextField(36),
    userId: boundedTextField(255),
    title: boundedTextField(255),
    description: boundedTextField(2000),
    achieved: { type: 'boolean' },
    achievedAt: boundedTextField(50),
    createdAt: boundedTextField(50),
    updatedAt: boundedTextField(50),
    isDeleted: { type: 'boolean' },
  },
  indexes: [['userId', 'isDeleted'], ['userId', 'achieved', 'isDeleted']],
};
export const bucketTaskLinksSchema: RxJsonSchema<BucketTaskLinkDocument> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  required: ['id','userId','bucketListId','taskId','createdAt','updatedAt','isDeleted'],
  properties: {
    id: boundedTextField(36),
    userId: boundedTextField(255),
    bucketListId: boundedTextField(36),
    taskId: boundedTextField(255),
    createdAt: boundedTextField(50),
    updatedAt: boundedTextField(50),
    isDeleted: { type: 'boolean' },
  },
  indexes: [['userId','bucketListId','isDeleted'],['userId','taskId','isDeleted']],
};
export const settingsSchema: RxJsonSchema<SettingsDocument> = {
  version: 1,
  primaryKey: 'id',
  type: 'object',
  required: ['id', 'userId', 'key', 'value', 'isDeleted', 'updatedAt'],
  properties: {
    id: boundedTextField(255),
    userId: boundedTextField(255),
    key: boundedTextField(100),
    value: boundedTextField(10000),
    isDeleted: { type: 'boolean' },
    updatedAt: boundedTextField(50),
  },
  indexes: [['userId', 'key', 'isDeleted']],
};
export const friendshipsSchema: RxJsonSchema<FriendshipDocument> = {
  version: 2,
  primaryKey: 'id',
  type: 'object',
  required: [
    'id',
    'userId',
    'friendId',
    'friendUsername',
    'friendDisplayName',
    'status',
    'createdAt',
    'updatedAt',
    'isDeleted',
  ],
  properties: {
    id: boundedTextField(550),
    userId: boundedTextField(255),
    friendId: boundedTextField(255),
    friendUsername: boundedTextField(50),
    friendDisplayName: boundedTextField(100),
    friendAvatarFileId: boundedTextField(255),
    friendBio: optionalTextField(300),
    acceptedAt: { type: 'string', maxLength: 50, default: '' },
    status: {
      type: 'string',
      maxLength: 30,
      enum: ['pending_outgoing', 'pending_incoming', 'accepted', 'blocked'],
    },
    createdAt: boundedTextField(50),
    updatedAt: boundedTextField(50),
    isDeleted: { type: 'boolean' },
  },
  indexes: [
    ['userId', 'isDeleted'],
    ['userId', 'status', 'isDeleted'],
    ['friendId', 'userId'],
  ],
};
// v7 adds typed task request system events; v6 on-disk records remain valid.
export const messagesSchema: RxJsonSchema<MessageDocument> = {
  version: 7,
  primaryKey: 'id',
  type: 'object',
  required: [
    'id',
    'userId',
    'threadId',
    'senderId',
    'recipientId',
    'direction',
    'content',
    'taskRefId',
    'taskRefTitle',
    'taskRefDate',
    'taskRefColor',
    'replyToId',
    'replyToContent',
    'replyToSenderId',
    'isUnsent',
    'originalMessageId',
    'reactions',
    'readAt',
    'deliveryStatus',
    'createdAt',
    'updatedAt',
    'isDeleted',
  ],
  properties: {
    id: boundedTextField(255),
    userId: boundedTextField(255),
    threadId: boundedTextField(50),
    senderId: boundedTextField(255),
    recipientId: boundedTextField(255),
    direction: { type: 'string', maxLength: 20, enum: ['outgoing', 'incoming'] },
    content: boundedTextField(4000),
    attachmentType: { type: 'string', enum: ['', 'image'], maxLength: 12, default: '' },
    attachmentFileId: optionalTextField(36),
    taskRequestId: optionalTextField(36),
    taskRequestEvent: { type: 'string', enum: ['', 'created','accepted','declined','withdrawn'], maxLength: 20, default: '' },
    taskRefId: optionalTextField(255),
    taskRefTitle: optionalTextField(500),
    taskRefDate: optionalTextField(50),
    taskRefColor: optionalTextField(20),
    diaryRefId: optionalTextField(36),
    diaryRefOwnerId: optionalTextField(36),
    diaryRefDate: optionalTextField(10),
    diaryRefExcerpt: optionalTextField(160),
    diaryRefEpoch: { type: 'integer', minimum: 0, default: 0 },
    replyToId: optionalTextField(255),
    replyToContent: optionalTextField(300),
    replyToSenderId: optionalTextField(255),
    isUnsent: { type: 'boolean', default: false },
    originalMessageId: optionalTextField(255),
    reactions: optionalTextField(5000),
    readAt: optionalTextField(50),
    deliveryStatus: {
      type: 'string',
      maxLength: 20,
      enum: ['pending', 'delivered'],
      default: 'delivered',
    },
    createdAt: boundedTextField(50),
    updatedAt: boundedTextField(50),
    isDeleted: { type: 'boolean' },
  },
  indexes: [
    ['userId', 'threadId', 'createdAt'],
    ['userId', 'isDeleted', 'createdAt'],
    ['userId', 'direction', 'readAt'],
  ],
};
// Whenever this collection's schema changes, bump the version and migrate persisted rows.
// v3 expands collectionName to include bucketTaskLinks (v2 installs must not hit DB6).
export const syncMetaSchema: RxJsonSchema<SyncMetaDocument> = {
  version: 3,
  primaryKey: 'id',
  type: 'object',
  required: [
    'id',
    'userId',
    'collectionName',
    'replicationIdentifier',
    'lastFreshAt',
  ],
  properties: {
    id: boundedTextField(550),
    userId: boundedTextField(255),
    collectionName: {
      type: 'string',
      maxLength: 20,
      enum: [
        'tasks',
        'categories',
        'diary',
        'settings',
        'friendships',
        'messages',
        'bucketList',
        'bucketTaskLinks',
      ],
    },
    replicationIdentifier: boundedTextField(500),
    lastFreshAt: boundedTextField(50),
  },
  indexes: [['userId', 'collectionName']],
};

