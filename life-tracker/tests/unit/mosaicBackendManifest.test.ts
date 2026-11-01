import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import {
  BOOTSTRAP_API_KEY_SCOPES,
  MOSAIC_BUCKET,
  MOSAIC_DATABASE,
  MOSAIC_LEGACY_TABLE_IDS,
  MOSAIC_TABLES,
} from '../../infrastructure/mosaic-backend.mjs';
import {
  ACCOUNT_ERASURE_POLICY,
  assertErasurePolicyCoversManifest,
} from '../../infrastructure/account-erasure-policy.mjs';

const require = createRequire(import.meta.url);
const {
  OWNED_TABLES,
  CROSS_REFERENCE_QUERIES,
} = require('../../appwrite-functions/message-action/account-deletion.js');

const byId = Object.fromEntries(MOSAIC_TABLES.map((table) => [table.id, table]));

describe('portable Mosaic backend manifest', () => {
  it('contains only the active runtime tables', () => {
    expect(MOSAIC_DATABASE).toMatchObject({
      id: 'life_tracker',
      name: 'Life Tracker',
      enabled: true,
    });
    expect(MOSAIC_TABLES.map((table) => table.id)).toEqual([
      'media_uploads',
      'diary_reactions',
      'bucket_task_links',
      'bucket_list_items',
      'tasks',
      'categories',
      'diary',
      'settings',
      'friendships',
      'task_shares',
      'profiles',
      'messages',
      'notifications',
      'push_subscriptions',
      'bug_reports',
      'account_deletions',
    ]);
    expect(MOSAIC_TABLES.map((table) => table.id)).not.toContain('routines');
    expect(MOSAIC_TABLES.map((table) => table.id)).not.toContain('stickers');
    expect(MOSAIC_TABLES.map((table) => tab¶»§q«^