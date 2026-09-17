import type {
  TaskDocument,
  CategoryDocument,
  DiaryDocument,
  MessageDocument,
  FriendshipDocument,
} from '../db/schema';

/**
 * Module-level frozen empty arrays. Centralized so React.memo comparator
 * bail-outs are stable across renders (§16 rule 3) and so every call
 * site shares one identity per collection.
 *
 * These are read-only sentinels: never mutate them. If a caller needs a
 * mutable copy, spread into a new array.
 */
export const EMPTY_TASKS: TaskDocument[] = Object.freeze(
  []
) as unknown as TaskDocument[];
export const EMPTY_CATEGORIES: CategoryDocument[] = Object.freeze(
  []
) as unknown as CategoryDocument[];
export const EMPTY_DIARY: DiaryDocument[] = Object.freeze(
  []
) as unknown as DiaryDocument[];
export const EMPTY_MESSAGES: MessageDocument[] = Object.freeze(
  []
) as unknown as MessageDocument[];
export const EMPTY_FRIENDSHIPS: FriendshipDocument[] = Object.freeze(
  []
) as unknown as FriendshipDocument[];
export const EMPTY_SETTINGS_ARR: string[] = Object.freeze(
  []
) as unknown as string[];
