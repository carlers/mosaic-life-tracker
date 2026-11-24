import { getDatabase } from '../db/database';
import type { ActivityDocument, ActivityTaskLinkDocument } from '../db/schema';
import type { WorkoutPreviewRow } from './workoutCsv';
import type { WorkoutOrderAssignment } from './workoutDayPlacement';
import { captureAccountWorkGeneration, isAccountWorkCurrent } from './accountWorkScope';

export type RetainableWorkoutSource = 'user_csv' | 'synthetic';
export type WorkoutSource = RetainableWorkoutSource | 'ifttt_strava_csv';

export function assertWorkoutSourceRights(source: WorkoutSource): asserts source is RetainableWorkoutSource {
  if (source === 'ifttt_strava_csv') {
    throw new Error('IFTTT/Strava-derived data cannot be saved or linked until downstream-use rights are cleared.');
  }
  if (source !== 'user_csv' && source !== 'synthetic') {
    throw new Error('Unsupported workout source.');
  }
}

function assertOwner(userId: string, generation: number): void {
  if (!isAccountWorkCurrent(userId, generation)) {
    throw new Error('Workout operation stopped because the signed-in account changed.');
  }
}

/** Stable IDs and fingerprints survive re-imports and simultaneous browser tabs. */
async function sha256(value: string): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Workout storage requires a secure browser context.');
  }
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

function normalizeRow(row: WorkoutPreviewRow) {
  if (row.state !== 'valid' || !row.localDate ||
      !/^\d{4}-\d{2}-\d{2}$/.test(row.localDate) ||
      !row.title.trim() || row.title.length > 255 ||
      !row.sport.trim() || row.sport.length > 50 ||
      row.distanceMeters === null || !Number.isFinite(row.distanceMeters) || row.distanceMeters < 0 ||
      row.elapsedSeconds === null || !Number.isFinite(row.elapsedSeconds) || row.elapsedSeconds < 0 ||
      row.distanceMeters > 1e9 || row.elapsedSeconds > 1e9) {
    throw new Error('Invalid workout row ' + row.line + '.');
  }
  return {
    title: row.title.trim(),
    sport: row.sport.trim(),
    localDate: row.localDate,
    completedAt: row.completedAt ?? '',
    distanceMeters: row.distanceMeters,
    elapsedSeconds: row.elapsedSeconds,
  };
}

/** Presentation edits are not part of the original CSV identity. */
export interface WorkoutImportEdit {
  title?: string;
  categoryId?: string;
}

export interface ImportWorkoutResult {
  inserted: number;
  alreadyPresent: number;
  attempted: number;
}

/**
 * Explicit, local-only user import. Never fetches from provider, mutates tasks, or
 * auto-revives tombstoned activities; retries and sheet overlap are idempotent.
 */
export async function importWorkoutRows(
  userId: string,
  rows: readonly WorkoutPreviewRow[],
  source: WorkoutSource,
  categoryId: string,
  edits: ReadonlyMap<number, WorkoutImportEdit> = new Map(),
): Promise<ImportWorkoutResult> {
  assertWorkoutSourceRights(source);
  const generation = captureAccountWorkGeneration(userId);
  if (generation === null) throw new Error('Sign in to import workouts.');
  const candidates = rows.filter(row => row.state === 'valid');
  // Validate every candidate before committing any row.
  const prepared = candidates.map(candidate => {
    const row = normalizeRow(candidate);
    const edit = edits.get(candidate.line);
    const title = (edit?.title ?? row.title).trim();
    if (!title || title.length > 255) throw new Error('Invalid workout title on row ' + candidate.line + '.');
    return { row, title, categoryId: edit?.categoryId || categoryId };
  });
  const db = getDatabase();
  const categoryIds = [...new Set([categoryId, ...prepared.map(item => item.categoryId)])];
  const categories = await Promise.all(categoryIds.map(id => id ? db.categories.findOne(id).exec() : null));
  assertOwner(userId, generation);
  if (categories.some(category => !category || category.userId !== userId || category.isDeleted)) {
    throw new Error('Choose a category for your workouts before saving.');
  }
  const now = new Date().toISOString();
  let inserted = 0;
  let alreadyPresent = 0;
  const seen = new Set<string>();

  for (let i = 0; i < prepared.length; i += 1) {
    assertOwner(userId, generation);
    const { row, title, categoryId: rowCategoryId } = prepared[i];
    // A content fingerprint is portable across account-owned backup restores.
    // The deterministic row ID remains namespaced to the authenticated owner.
    const digest = await sha256(JSON.stringify([
      source, row.completedAt || row.localDate, row.sport.toLowerCase(),
      row.title.toLowerCase(), row.distanceMeters, row.elapsedSeconds,
    ]));
    const id = 'wa_' + (await sha256(userId + ':' + digest)).slice(0, 32);
    if (seen.has(digest)) {
      alreadyPresent += 1;
      continue;
    }
    seen.add(digest);
    const matching = await db.activities.find({ selector: { userId, fingerprint: digest } }).exec();
    assertOwner(userId, generation);
    if (matching.length > 0) {
      // Never revive a deleted record or overwrite user-edited titles.
      alreadyPresent += 1;
      continue;
    }
    const existing = await db.activities.findOne(id).exec();
    assertOwner(userId, generation);
    if (existing) {
      if (existing.userId !== userId || existing.fingerprint !== digest) {
        throw new Error('Workout identity collision; no additional rows were changed.');
      }
      // Tombstone precedence protects against unintended resurrection.
      alreadyPresent += 1;
      continue;
    }
    const doc: ActivityDocument = {
      id, userId, ...row, title, source, fingerprint: digest,
      categoryId: rowCategoryId, order: 1_000_000 + i,
      createdAt: now, updatedAt: now, isDeleted: false,
    };
    try {
      await db.activities.insert(doc);
      inserted += 1;
    } catch (error) {
      const raced = await db.activities.findOne(id).exec();
      assertOwner(userId, generation);
      if (!raced || raced.userId !== userId || raced.fingerprint !== digest) throw error;
      alreadyPresent += 1;
    }
    // Let swipes/paint process during large imports instead of blocking the main thread.
    if (i % 32 === 31) await new Promise<void>(resolve => setTimeout(resolve, 0));
  }
  return { inserted, alreadyPresent, attempted: prepared.length };
}

/** Category and display order belong only to the activity, never to a TaskDocument. */
export async function updateWorkoutCategory(userId: string, activityId: string, categoryId: string): Promise<void> {
  const generation = captureAccountWorkGeneration(userId);
  if (generation === null) throw new Error('Sign in to move workouts.');
  const db = getDatabase();
  const [activity, category] = await Promise.all([
    db.activities.findOne(activityId).exec(), db.categories.findOne(categoryId).exec(),
  ]);
  assertOwner(userId, generation);
  if (!activity || activity.userId !== userId || activity.isDeleted) throw new Error('Workout unavailable.');
  if (!category || category.userId !== userId || category.isDeleted) throw new Error('Choose an available category.');
  assertWorkoutSourceRights(activity.source);
  if (activity.categoryId === categoryId) return;
  await activity.incrementalPatch({
    categoryId, order: 1_000_000,
    updatedAt: new Date().toISOString(),
  });
}

/** Applies only private workout placements. Canonical task order is committed separately. */
export async function reorderWorkoutRows(
  userId: string,
  dateStr: string,
  assignments: readonly WorkoutOrderAssignment[],
): Promise<void> {
  if (assignments.length === 0) return;
  const generation = captureAccountWorkGeneration(userId);
  if (generation === null) throw new Error('Sign in to reorder workouts.');
  const db = getDatabase();
  const categoryIds = [...new Set(assignments.map(row => row.categoryId))];
  const categories = await Promise.all(categoryIds.map(id => db.categories.findOne(id).exec()));
  assertOwner(userId, generation);
  if (categories.some(category => !category || category.userId !== userId || category.isDeleted)) {
    throw new Error('Workout destination category unavailable.');
  }
  const seen = new Set<string>();
  const documents = await Promise.all(assignments.map(async assignment => {
    if (seen.has(assignment.activityId) || !Number.isFinite(assignment.order)) {
      throw new Error('Invalid workout order.');
    }
    seen.add(assignment.activityId);
    const activity = await db.activities.findOne(assignment.activityId).exec();
    if (!activity || activity.userId !== userId || activity.isDeleted || activity.localDate !== dateStr) {
      throw new Error('Workout changed while reordering.');
    }
    assertWorkoutSourceRights(activity.source);
    return activity;
  }));
  assertOwner(userId, generation);
  for (let i = 0; i < documents.length; i += 1) {
    assertOwner(userId, generation);
    const row = assignments[i], doc = documents[i];
    if (doc.categoryId === row.categoryId && doc.order === row.order) continue;
    await doc.incrementalPatch({
      categoryId: row.categoryId, order: row.order,
      updatedAt: new Date().toISOString(),
    });
  }
}

export async function updateWorkoutTitle(userId: string, activityId: string, title: string): Promise<void> {
  const cleaned = title.trim();
  if (!cleaned || cleaned.length > 255) throw new Error('Workout title must be 1–255 characters.');
  const generation = captureAccountWorkGeneration(userId);
  if (generation === null) throw new Error('Sign in to edit workouts.');
  const doc = await getDatabase().activities.findOne(activityId).exec();
  assertOwner(userId, generation);
  if (!doc || doc.userId !== userId || doc.isDeleted) throw new Error('Workout unavailable.');
  assertWorkoutSourceRights(doc.source);
  await doc.incrementalPatch({ title: cleaned, updatedAt: new Date().toISOString() });
}

export async function deleteWorkout(userId: string, activityId: string): Promise<void> {
  const generation = captureAccountWorkGeneration(userId);
  if (generation === null) throw new Error('Sign in to delete workouts.');
  const db = getDatabase();
  const doc = await db.activities.findOne(activityId).exec();
  assertOwner(userId, generation);
  if (!doc || doc.userId !== userId || doc.isDeleted) throw new Error('Workout unavailable.');
  const links = await db.activityTaskLinks.find({ selector: { userId, activityId, isDeleted: false } }).exec();
  const now = new Date().toISOString();
  for (const link of links) {
    assertOwner(userId, generation);
    await link.incrementalPatch({ isDeleted: true, updatedAt: now });
  }
  assertOwner(userId, generation);
  await doc.incrementalPatch({ isDeleted: true, updatedAt: now });
}

export async function setWorkoutTaskLinked(
  userId: string, activityId: string, taskId: string, linked: boolean,
): Promise<void> {
  const generation = captureAccountWorkGeneration(userId);
  if (generation === null) throw new Error('Sign in to link workouts.');
  const db = getDatabase();
  const [activity, task] = await Promise.all([
    db.activities.findOne(activityId).exec(), db.tasks.findOne(taskId).exec(),
  ]);
  assertOwner(userId, generation);
  if (!activity || activity.userId !== userId || activity.isDeleted ||
      !task || task.userId !== userId || task.isDeleted) {
    throw new Error('Workout or owner task unavailable.');
  }
  assertWorkoutSourceRights(activity.source);
  if (task.date !== activity.localDate) {
    throw new Error('A workout can only be linked to a task on the same day.');
  }
  const activeLinks = await db.activityTaskLinks.find({ selector: { userId, activityId, isDeleted: false } }).exec();
  if (linked && activeLinks.some(link => link.taskId !== taskId)) {
    throw new Error('Unlink the previous task before linking another.');
  }
  const matches = await db.activityTaskLinks.find({ selector: { userId, activityId, taskId } }).exec();
  assertOwner(userId, generation);
  if (matches.length > 1) throw new Error('Duplicate relationship records; nothing was changed.');
  const hash = await sha256(JSON.stringify([userId,activityId,taskId]));
  const id = matches[0]?.id ?? ('wt_' + hash.slice(0, 32));
  const existing = matches[0] ?? await db.activityTaskLinks.findOne(id).exec();
  assertOwner(userId, generation);
  if (existing) {
    if (existing.userId !== userId || existing.activityId !== activityId || existing.taskId !== taskId) {
      throw new Error('Task link identity collision.');
    }
    if (existing.isDeleted === !linked) return;
    await existing.incrementalPatch({ isDeleted: !linked, updatedAt: new Date().toISOString() });
  } else if (linked) {
    const now = new Date().toISOString();
    const row: ActivityTaskLinkDocument = { id, userId, activityId, taskId, createdAt: now, updatedAt: now, isDeleted: false };
    try {
      await db.activityTaskLinks.insert(row);
    } catch (error) {
      const raced = await db.activityTaskLinks.findOne(id).exec();
      assertOwner(userId, generation);
      if (!raced || raced.userId !== userId || raced.activityId !== activityId || raced.taskId !== taskId) throw error;
      if (raced.isDeleted) await raced.incrementalPatch({ isDeleted: false, updatedAt: now });
    }
  }
}
