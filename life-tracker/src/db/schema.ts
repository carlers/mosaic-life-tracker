import type { RxJsonSchema } from 'rxdb';
export interface TaskDocument {
  id: string;
  title: string;
  completed: boolean;
  categoryId: string;
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
}
export interface DiaryDocument {
  id: string;
  date: string;
  content?: string;
  visibility: 'public' | 'followers' | 'private';
  userId: string;
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
  status: 'pending_outgoing' | 'pending_incoming' | 'accepted' | 'blocked';
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
}
export interface MessageDocument {
  id: string;
  userId: string;
  threadId: string;
  senderId: string;
  recipientId: string;
  direction: 'outgoing' | 'incoming';
  content: string;
  taskRefId: string;
  taskRefTitle: string;
  taskRefDate: string;
  taskRefColor: string;
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
  version: 1,
  primaryKey: 'id',
  type: 'object',
  required: ['id', 'title', 'completed', 'categoryId', 'date', 'createdAt', 'updatedAt', 'userId', 'isDeleted'],
  properties: {
    id: { type: 'string', maxLength: 255 },
    title: { type: 'string', maxLength: 255 },
    completed: { type: 'boolean' },
    categoryId: { type: 'string', maxLength: 255 },
    tags: { type: 'string', maxLength: 1000 },
    date: { type: 'string', maxLength: 50 },
    memo: { type: 'string', maxLength: 2000 },
    image: { type: 'string', maxLength: 1000000 },
    createdAt: { type: 'string', maxLength: 50 },
    completedAt: { type: 'string', maxLength: 50 },
    updatedAt: { type: 'string', maxLength: 50 },
    source: { type: 'string', maxLength: 50 },
    userId: { type: 'string', maxLength: 255 },
    isDeleted: { type: 'boolean' },
    routineId: { type: 'string', maxLength: 255 },
    reminderTime: { type: 'string', maxLength: 50 },
    reactions: { type: 'string', maxLength: 5000 },
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
  version: 1,
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
    id: { type: 'string', maxLength: 255 },
    name: { type: 'string', maxLength: 100 },
    color: { type: 'string', maxLength: 20 },
    order: { type: 'integer', multipleOf: 1, minimum: 0, maximum: 999999 },
    visibility: {
      type: 'string',
      maxLength: 50,
      enum: ['public', 'followers', 'private'],
    },
    userId: { type: 'string', maxLength: 255 },
    isDeleted: { type: 'boolean' },
    icon: { type: 'string', maxLength: 10 },
    updatedAt: { type: 'string', maxLength: 50 },
  },
  indexes: [
    ['userId', 'isDeleted', 'order'],
    ['visibility', 'userId', 'isDeleted'],
  ],
};
export const diarySchema: RxJsonSchema<DiaryDocument> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  required: ['id', 'date', 'visibility', 'userId', 'createdAt', 'updatedAt', 'isDeleted'],
  properties: {
    id: { type: 'string', maxLength: 255 },
    date: { type: 'string', maxLength: 50 },
    content: { type: 'string' },
    visibility: { type: 'string', maxLength: 50, enum: ['public', 'followers', 'private'] },
    userId: { type: 'string', maxLength: 255 },
    createdAt: { type: 'string', maxLength: 50 },
    updatedAt: { type: 'string', maxLength: 50 },
    isDeleted: { type: 'boolean' },
  },
  indexes: [
    ['userId', 'date', 'isDeleted'],
    ['visibility', 'userId', 'isDeleted'],
  ],
};
export const settingsSchema: RxJsonSchema<SettingsDocument> = {
  version: 1,
  primaryKey: 'id',
  type: 'object',
  required: ['id', 'userId', 'key', 'value', 'isDeleted', 'updatedAt'],
  properties: {
    id: { type: 'string', maxLength: 255 },
    userId: { type: 'string', maxLength: 255 },
    key: { type: 'string', maxLength: 100 },
    value: { type: 'string', maxLength: 10000 },
    isDeleted: { type: 'boolean' },
    updatedAt: { type: 'string', maxLength: 50 },
  },
  indexes: [['userId', 'key', 'isDeleted']],
};
export const friendshipsSchema: RxJsonSchema<FriendshipDocument> = {
  version: 1,
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
    id: { type: 'string', maxLength: 550 },
    userId: { type: 'string', maxLength: 255 },
    friendId: { type: 'string', maxLength: 255 },
    friendUsername: { type: 'string', maxLength: 50 },
    friendDisplayName: { type: 'string', maxLength: 100 },
    friendAvatarFileId: { type: 'string', maxLength: 255 },
    friendBio: { type: 'string', maxLength: 300, default: '' },
    status: {
      type: 'string',
      maxLength: 30,
      enum: ['pending_outgoing', 'pending_incoming', 'accepted', 'blocked'],
    },
    createdAt: { type: 'string', maxLength: 50 },
    updatedAt: { type: 'string', maxLength: 50 },
    isDeleted: { type: 'boolean' },
  },
  indexes: [
    ['userId', 'isDeleted'],
    ['userId', 'status', 'isDeleted'],
    ['friendId', 'userId'],
  ],
};
export const messagesSchema: RxJsonSchema<MessageDocument> = {
  version: 3,
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
    id: { type: 'string', maxLength: 255 },
    userId: { type: 'string', maxLength: 255 },
    threadId: { type: 'string', maxLength: 50 },
    senderId: { type: 'string', maxLength: 255 },
    recipientId: { type: 'string', maxLength: 255 },
    direction: { type: 'string', maxLength: 20, enum: ['outgoing', 'incoming'] },
    content: { type: 'string', maxLength: 4000 },
    taskRefId: { type: 'string', maxLength: 255, default: '' },
    taskRefTitle: { type: 'string', maxLength: 500, default: '' },
    taskRefDate: { type: 'string', maxLength: 50, default: '' },
    taskRefColor: { type: 'string', maxLength: 20, default: '' },
    replyToId: { type: 'string', maxLength: 255, default: '' },
    replyToContent: { type: 'string', maxLength: 300, default: '' },
    replyToSenderId: { type: 'string', maxLength: 255, default: '' },
    isUnsent: { type: 'boolean', default: false },
    originalMessageId: { type: 'string', maxLength: 255, default: '' },
    reactions: { type: 'string', maxLength: 5000, default: '' },
    readAt: { type: 'string', maxLength: 50, default: '' },
    deliveryStatus: {
      type: 'string',
      maxLength: 20,
      enum: ['pending', 'delivered'],
      default: 'delivered',
    },
    createdAt: { type: 'string', maxLength: 50 },
    updatedAt: { type: 'string', maxLength: 50 },
    isDeleted: { type: 'boolean' },
  },
  indexes: [
    ['userId', 'threadId', 'createdAt'],
    ['userId', 'isDeleted', 'createdAt'],
    ['userId', 'direction', 'readAt'],
  ],
};
