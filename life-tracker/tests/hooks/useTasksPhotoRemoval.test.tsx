import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TaskDocument } from '../../src/db/schema';

const state = vi.hoisted(() => ({
  userId: 'owner_A',
  document: null as { incrementalModify: (modify: (current: TaskDocument) => TaskDocument) => Promise<TaskDocument> } | null,
}));

vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({ user: state.userId ? { $id: state.userId } : null }),
}));
vi.mock('../../src/hooks/useRxCollection', () => ({
  useRxCollection: () => ({data: [], isLoading: false}),
}));
vi.mock('../../src/db/database', () => ({
  getDatabase: () => ({ tasks: {findOne: () => ({exec: async () => state.document})} }),
}));

import { useTasks } from '../../src/hooks/useTasks';

const task = (overrides: Partial<TaskDocument> = {}): TaskDocument => ({
  id: 'task_A', title: 'Test', userId: 'owner_A', isDeleted: false,
  categoryId: 'cat', completed: false, order: 1, date: '2026-11-01',
  createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z',
  image: 'img_original', visibility: 'private', memo: '', ...overrides,
});

function setup(current: TaskDocument) {
  let persisted = {...current};
  const incrementalModify = vi.fn(async (modify: (latest: TaskDocument) => TaskDocument) => {
    const modified = modify({...persisted});
    persisted = modified;
    return modified;
  });
  state.document = { incrementalModify };
  return { incrementalModify, get: () => ¶»§q«^