import { describe, expect, it } from 'vitest';
import {
  buildBackupId,
  normalizeColumn,
  normalizeIndex,
  parseBackupJson,
  serializeRowRecord,
  stringifyBackupJson,
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

  it('round-trips signed 64-bit schema bounds without precision loss', () => {
    const min = -9223372036854775808n;
    const max = 9223372036854775807n;
    const column = normalizeColumn({
      key: 'order',
      type: 'integer',
      required: true,
      array: false,
      default: null,
      min,
      max,
    });

    const encoded = stringifyBackupJson({ column });
    expect(encoded).toContain('-9223372036854775808');
    expect(encoded).toContain('9223372036854775807');

    const decoded = parseBackupJson(encoded);
    expect(decoded.column.min).toBe(min);
    expect(decoded.column.max).toBe(max);
    expect(typeof decoded.column.min).toBe('bigint');
    expect(typeof decoded.column.max).toBe('bigint');
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
