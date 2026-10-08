#!/usr/bin/env node
// Optional synthetic, reusable Preview accounts. Never clone production users.
import { Permission, Role } from 'node-appwrite';
import { createBootstrapServices } from './lib/mosaic-bootstrap.mjs';
import { assertConfirmedProject, parseBackendTarget } from './lib/appwrite-backend.mjs';
import { assertScratchPreviewTarget } from './appwrite-preview-prepare.mjs';

export const PREVIEW_IDENTITIES = [
  { id: 'mosaic_preview_actor', email: 'mosaic.preview.actor@example.com', name: 'Scratch Actor', username: 'scratch_actor' },
  { id: 'mosaic_preview_viewer', email: 'mosaic.preview.viewer@example.com', name: 'Scratch Viewer', username: 'scratch_viewer' },
];

function is404(error) {
  return Number(error?.code ?? error?.status) === 404;
}

async function ensureUser(users, user, password) {
  try {
    const existing = await users.get({ userId: user.id });
    if (existing.email !== user.email) throw new Error('Existing fixture user identity mismatch: ' + user.id);
    return false;
  } catch (error) {
    if (!is404(error)) throw error;
  }
  await users.create({ userId: user.id, email: user.email, password, name: user.name });
  return true;
}

async function ensureRow(tablesDB, tableId, rowId, data, ownerId) {
  try {
    const existing = await tablesDB.getRow({ databaseId: 'life_tracker', tableId, rowId });
    const current = existing.data ?? existing;
    if (current.user_id !== ownerId) throw new Error('Existing fixture row owner mismatch: ' + rowId);
    return false;
  } catch (error) {
    if (!is404(error)) throw error;
  }
  await tablesDB.createRow({
    databaseId: 'life_tracker', tableId, rowId, data,
    permissions: [
      Permission.read(Role.user(ownerId)),
      Permission.update(Role.user(ownerId)),
      Permission.delete(Role.user(ownerId)),
    ],
  });
  return true;
}

export async function seedPreviewFixtures({ users, tablesDB, password, log = console.log, now = new Date().toISOString() }) {
  if (typeof password !== 'string' || password.length < 12) {
    throw new Error('MOSAIC_SCRATCH_TEST_PASSWORD must have at least 12 characters.');
  }
  const result = { users: 0, rows: 0 };
  for (const user of PREVIEW_IDENTITIES) {
    if (await ensureUser(users, user, password)) result.users++;
  }
  for (const user of PREVIEW_IDENTITIES) {
    const id = user.id;
    const rows = [
      ['profiles', id, { user_id: id, username: user.username, display_name: user.name, created_at: now, updated_at: now, deleted: false }],
      ['categories', 'fixture_cat_' + id, { user_id: id, name: 'Synthetic Preview', color: '#059669', order: 0, visibility: 'friends', updated_at: now, deleted: false }],
      ['diary', 'fixture_diary_' + id, { user_id: id, date: now.slice(0, 10), content: 'Synthetic preview diary', visibility: 'private', created_at: now, updated_at: now, deleted: false }],
      ['tasks', 'fixture_task_' + id, { user_id: id, title: 'Synthetic completion test', category_id: 'fixture_cat_' + id, date: now.slice(0, 10), created_at: now, updated_at: now, is_completed: false, visibility: 'friends', deleted: false }],
    ];
    for (const [table, rowId, data] of rows) {
      if (await ensureRow(tablesDB, table, rowId, data, id)) result.rows++;
    }
  }
  for (let i = 0; i < PREVIEW_IDENTITIES.length; i++) {
    const user = PREVIEW_IDENTITIES[i], friend = PREVIEW_IDENTITIES[1 - i];
    const data = { user_id: user.id, friend_id: friend.id, friend_username: friend.username, friend_display_name: friend.name, status: 'accepted', created_at: now, updated_at: now, deleted: false };
    if (await ensureRow(tablesDB, 'friendships', 'fixture_friend_' + user.id, data, user.id)) result.rows++;
  }
  log('Scratch synthetic fixtures ready: new users=' + result.users + ', new rows=' + result.rows);
  return result;
}

export async function runPreviewSeed({
  argv = process.argv.slice(2), env = process.env, services,
  log = console.log,
} = {}) {
  const target = parseBackendTarget(argv, env);
  assertScratchPreviewTarget(argv, target);
  assertConfirmedProject(argv, target.projectId);
  if (!env.MOSAIC_SCRATCH_TEST_PASSWORD) throw new Error('Set MOSAIC_SCRATCH_TEST_PASSWORD in the local shell; never commit or log it.');
  return seedPreviewFixtures({
    ...(services || createBootstrapServices(target)),
    password: env.MOSAIC_SCRATCH_TEST_PASSWORD, log,
  });
}

if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  runPreviewSeed().catch(error => {
    console.error('Scratch synthetic seed failed: ' + error.message);
    process.exitCode = 1;
  });
}
