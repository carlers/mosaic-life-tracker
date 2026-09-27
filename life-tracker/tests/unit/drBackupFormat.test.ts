import { describe, expect, it } from 'vitest';
import {
  buildBackupId,
  normalizeColumn,
  normalizeIndex,
  serializeRowRecord,
} from '../../appwrite-functions/dr-backup/backup.mjs';

describe('DR backup normalization', () => {
  it('creates sortable timestamp backup IDs', () => {
    expect(buildBackupId(new Date('2026-09-27T01:02:03.004Z'))).toBe(
      '20260927T010203004Z'
    );
  });

  it('normalizes Appwrite runtime schema metadata into restore definitions', () => {
    expect(
      normalizeColumn({
        key: 'title',
        type: 'varchar',
        size: 255,
        required: true,
        array: false,
        default: null,
        encrypt: false,
        status: 'available',
        error: '',
        $createdAt: 'ignored',
      })
    ).toEqual({
      key: 'title',
      type: 'varchar',
      size: 255,
      required: true,
      array: false,
      default: null,
      encrypt: false,
    });

    expect(
      normalizeIndex({
        key: 'idx_user',
        type: 'key',
        columns: ['user_id'],
        orders: [],
        lengths: [0],
        status: 'available',
      })
    ).toEqual({
      key: 'idx_user',
      type: 'key',
      attributes: ['user_id'],
      orders: [],
      lengths: [0],
    });
  });

  it('preserves row ID and permissions while separating user data', () => {
    expect(
      serializeRowRecord({
        $id: 'row_1',
        $permissions: ['read("user:abc")'],
        $createdAt: 'server',
        $updatedAt: 'server',
        $databaseId: 'life_tracker',
        $tableId: 'tasks',
        title: 'Task',
        deleted: false,
      })
    ).toEqual({
      id: 'row_1',
      permissions: ['read("user:abc")'],
      data: { title: 'Task', deleted: false },
    });
  });
});
