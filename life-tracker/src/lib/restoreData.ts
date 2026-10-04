import { getDatabase } from '../db/database';
import type {
  TaskDocument,
  CategoryDocument,
  DiaryDocument,
  SettingsDocument,
} from '../db/schema';
import { refreshSync } from '../db/sync';
import {
  captureAccountWorkGeneration,
  isAccountWorkCurrent,
} from './accountWorkScope';
import {
  exportUserData,
  triggerDownload,
  type ExportUser,
} from './exportData';
import { upsertLocalDoc } from './localUpsert';
import {
  hashString,
  makeDiaryRowId,
  makeSettingsRowId,
} from './settingsRowId';
import { ensureRestoredImage, getCurrentUserId } from './storage';

export type RestoreMode = 'merge' | 'replace';

const RESTORABLE_COLLECTIONS = [
  'categories',
  'tasks',
  'diary',
  'settings',
] as const;

const POST_RESTORE_SYNC_TIMEOUT_MS = 30_000;

type RestorableCollection = (typeof RESTORABLE_COLLECTIONS)[number];
type JsonRecord = Record<string, unknown>;
type RestorableDocument =
  | TaskDocument
  | CategoryDocument
  | DiaryDocument
  | SettingsDocument;

const ROW_ID_PATTERN = /^[a-zA-Z0-9_]+$/;
const FILE_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const FORBIDDEN_SETTING_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const CROSS_ACCOUNT_PRESERVED_SETTING_KEYS = new Set(['friend_carousel_prefs']);
const MAX_ROW_ID_LENGTH = 36;
const SUPPORTED_BACKUP_VERSIONS = new Set([1, 2]);

interface BackupPayload {
  format?: string;
  app: { name: string; version?: string };
  version: number;
  exportedAt: string;
  user: ExportUser;
  counts?: JsonRecord;
  data: {
    tasks: unknown[];
    categories: unknown[];
    diary: unknown[];
    settings: unknown[] | JsonRecord;
    friendships?: unknown[];
  };
  images?: {
    included?: boolean;
    referenced?: unknown[];
    missingImages?: unknown[];
    note?: string;
  };
}

interface LoadedBackup {
  payload: BackupPayload;
  imageFiles: Map<string, Uint8Array>;
}

interface NormalizedBackup {
  sourceUserId: string;
  tasks: TaskDocument[];
  categories: CategoryDocument[];
  diary: DiaryDocument[];
  settings: SettingsDocument[];
}

interface RestorePlan {
  data: NormalizedBackup;
  skippedNewer: number;
}

export interface BackupPreview {
  version: number;
  exportedAt: string;
  sourceUser: ExportUser;
  counts: {
    tasks: number;
    categories: number;
    diary: number;
    settings: number;
    images: number;
  };
  imagesIncluded: boolean;
  friendshipsReferenceOnly: number;
}

export interface RestoreOptions {
  mode: RestoreMode;
  onProgress?: (message: string) => void;
  onLocalApplyComplete?: () => void;
}

export interface RestoreResult {
  mode: RestoreMode;
  restored: Record<RestorableCollection, number>;
  skippedNewer: number;
  tombstoned: number;
  imagesRestored: number;
  imagesMissing: number;
  safetyBackupDownloaded: boolean;
  syncState: 'synced' | 'pending';
  syncError: string;
}

type LocalDoc = {
  id?: string;
  userId?: string;
  isDeleted?: boolean;
  updatedAt?: string;
  toJSON?: () => JsonRecord;
  incrementalPatch: (patch: JsonRecord) => Promise<unknown>;
  [key: string]: unknown;
};

type LocalCollection = {
  findOne: (id: string) => { exec: () => Promise<LocalDoc | null> };
  find: (query?: unknown) => { exec: () => Promise<LocalDoc[]> };
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function validIso(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || !value || !Number.isFinite(Date.parse(value))) {
    return fallback;
  }
  return value;
}

function asVisibility(
  value: unknown,
  fallback: 'public' | 'followers' | 'private' | '' = 'private'
): 'public' | 'followers' | 'private' | '' {
  return value === 'public' ||
    value === 'followers' ||
    value === 'private' ||
    value === ''
    ? value
    : fallback;
}

function isValidRowId(id: string): boolean {
  return (
    id.length > 0 &&
    id.length <= MAX_ROW_ID_LENGTH &&
    !id.startsWith('_') &&
    ROW_ID_PATTERN.test(id)
  );
}

function portableRowId(
  prefix: 't' | 'c',
  currentUserId: string,
  sourceUserId: string,
  sourceId: string
): string {
  if (currentUserId === sourceUserId && isValidRowId(sourceId)) {
    return sourceId;
  }
  return `bk_${prefix}_${hashString(`${currentUserId}:${sourceUserId}:${sourceId}`)}`;
}

function isValidFileId(id: string): boolean {
  return id.length > 0 && id.length <= 36 && FILE_ID_PATTERN.test(id);
}

function isValidDateKey(value: string): boolean {
  if (!DATE_KEY_PATTERN.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function portableImageId(
  currentUserId: string,
  sourceUserId: string,
  sourceImageId: string
): string {
  if (
    currentUserId === sourceUserId &&
    isValidFileId(sourceImageId) &&
    !sourceImageId.startsWith('localimg_')
  ) {
    return sourceImageId;
  }
  return `bk_i_${hashString(`${currentUserId}:${sourceUserId}:${sourceImageId}`)}`;
}

function textFromBytes(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

async function loadBackupFile(file: File): Promise<LoadedBackup> {
  if (!file || file.size === 0) {
    throw new Error('Backup file is empty.');
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const isZip =
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04;

  let rawPayload: unknown;
  const imageFiles = new Map<string, Uint8Array>();

  if (isZip) {
    const { unzipSync } = await import('fflate');
    let files: Record<string, Uint8Array>;
    try {
      files = unzipSync(bytes);
    } catch {
      throw new Error('Backup ZIP could not be opened.');
    }

    const manifest = files['manifest.json'];
    if (!manifest) {
      throw new Error('Backup ZIP is missing manifest.json.');
    }
    try {
      rawPayload = JSON.parse(textFromBytes(manifest));
    } catch {
      throw new Error('Backup manifest is not valid JSON.');
    }

    for (const [path, contents] of Object.entries(files)) {
      if (!path.startsWith('images/') || path.endsWith('/')) continue;
      const filename = path.slice('images/'.length);
      const dot = filename.lastIndexOf('.');
      const sourceId = dot > 0 ? filename.slice(0, dot) : filename;
      if (sourceId) imageFiles.set(sourceId, contents);
    }
  } else {
    try {
      rawPayload = JSON.parse(textFromBytes(bytes));
    } catch {
      throw new Error('Backup file is not valid JSON or ZIP.');
    }
  }

  const payload = validatePayload(rawPayload);
  return { payload, imageFiles };
}

function validatePayload(value: unknown): BackupPayload {
  if (!isRecord(value)) throw new Error('Backup manifest is invalid.');
  if (!isRecord(value.app) || value.app.name !== 'Mosaic') {
    throw new Error('This file is not a Mosaic backup.');
  }
  if (
    typeof value.version !== 'number' ||
    !SUPPORTED_BACKUP_VERSIONS.has(value.version)
  ) {
    throw new Error('This Mosaic backup version is not supported.');
  }
  if (value.version === 2 && value.format !== 'mosaic-user-backup') {
    throw new Error('This file is not a valid Mosaic backup v2.');
  }
  if (
    typeof value.exportedAt !== 'string' ||
    !Number.isFinite(Date.parse(value.exportedAt))
  ) {
    throw new Error('Backup export time is invalid.');
  }
  if (!isRecord(value.user) || typeof value.user.id !== 'string' || !value.user.id) {
    throw new Error('Backup source user is invalid.');
  }
  if (!isRecord(value.data)) throw new Error('Backup data is missing.');

  const tasks = value.data.tasks;
  const categories = value.data.categories;
  const diary = value.data.diary;
  const settings = value.data.settings;
  const friendships = value.data.friendships;

  if (!Array.isArray(tasks) || !Array.isArray(categories) || !Array.isArray(diary)) {
    throw new Error('Backup personal data is invalid.');
  }
  if (!(Array.isArray(settings) || isRecord(settings))) {
    throw new Error('Backup settings are invalid.');
  }
  if (friendships !== undefined && !Array.isArray(friendships)) {
    throw new Error('Backup friendship reference data is invalid.');
  }

  return {
    format: typeof value.format === 'string' ? value.format : undefined,
    app: {
      name: 'Mosaic',
      version: asString(value.app.version),
    },
    version: value.version,
    exportedAt: value.exportedAt,
    user: {
      id: value.user.id,
      email: asString(value.user.email),
      name: asString(value.user.name),
    },
    counts: isRecord(value.counts) ? value.counts : undefined,
    data: {
      tasks,
      categories,
      diary,
      settings,
      friendships: Array.isArray(friendships) ? friendships : [],
    },
    images: isRecord(value.images)
      ? {
          included: value.images.included === true,
          referenced: Array.isArray(value.images.referenced)
            ? value.images.referenced
            : [],
          missingImages: Array.isArray(value.images.missingImages)
            ? value.images.missingImages
            : [],
          note: asString(value.images.note),
        }
      : undefined,
  };
}

function assertUnique(targets: Iterable<string>, label: string): void {
  const seen = new Set<string>();
  for (const id of targets) {
    if (seen.has(id)) throw new Error(`Backup contains duplicate ${label}.`);
    seen.add(id);
  }
}

function normalizeBackup(
  payload: BackupPayload,
  currentUserId: string
): NormalizedBackup {
  const sourceUserId = payload.user.id;
  const exportedAt = payload.exportedAt;
  const categoryIdMap = new Map<string, string>();
  const taskIdMap = new Map<string, string>();
  const categorySourceIds = new Set<string>();
  const taskSourceIds = new Set<string>();

  for (const raw of payload.data.categories) {
    if (!isRecord(raw) || raw.isDeleted === true) continue;
    const sourceId = asString(raw.id);
    if (!sourceId) throw new Error('Backup category is missing an ID.');
    if (categorySourceIds.has(sourceId)) {
      throw new Error('Backup contains duplicate category IDs.');
    }
    categorySourceIds.add(sourceId);
    categoryIdMap.set(
      sourceId,
      portableRowId('c', currentUserId, sourceUserId, sourceId)
    );
  }
  assertUnique(categoryIdMap.values(), 'category IDs');

  for (const raw of payload.data.tasks) {
    if (!isRecord(raw) || raw.isDeleted === true) continue;
    const sourceId = asString(raw.id);
    if (!sourceId) throw new Error('Backup task is missing an ID.');
    if (taskSourceIds.has(sourceId)) {
      throw new Error('Backup contains duplicate task IDs.');
    }
    taskSourceIds.add(sourceId);
    taskIdMap.set(
      sourceId,
      portableRowId('t', currentUserId, sourceUserId, sourceId)
    );
  }
  assertUnique(taskIdMap.values(), 'task IDs');

  const categories: CategoryDocument[] = [];
  for (const raw of payload.data.categories) {
    if (!isRecord(raw) || raw.isDeleted === true) continue;
    const sourceId = asString(raw.id);
    const id = categoryIdMap.get(sourceId);
    if (!id) continue;
    const name = asString(raw.name);
    if (!name) throw new Error('Backup category is missing a name.');
    categories.push({
      id,
      name,
      color: asString(raw.color, '#3B82F6'),
      order:
        typeof raw.order === 'number' && Number.isInteger(raw.order) && raw.order >= 0
          ? raw.order
          : 0,
      visibility: asVisibility(raw.visibility, 'private') as
        | 'public'
        | 'followers'
        | 'private',
      userId: currentUserId,
      isDeleted: false,
      icon: asString(raw.icon),
      updatedAt: validIso(raw.updatedAt, exportedAt),
    });
  }

  const tasks: TaskDocument[] = [];
  for (const raw of payload.data.tasks) {
    if (!isRecord(raw) || raw.isDeleted === true) continue;
    const sourceId = asString(raw.id);
    const id = taskIdMap.get(sourceId);
    if (!id) continue;
    const title = asString(raw.title);
    const date = asString(raw.date);
    if (!title || !date) throw new Error('Backup task is missing required data.');
    if (!isValidDateKey(date)) {
      throw new Error('Backup task has an invalid date.');
    }
    const sourceCategoryId = asString(raw.categoryId);
    tasks.push({
      id,
      title,
      completed: asBoolean(raw.completed),
      categoryId: sourceCategoryId
        ? categoryIdMap.get(sourceCategoryId) ?? ''
        : '',
      order:
        typeof raw.order === 'number' && Number.isInteger(raw.order) && raw.order >= 0
          ? raw.order
          : 0,
      tags: asString(raw.tags),
      date,
      memo: asString(raw.memo),
      image: asString(raw.image),
      createdAt: validIso(raw.createdAt, exportedAt),
      completedAt: asString(raw.completedAt),
      updatedAt: validIso(raw.updatedAt, exportedAt),
      source: asString(raw.source),
      userId: currentUserId,
      isDeleted: false,
      routineId: asString(raw.routineId),
      reminderTime: asString(raw.reminderTime),
      reactions: asString(raw.reactions),
      visibility: asVisibility(raw.visibility, ''),
    });
  }

  const diary: DiaryDocument[] = [];
  for (const raw of payload.data.diary) {
    if (!isRecord(raw) || raw.isDeleted === true) continue;
    const date = asString(raw.date);
    if (!date) throw new Error('Backup diary entry is missing a date.');
    if (!isValidDateKey(date)) {
      throw new Error('Backup diary entry has an invalid date.');
    }
    diary.push({
      id: makeDiaryRowId(currentUserId, date),
      date,
      content: asString(raw.content),
      visibility: asVisibility(raw.visibility, 'private') as
        | 'public'
        | 'followers'
        | 'private',
      userId: currentUserId,
      createdAt: validIso(raw.createdAt, exportedAt),
      updatedAt: validIso(raw.updatedAt, exportedAt),
      isDeleted: false,
    });
  }
  assertUnique(
    diary.map((entry) => entry.id),
    'diary dates'
  );

  const settings: SettingsDocument[] = [];
  if (Array.isArray(payload.data.settings)) {
    for (const raw of payload.data.settings) {
      if (!isRecord(raw) || raw.isDeleted === true) continue;
      const key = asString(raw.key);
      if (!key) throw new Error('Backup setting is missing a key.');
      if (FORBIDDEN_SETTING_KEYS.has(key)) {
        throw new Error('Backup contains an unsafe setting key.');
      }
      if (
        sourceUserId !== currentUserId &&
        CROSS_ACCOUNT_PRESERVED_SETTING_KEYS.has(key)
      ) {
        continue;
      }
      const rawValue = raw.value;
      const value =
        typeof rawValue === 'string' ? rawValue : JSON.stringify(rawValue ?? null);
      settings.push({
        id: makeSettingsRowId(currentUserId, key),
        userId: currentUserId,
        key,
        value,
        isDeleted: false,
        updatedAt: validIso(raw.updatedAt, exportedAt),
      });
    }
  } else {
    for (const [key, rawValue] of Object.entries(payload.data.settings)) {
      if (FORBIDDEN_SETTING_KEYS.has(key)) {
        throw new Error('Backup contains an unsafe setting key.');
      }
      if (
        sourceUserId !== currentUserId &&
        CROSS_ACCOUNT_PRESERVED_SETTING_KEYS.has(key)
      ) {
        continue;
      }
      settings.push({
        id: makeSettingsRowId(currentUserId, key),
        userId: currentUserId,
        key,
        value:
          typeof rawValue === 'string'
            ? rawValue
            : JSON.stringify(rawValue ?? null),
        isDeleted: false,
        updatedAt: exportedAt,
      });
    }
  }
  assertUnique(
    settings.map((setting) => setting.id),
    'setting keys'
  );

  const normalized = { sourceUserId, tasks, categories, diary, settings };
  validateNormalizedBackup(normalized);
  return normalized;
}

function assertMaxLength(label: string, value: string | undefined, max: number): void {
  if (value !== undefined && value.length > max) {
    throw new Error(`Backup ${label} exceeds Mosaic's supported length.`);
  }
}

function validateNormalizedBackup(data: NormalizedBackup): void {
  for (const task of data.tasks) {
    assertMaxLength('task title', task.title, 255);
    assertMaxLength('task category ID', task.categoryId, 255);
    assertMaxLength('task tags', task.tags, 1000);
    assertMaxLength('task date', task.date, 50);
    assertMaxLength('task memo', task.memo, 2000);
    assertMaxLength('task image reference', task.image, 1_000_000);
    if (task.image && !isValidFileId(task.image)) {
      throw new Error('Backup task has an invalid image reference.');
    }
    assertMaxLength('task created time', task.createdAt, 50);
    assertMaxLength('task completed time', task.completedAt, 50);
    assertMaxLength('task updated time', task.updatedAt, 50);
    assertMaxLength('task source', task.source, 50);
    assertMaxLength('task routine ID', task.routineId, 255);
    assertMaxLength('task reminder time', task.reminderTime, 50);
    assertMaxLength('task reactions', task.reactions, 5000);
  }

  for (const category of data.categories) {
    assertMaxLength('category name', category.name, 100);
    assertMaxLength('category color', category.color, 20);
    assertMaxLength('category icon', category.icon, 10);
    assertMaxLength('category updated time', category.updatedAt, 50);
    if (!Number.isInteger(category.order) || category.order < 0 || category.order > 999999) {
      throw new Error('Backup category order is invalid.');
    }
  }

  for (const entry of data.diary) {
    assertMaxLength('diary date', entry.date, 50);
    assertMaxLength('diary created time', entry.createdAt, 50);
    assertMaxLength('diary updated time', entry.updatedAt, 50);
  }

  for (const setting of data.settings) {
    assertMaxLength('setting key', setting.key, 100);
    assertMaxLength('setting value', setting.value, 10000);
    if (
      setting.key === 'profileImageId' &&
      setting.value &&
      !isValidFileId(setting.value)
    ) {
      throw new Error('Backup profile image reference is invalid.');
    }
    assertMaxLength('setting updated time', setting.updatedAt, 50);
  }
}

function readLocalDoc(doc: LocalDoc): JsonRecord {
  return doc.toJSON ? doc.toJSON() : { ...doc };
}

function toMs(value: unknown): number {
  if (typeof value !== 'string') return 0;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

function collectionFor(name: RestorableCollection): LocalCollection {
  const db = getDatabase();
  return db[name] as unknown as LocalCollection;
}

function referencedImageIds(data: NormalizedBackup): Set<string> {
  const ids = new Set<string>();
  for (const task of data.tasks) {
    if (task.image) ids.add(task.image);
  }
  for (const setting of data.settings) {
    if (setting.key === 'profileImageId' && setting.value) {
      ids.add(setting.value);
    }
  }
  return ids;
}

async function restoreImages(
  loaded: LoadedBackup,
  data: NormalizedBackup,
  currentUserId: string,
  onProgress?: (message: string) => void,
  assertOwner?: () => void
): Promise<{ restored: number; missing: number }> {
  const ids = Array.from(referencedImageIds(data));
  if (ids.length === 0) return { restored: 0, missing: 0 };

  const remapped = new Map<string, string>();
  let restored = 0;
  let missing = 0;

  for (let index = 0; index < ids.length; index += 1) {
    assertOwner?.();
    const oldId = ids[index];
    const bytes = loaded.imageFiles.get(oldId);
    if (!bytes) {
      if (
        loaded.payload.images?.included ||
        loaded.payload.user.id !== currentUserId
      ) {
        missing += 1;
      }
      continue;
    }
    onProgress?.(`Restoring photos (${index + 1}/${ids.length})…`);
    try {
      const imageBuffer = bytes.slice().buffer as ArrayBuffer;
      const file = new File([imageBuffer], `${oldId}.webp`, {
        type: 'image/webp',
      });
      const preferredFileId = portableImageId(
        currentUserId,
        loaded.payload.user.id,
        oldId
      );
      const ensured = await ensureRestoredImage(
        file,
        preferredFileId,
        currentUserId
      );
      assertOwner?.();
      remapped.set(oldId, ensured.fileId);
      if (ensured.uploaded) restored += 1;
    } catch (error) {
      console.warn('[Restore] Image restore failed:', oldId, error);
      missing += 1;
    }
  }

  for (const task of data.tasks) {
    if (!task.image) continue;
    const replacement = remapped.get(task.image);
    if (replacement) task.image = replacement;
  }
  for (const setting of data.settings) {
    if (setting.key !== 'profileImageId' || !setting.value) continue;
    const replacement = remapped.get(setting.value);
    if (replacement) setting.value = replacement;
  }

  return { restored, missing };
}

function isEqualPortableImageRetry(
  collectionName: RestorableCollection,
  sourceDoc: RestorableDocument,
  current: JsonRecord,
  sourceUserId: string,
  userId: string
): boolean {
  if (sourceUserId === userId || current.isDeleted === true) return false;
  if (collectionName === 'tasks') {
    return Boolean((sourceDoc as TaskDocument).image) && !asString(current.image);
  }
  if (collectionName === 'settings') {
    const setting = sourceDoc as SettingsDocument;
    return (
      setting.key === 'profileImageId' &&
      Boolean(setting.value) &&
      !asString(current.value)
    );
  }
  return false;
}

async function planRestore(
  data: NormalizedBackup,
  userId: string,
  mode: RestoreMode,
  assertOwner?: () => void
): Promise<RestorePlan> {
  const planned: NormalizedBackup = {
    sourceUserId: data.sourceUserId,
    tasks: [],
    categories: [],
    diary: [],
    settings: [],
  };
  let skippedNewer = 0;

  for (const collectionName of RESTORABLE_COLLECTIONS) {
    assertOwner?.();
    const collection = collectionFor(collectionName);
    const target = planned[collectionName] as RestorableDocument[];

    for (const doc of documentsFor(data, collectionName)) {
      assertOwner?.();
      const existing = await collection.findOne(doc.id).exec();
      assertOwner?.();
      if (!existing) {
        target.push(doc);
        continue;
      }

      const current = readLocalDoc(existing);
      if (current.userId !== userId) {
        throw new Error('Restore ID collides with data owned by another account.');
      }
      if (mode === 'merge') {
        const currentUpdatedAt = toMs(current.updatedAt);
        const backupUpdatedAt = toMs(doc.updatedAt);
        const isEqualCrossAccountImageRetry =
          currentUpdatedAt === backupUpdatedAt &&
          isEqualPortableImageRetry(
            collectionName,
            doc,
            current,
            data.sourceUserId,
            userId
          );

        if (
          currentUpdatedAt > backupUpdatedAt ||
          (currentUpdatedAt === backupUpdatedAt &&
            !isEqualCrossAccountImageRetry)
        ) {
          skippedNewer += 1;
          continue;
        }
      }
      target.push(doc);
    }
  }

  return { data: planned, skippedNewer };
}

async function applyDocuments(
  collectionName: RestorableCollection,
  docs: RestorableDocument[],
  userId: string,
  sourceUserId: string,
  mode: RestoreMode,
  replaceTimestamp: string,
  assertOwner?: () => void
): Promise<{ restored: number; skippedNewer: number }> {
  const collection = collectionFor(collectionName);
  let restored = 0;
  let skippedNewer = 0;

  for (const sourceDoc of docs) {
    assertOwner?.();
    const doc = {
      ...sourceDoc,
      ...(mode === 'replace' ? { updatedAt: replaceTimestamp } : {}),
      userId,
      isDeleted: false,
    } as RestorableDocument;

    const existing = await collection.findOne(doc.id).exec();
    assertOwner?.();
    if (existing) {
      const current = readLocalDoc(existing);
      if (current.userId !== userId) {
        throw new Error('Restore ID collides with data owned by another account.');
      }
      if (mode === 'merge') {
        const currentUpdatedAt = toMs(current.updatedAt);
        const backupUpdatedAt = toMs(doc.updatedAt);
        const isEqualCrossAccountImageRetry =
          currentUpdatedAt === backupUpdatedAt &&
          isEqualPortableImageRetry(
            collectionName,
            doc,
            current,
            sourceUserId,
            userId
          );
        if (
          currentUpdatedAt > backupUpdatedAt ||
          (currentUpdatedAt === backupUpdatedAt &&
            !isEqualCrossAccountImageRetry)
        ) {
          skippedNewer += 1;
          continue;
        }
      }
    }

    assertOwner?.();
    await upsertLocalDoc(collectionName, doc.id, doc);
    assertOwner?.();
    restored += 1;
  }

  return { restored, skippedNewer };
}

async function tombstoneMissing(
  data: NormalizedBackup,
  userId: string,
  timestamp: string,
  assertOwner?: () => void
): Promise<number> {
  const wanted: Record<RestorableCollection, Set<string>> = {
    tasks: new Set(data.tasks.map((doc) => doc.id)),
    categories: new Set(data.categories.map((doc) => doc.id)),
    diary: new Set(data.diary.map((doc) => doc.id)),
    settings: new Set(data.settings.map((doc) => doc.id)),
  };

  let tombstoned = 0;
  for (const name of RESTORABLE_COLLECTIONS) {
    assertOwner?.();
    const collection = collectionFor(name);
    const currentDocs = await collection
      .find({ selector: { userId } })
      .exec();

    for (const doc of currentDocs) {
      assertOwner?.();
      const current = readLocalDoc(doc);
      const id = asString(current.id ?? doc.id);
      if (
        !id ||
        current.userId !== userId ||
        current.isDeleted === true ||
        wanted[name].has(id) ||
        (name === 'settings' &&
          data.sourceUserId !== userId &&
          CROSS_ACCOUNT_PRESERVED_SETTING_KEYS.has(asString(current.key)))
      ) {
        continue;
      }
      await doc.incrementalPatch({
        isDeleted: true,
        updatedAt: timestamp,
      });
      assertOwner?.();
      tombstoned += 1;
    }
  }
  return tombstoned;
}

function documentsFor(
  data: NormalizedBackup,
  collection: RestorableCollection
): RestorableDocument[] {
  return data[collection] as RestorableDocument[];
}

export async function inspectBackupFile(
  file: File,
  currentUserId?: string
): Promise<BackupPreview> {
  const loaded = await loadBackupFile(file);
  const normalized = normalizeBackup(
    loaded.payload,
    currentUserId || loaded.payload.user.id
  );

  return {
    version: loaded.payload.version,
    exportedAt: loaded.payload.exportedAt,
    sourceUser: loaded.payload.user,
    counts: {
      tasks: normalized.tasks.length,
      categories: normalized.categories.length,
      diary: normalized.diary.length,
      settings: normalized.settings.length,
      images: loaded.imageFiles.size,
    },
    imagesIncluded: loaded.payload.images?.included === true,
    friendshipsReferenceOnly: loaded.payload.data.friendships?.length ?? 0,
  };
}

async function assertRestoreUserStillCurrent(
  expectedUserId: string
): Promise<void> {
  const authenticatedUserId = await getCurrentUserId();
  if (authenticatedUserId !== expectedUserId) {
    throw new Error(
      'Restore stopped because the signed-in account changed. Reopen Backup & Restore and try again.'
    );
  }
}

export async function restoreUserData(
  file: File,
  currentUser: ExportUser,
  options: RestoreOptions
): Promise<RestoreResult> {
  if (!currentUser.id) throw new Error('Restore requires an authenticated user.');

  const accountGeneration = captureAccountWorkGeneration(currentUser.id);
  if (accountGeneration === null) {
    throw new Error(
      'Restore stopped because the signed-in account changed. Reopen Backup & Restore and try again.'
    );
  }
  const assertOwner = () => {
    if (!isAccountWorkCurrent(currentUser.id, accountGeneration)) {
      throw new Error(
        'Restore stopped because the signed-in account changed. Reopen Backup & Restore and try again.'
      );
    }
  };

  const report = options.onProgress ?? (() => {});
  report('Validating backup…');
  const loaded = await loadBackupFile(file);
  assertOwner();
  const data = normalizeBackup(loaded.payload, currentUser.id);

  if (options.mode !== 'merge' && options.mode !== 'replace') {
    throw new Error('Restore mode is invalid.');
  }

  if (
    typeof navigator !== 'undefined' &&
    navigator.onLine === false
  ) {
    throw new Error(
      'Restoring a backup requires an internet connection so Mosaic can check for newer synced data first.'
    );
  }

  report('Refreshing current data…');
  const refreshed = await refreshSync(currentUser.id);
  assertOwner();

  const lastSyncMs = refreshed.status.lastSync
    ? Date.parse(refreshed.status.lastSync)
    : Number.NaN;
  if (
    refreshed.status.isSyncing ||
    refreshed.status.errors.length > 0 ||
    !Number.isFinite(lastSyncMs) ||
    lastSyncMs < refreshed.startedAt
  ) {
    throw new Error(
      'Mosaic could not fully refresh synced data. Try restoring again after sync succeeds.'
    );
  }

  await assertRestoreUserStillCurrent(currentUser.id);

  report('Planning restore…');
  const plan = await planRestore(
    data,
    currentUser.id,
    options.mode,
    assertOwner
  );

  let safetyBackupDownloaded = false;
  if (options.mode === 'replace') {
    report('Creating safety backup…');
    const safety = await exportUserData(currentUser, { includeImages: false });
    triggerDownload(safety.blob, safety.filename);
    safetyBackupDownloaded = true;
  }

  const imageResult = await restoreImages(
    loaded,
    plan.data,
    currentUser.id,
    options.onProgress,
    assertOwner
  );

  await assertRestoreUserStillCurrent(currentUser.id);

  const replaceTimestamp = new Date().toISOString();
  const restored: Record<RestorableCollection, number> = {
    tasks: 0,
    categories: 0,
    diary: 0,
    settings: 0,
  };
  let skippedNewer = plan.skippedNewer;

  report(
    options.mode === 'replace'
      ? 'Applying backup data…'
      : 'Merging personal data…'
  );

  for (const collection of RESTORABLE_COLLECTIONS) {
    const result = await applyDocuments(
      collection,
      documentsFor(plan.data, collection),
      currentUser.id,
      data.sourceUserId,
      options.mode,
      replaceTimestamp,
      assertOwner
    );
    restored[collection] = result.restored;
    skippedNewer += result.skippedNewer;
  }

  let tombstoned = 0;
  if (options.mode === 'replace') {
    await assertRestoreUserStillCurrent(currentUser.id);
    report('Removing current-only personal data…');
    tombstoned = await tombstoneMissing(
      data,
      currentUser.id,
      replaceTimestamp,
      assertOwner
    );
  }

  assertOwner();
  options.onLocalApplyComplete?.();

  report('Syncing restored data…');
  let syncState: RestoreResult['syncState'] = 'synced';
  let syncError = '';
  try {
    await refreshSync(currentUser.id, POST_RESTORE_SYNC_TIMEOUT_MS);
    assertOwner();
  } catch (error) {
    syncState = 'pending';
    syncError =
      error instanceof Error ? error.message : 'Restored data is still syncing.';
    report('Saved locally. Sync will continue when Mosaic can reach the server.');
  }

  return {
    mode: options.mode,
    restored,
    skippedNewer,
    tombstoned,
    imagesRestored: imageResult.restored,
    imagesMissing: imageResult.missing,
    safetyBackupDownloaded,
    syncState,
    syncError,
  };
}
