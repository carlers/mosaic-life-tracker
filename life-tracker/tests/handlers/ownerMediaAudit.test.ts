import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';
import { invoke, makeMockDb, makeMockStorage } from '../helpers/invoke-handler';

const requireCjs = createRequire(import.meta.url);
const { auditOwnerMedia, soleOwnerControl, MAX_BUCKET_PAGES }: any =
  requireCjs('../../appwrite-functions/message-action/owner-media-audit.js');

const owner = 'actor_1478';
const stranger = 'other_1478';
const permissions = (id = owner) => [
  'read("users")',
  `update("user:${id}")`,
  `delete("user:${id}")`,
];
const f = (id: string, sizeOriginal = 100, grants = permissions()) =>
  ({ $id: id, sizeOriginal, $permissions: grants });
const task = (id: string, image: unknown, deleted = false) =>
  ({ $id: id, user_id: owner, image, deleted });
const diary = (id: string, photos: string, deleted = false) =>
  ({ $id: id, user_id: owner, photos, deleted });
const respond = (db = makeMockDb(), storage = makeMockStorage(), userId = owner,
  body: Record<string, unknown> = { action: 'get_owner_media_audit' }) =>
  invoke({ userId, body, mockDb: db, mockStorage: storage });

function fixtures() {
  const db = makeMockDb();
  const storage = makeMockStorage();
  db.listRows.mockImplementation(async ({ tableId }: any) => ({
    rows: tableId === 'tasks' ? [
      task('t1', 'img_live'), task('t2', 'img_live'), task('t3', 'img_deleted', true),
      task('t4', 'img_friend'),
    ] : tableId === 'diary' ? [
      diary('d1', JSON.stringify(['img_diary', 'img_¶»§q«^