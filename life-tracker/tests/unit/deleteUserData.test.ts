// Regression: §2 (Delete All User Data tombstones every owned Mosaic collection).
import { beforeEach, describe, expect, it, vi } from 'vitest';

const docs = vi.hoisted(() => ({
  task: {
    id: 'task_1',
    image: 'img_1',
    userId: 'user_1',
    isDeleted: false,
    updatedAt: 'old',
    incrementalPatch: vi.fn(),
  },
  category: {
    id: 'cat_1',
    userId: 'user_1',
    isDeleted: false,
    updatedAt: 'old',
    incrementalPatch: vi.fn(),
  },
}));

const sendAction = vi.hoisted(() => vi.fn().mockResolvedValue({ ok: true }));
vi.mock('../../src/lib/messageDelivery', () => ({ sendMessageAction: sendAction }));

const updateRow = vi.hoisted(() => vi.fn().mockResolvedValue({}));
const deleteImage = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const deleteFriendPair = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const fetchMyProfile = vi.hoisted(() => vi.fn().mockResolvedValue({
  $id: 'profile_user_1',
  user_id: 'user_1',
  username: 'user',
  display_name: 'User',
  avatar_file_id: 'avatar_1',
  bio: '',
  is_searchable: true,
}));

vi.mock('../../src/db/database', () => ({
  getDatabase: () => ({
    tasks: { find: () => ({ exec: async () => [docs.task] }) },
    categories: { find: () => ({ exec: async () => [docs.category] }) },
    diary: { find: () => ({ exec: async () => [] }) },
    settings: { find: () => ({ exec: async () => [] }) },
    friendships: { find: () => ({ exec: async () => [] }) },
    messages: { find: () => ({ exec: async () => [] }) },
  }),
}));
vi.mock('../../src/lib/sdk', () => ({ guardedTablesDB: { updateRow } }));
vi.mock('../../src/lib/storage', () => ({ deleteImage }));
vi.mock('../../src/lib/social', () => ({ deleteFriendPair, fetchMyProfile }));

import { deleteAllUserData } from '../../src/lib/deleteUserData';

describe('deleteAllUserData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(docs.task, { isDeleted: false, updatedAt: 'old' });
    Object.assign(docs.category, { isDeleted: false, updatedAt: 'old' });
    docs.task.incrementalPatch.mockImplementation(async (patch) => Object.assign(docs.task, patch));
    docs.category.incrementalPatch.mockImplementation(async (patch) => Object.assign(docs.category, patch));
  });

  it('does not proceed to personal deletion while relationship cleanup fails', async () => {
    sendAction.mockRejectedValueOnce(new Error('Offline'));
    await expect(deleteAllUserData('user_1')).rejects.toThrow('Offline');
    expect(updateRow).not.toHaveBeenCalled();
    expect(docs.task.incrementalPatch).not.toHaveBeenCalled();
  });

  it('tombstones owned local+remote rows, profile, and referenced images', async () => {
    const result = await deleteAllUserData('user_1');
    expect(sendAction).toHaveBeenCalledWith({ action: 'delete_account_friendships', ownerId: 'user_1' });

    expect(docs.task.incrementalPatch).toHaveBeenCalledWith(
      expect.objectContaining({ isDeleted: true })
    );
    expect(docs.category.incrementalPatch).toHaveBeenCalledWith(
      expect.objectContaining({ isDeleted: true })
    );
    expect(updateRow).toHaveBeenCalledWith(
      expect.objectContaining({
        databaseId: 'life_tracker',
        tableId: 'tasks',
        rowId: 'task_1',
        data: expect.objectContaining({ deleted: true }),
      })
    );
    expect(updateRow).toHaveBeenCalledWith(
      expect.objectContaining({
        tableId: 'profiles',
        rowId: 'profile_user_1',
        data: expect.objectContaining({ deleted: true, is_searchable: false }),
      })
    );
    expect(deleteImage).toHaveBeenCalledWith('img_1');
    expect(deleteImage).toHaveBeenCalledWith('avatar_1');
    expect(result.totalRows).toBe(2);
  });
});
