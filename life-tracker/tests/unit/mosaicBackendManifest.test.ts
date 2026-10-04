import { describe, expect, it } from 'vitest';
import {
  BOOTSTRAP_API_KEY_SCOPES,
  MOSAIC_BUCKET,
  MOSAIC_DATABASE,
  MOSAIC_TABLES,
} from '../../infrastructure/mosaic-backend.mjs';

const byId = Object.fromEntries(MOSAIC_TABLES.map((table) => [table.id, table]));

describe('portable Mosaic backend manifest', () => {
  it('contains only the active runtime tables', () => {
    expect(MOSAIC_DATABASE).toMatchObject({
      id: 'life_tracker',
      name: 'Life Tracker',
      enabled: true,
    });
    expect(MOSAIC_TABLES.map((table) => table.id)).toEqual([
      'tasks',
      'categories',
      'diary',
      'settings',
      'friendships',
      'profiles',
      'messages',
      'account_deletions',
    ]);
    expect(MOSAIC_TABLES.map((table) => table.id)).not.toContain('routines');
    expect(MOSAIC_TABLES.map((table) => table.id)).not.toContain('stickers');
    expect(MOSAIC_TABLES.map((table) => table.id)).not.toContain(
      'analytics_events'
    );
  });

  it('pins task ordering plus the social and messaging schema needed by current Mosaic', () => {
    expect(byId.tasks.columns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'order',
          type: 'integer',
          required: false,
          default: 0,
        }),
      ])
    );
    expect(byId.friendships.columns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'friend_bio', size: 300 }),
        expect.objectContaining({ key: 'updated_at', size: 50 }),
      ])
    );
    expect(byId.profiles.permissions).toEqual([
      'create("users")',
      'read("users")',
    ]);
    expect(byId.profiles.indexes.map((index: { key: string }) => index.key)).toEqual([
      'idx_username_unique',
      'idx_user_id_unique',
      'idx_username_key',
    ]);
    expect(byId.messages.columns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'reply_to_id', size: 255 }),
        expect.objectContaining({ key: 'is_unsent', type: 'boolean' }),
        expect.objectContaining({ key: 'original_message_id', size: 255 }),
        expect.objectContaining({ key: 'reactions', size: 5000 }),
      ])
    );
    expect(byId.messages.indexes.map((index: { key: string }) => index.key)).toEqual([
      'idx_user_thread_created',
      'idx_user_deleted',
      'idx_thread_created',
      'idx_sender_id',
      'idx_recipient_id',
    ]);
    expect(byId.account_deletions).toMatchObject({
      permissions: [],
      rowSecurity: true,
      enabled: true,
    });
    expect(byId.account_deletions.columns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'attempts',
          type: 'integer',
          required: true,
        }),
      ])
    );
    expect(
      byId.account_deletions.columns.find(
        (column: { key: string }) => column.key === 'attempts'
      )
    ).not.toHaveProperty('default');
    expect(
      byId.account_deletions.indexes.map(
        (index: { key: string }) => index.key
      )
    ).toEqual(['idx_deletion_user', 'idx_deletion_status']);
  });

  it('keeps owner data row-secured and creates the production-equivalent image bucket', () => {
    for (const id of ['tasks', 'categories', 'diary', 'settings', 'friendships', 'messages']) {
      expect(byId[id]).toMatchObject({
        permissions: id === 'friendships' ? [] : ['create("users")'],
        rowSecurity: true,
        enabled: true,
      });
    }
    expect(MOSAIC_BUCKET).toEqual({
      id: 'task_images',
      name: 'task_images',
      permissions: ['create("users")'],
      fileSecurity: true,
      enabled: true,
      maximumFileSize: 5_000_000,
      allowedFileExtensions: [
        'jpg',
        'png',
        'gif',
        'jpeg',
        'webp',
        'heic',
        'heif',
      ],
      compression: 'none',
      encryption: true,
      antivirus: true,
      transformations: true,
    });
  });

  it('documents only the provisioning scopes the bootstrap uses', () => {
    expect(BOOTSTRAP_API_KEY_SCOPES).toContain('platforms.write');
    expect(BOOTSTRAP_API_KEY_SCOPES).toContain('databases.write');
    expect(BOOTSTRAP_API_KEY_SCOPES).toContain('tables.write');
    expect(BOOTSTRAP_API_KEY_SCOPES).toContain('buckets.write');
    expect(BOOTSTRAP_API_KEY_SCOPES).toContain('functions.write');
    expect(BOOTSTRAP_API_KEY_SCOPES).not.toContain('rows.write');
    expect(BOOTSTRAP_API_KEY_SCOPES).not.toContain('files.write');
    expect(BOOTSTRAP_API_KEY_SCOPES).not.toContain('users.write');
  });
});
