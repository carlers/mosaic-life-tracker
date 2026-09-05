import type { RxJsonSchema } from 'rxdb';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

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
  visibility: 'public' | 'followers' | 'private';
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
}

// ============================================================================
// RXDB SCHEMAS (v17 Dev-Mode Compliant)
// ============================================================================

/**
 * RULES APPLIED FOR DEV-MODE COMPLIANCE:
 * 1. All indexed strings MUST have maxLength (SC34)
 * 2. All indexed numbers/integers MUST have multipleOf: 1 (SC35)
 * 3. All indexed integers MUST have minimum & maximum bounds (SC37)
 * 4. 'deleted' is reserved; using 'isDeleted' instead (SC17)
 */

export const tasksSchema: RxJsonSchema<TaskDocument> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  required: ['id', 'title', 'completed', 'categoryId', 'date', 'createdAt', 'updatedAt', 'userId', 'isDeleted'],
  properties: {
    id: { type: 'string', maxLength: 255 },
    title: { type: 'string', maxLength: 255 },
    // Boolean used in index -> treated as integer by RxDB internals
    completed: { type: 'boolean', multipleOf: 1 }, 
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
    isDeleted: { type: 'boolean', multipleOf: 1 },
    routineId: { type: 'string', maxLength: 255 },
    reminderTime: { type: 'string', maxLength: 50 },
    reactions: { type: 'string', maxLength: 5000 },
    visibility: { type: 'string', maxLength: 50, enum: ['public', 'followers', 'private'], default: 'private' },
  },
  indexes: [
    ['userId', 'isDeleted'],
    ['date', 'userId', 'isDeleted'],
    ['categoryId', 'userId', 'isDeleted'],
    ['completed', 'userId', 'isDeleted'],
  ],
};

export const categoriesSchema: RxJsonSchema<CategoryDocument> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  required: ['id', 'name', 'color', 'order', 'visibility', 'userId', 'isDeleted'],
  properties: {
    id: { type: 'string', maxLength: 255 },
    name: { type: 'string', maxLength: 100 },
    color: { type: 'string', maxLength: 20 },
    // FIX: Integer in index requires multipleOf + min/max bounds
    order: { 
      type: 'integer', 
      multipleOf: 1,
      minimum: 0,
      maximum: 999999 
    }, 
    visibility: { type: 'string', maxLength: 50, enum: ['public', 'followers', 'private'] },
    userId: { type: 'string', maxLength: 255 },
    isDeleted: { type: 'boolean', multipleOf: 1 },
    icon: { type: 'string', maxLength: 10 },
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
    isDeleted: { type: 'boolean', multipleOf: 1 },
  },
  indexes: [
    ['userId', 'date', 'isDeleted'],
    ['visibility', 'userId', 'isDeleted'],
  ],
};

export const settingsSchema: RxJsonSchema<SettingsDocument> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  required: ['id', 'userId', 'key', 'value', 'isDeleted'],
  properties: {
    id: { type: 'string', maxLength: 255 },
    userId: { type: 'string', maxLength: 255 },
    key: { type: 'string', maxLength: 100 },
    value: { type: 'string', maxLength: 10000 },
    isDeleted: { type: 'boolean', multipleOf: 1 },
  },
  indexes: [
    ['userId', 'key', 'isDeleted'],
  ],
};