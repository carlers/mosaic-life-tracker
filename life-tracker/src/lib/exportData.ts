import { format } from 'date-fns';
import { getDatabase } from '../db/database';
import { getCachedImage, cacheImage } from './imageCache';
import { CORE_BACKEND } from './coreBackendConfig';
import { fetchSupabasePhoto, currentSupabaseMediaOwner } from './supabaseMedia';
import { getPendingImage, isPendingImageId } from './pendingImages';
import { guardedStorage } from './sdk';
import { APP_VERSION } from './appVersion';
import { getConnectivitySnapshot } from './connectivity';
import { parseDiaryPhotos } from './diaryPhotos';
import { captureAccountWorkGeneration, isAccountWorkCurrent } from './accountWorkScope';
import type {
  TaskDocument,
  CategoryDocument,
  DiaryDocument,
  BucketListDocument,
  BucketTaskLinkDocument,
  SettingsDocument,
  FriendshipDocument,
} from '../db/schema';
import {
  APPWRITE_STORAGE_BUCKET_ID,
} from './appwriteConfig';

const APPWRITE_CONFIG = {
  bucketId: APPWRITE_STORAGE_BUCKET_ID,
} as const;

const DEBUG = import.meta.env.DEV;
const APP_NAME = 'Mosaic';
const EXPORT_VERSION = 5;

export interface ExportUser {
  id: string;
  email: string;
  name: string;
}

export interface ExportOptions {
  includeImages: boolean;
  onProgress?: (message: string) => void;
}

export interface ExportCounts {
  tasks: number;
  categories: number;
  diary: number;
  bucketList: number;
  bucketTaskLinks: number;
  settings: number;
  friendships: number;
  images: number;
  missingImages: number;
}

export interface ExportPayload {
  format: 'mosaic-user-backup';
  app: { name: string; version: string };
  version: number;
  exportedAt: string;
  history: { tombstonesIncluded: true; scope: 'current-local-owner-snapshot' };
  user: ExportUser;
  counts: ExportCounts;
  data: {
    tasks: TaskDocument[];
    categories: CategoryDocument[];
    diary: DiaryDocument[];
    bucketList: BucketListDocument[];
    bucketTaskLinks: BucketTaskLinkDocument[];
    settings: SettingsDocument[];
    friendships: FriendshipDocument[];
  };
  restore: {
    restorable: ['tasks', 'categories', 'diary', 'settings', 'bucketList', 'bucketTaskLinks'];
    referenceOnly: ['friendships'];
    excluded: ['messages'];
  };
  images: {
    included: boolean;
    referenced: string[];
    missingImages: string[];
    note: string;
  };
}

export interface ExportResult {
  blob: Blob;
  filename: string;
  counts: ExportCounts;
}

function toDoc<T>(doc: { toJSON: () => unknown }): T {
  const json = { ...(doc.toJSON() as Record<string, unknown>) };
  delete json._rev;
  delete json._meta;
  delete json._attachments;
  delete json._deleted;
  return json as T;
}

interface RawCollections {
  tasks: TaskDocument[];
  categories: CategoryDocument[];
  diary: DiaryDocument[];
  bucketList: BucketListDocument[];
  bucketTaskLinks: BucketTaskLinkDocument[];
  settings: SettingsDocument[];
  friendships: FriendshipDocument[];
}

async function collectCollections(userId: string): Promise<RawCollections> {
  const db = getDatabase();
  const [tasks, categories, diary, settings, friendships, bucketList, bucketTaskLinks] = await Promise.all([
    db.tasks
      .find({
        selector: { userId },
        sort: [{ date: 'asc' }, { createdAt: 'desc' }],
      })
      .exec(),
    db.categories
      .find({
        selector: { userId },
        sort: [{ order: 'asc' }],
      })
      .exec(),
    db.diary
      .find({
        selector: { userId },
        sort: [{ date: 'desc' }],
      })
      .exec(),
    db.settings
      .find({
        selector: { userId },
      })
      .exec(),
    db.friendships
      .find({
        selector: { userId },
        sort: [{ updatedAt: 'desc' }],
      })
      .exec(),
    db.bucketList.find({ selector: { userId } }).exec(),
    db.bucketTaskLinks.find({ selector: { userId } }).exec(),
  ]);
  const { USE_PORTABLE_SETTINGS, mergePersonalSettings } = await import('./personalSettings');
  if (USE_PORTABLE_SETTINGS && !db.portableSettings)
    throw new Error('Portable preferences are unavailable; export cannot omit them');
  const allSettings = USE_PORTABLE_SETTINGS
    ? mergePersonalSettings(settings.map(d => toDoc<SettingsDocument>(d)),
      (await db.portableSettings!.find({ selector: { userId } }).exec()).map(d => toDoc<SettingsDocument>(d)))
    : settings.map(d => toDoc<SettingsDocument>(d));
  return {
    bucketList: bucketList.map((d) => toDoc<BucketListDocument>(d)),
    bucketTaskLinks: bucketTaskLinks.map(d => toDoc<BucketTaskLinkDocument>(d)),
    tasks: tasks.map((d) => toDoc<TaskDocument>(d)),
    categories: categories.map((d) => toDoc<CategoryDocument>(d)),
    diary: diary.map((d) => toDoc<DiaryDocument>(d)),
    settings: allSettings,
    friendships: friendships.map((d) => toDoc<FriendshipDocument>(d)),
  };
}

function parseSettings(raw: SettingsDocument[]): Record<string, unknown> {
  const map: Record<string, unknown> = {};
  for (const doc of raw) {
    try {
      map[doc.key] = JSON.parse(doc.value);
    } catch {
      map[doc.key] = doc.value;
    }
  }
  return map;
}

async function fetchImageBlob(
  fileId: string,
  ownerUserId: string
): Promise<Blob | null> {
  if (CORE_BACKEND.driver === 'supabase') {
    // Never use an old Appwrite global image-cache key in the signed provider.
    if (currentSupabaseMediaOwner() !== ownerUserId) return null;
    return fetchSupabasePhoto(fileId).catch(() => null);
  }
  if (isPendingImageId(fileId)) {
    return getPendingImage(fileId, ownerUserId);
  }
  const cached = await getCachedImage(fileId);
  if (cached) return cached;
  if (getConnectivitySnapshot().status !== 'online') {
    if (DEBUG)
      console.log(`[Export] Skipping uncached image (offline): ${fileId}`);
    return null;
  }
  try {
    // Use the authenticated Appwrite download helper so cross-device exports
    // work even when browsers restrict third-party cookies (dev #624).
    const blob = await guardedStorage.downloadFileBlob({
      bucketId: APPWRITE_CONFIG.bucketId,
      fileId,
    });
    // A full cloud download remains exportable if IndexedDB cache is unavailable.
    await cacheImage(fileId, blob).catch(console.warn);
    return blob;
  } catch (err) {
    console.warn(`[Export] Failed to fetch image ${fileId}:`, err);
    return null;
  }
}

async function zipAsync(files: Record<string, Uint8Array>): Promise<Uint8Array> {
  const { zip } = await import('fflate');
  return new Promise((resolve, reject) => {
    zip(files, { level: 6 }, (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });
}

function makeFilename(ext: 'json' | 'zip'): string {
  const ts = format(new Date(), 'yyyy-MM-dd-HHmmss');
  return `mosaic-backup-${ts}.${ext}`;
}

export async function exportUserData(
  user: ExportUser,
  options: ExportOptions
): Promise<ExportResult> {
  const { includeImages, onProgress } = options;
  const generation = captureAccountWorkGeneration(user.id);
  const assertOwner = () => {
    if (generation === null || !isAccountWorkCurrent(user.id, generation))
      throw new Error('Account changed during export. No backup was returned.');
  };
  assertOwner();
  const report = (msg: string) => {
    if (onProgress) onProgress(msg);
  };
  report('Collecting data…');
  if (DEBUG) console.log('[Export] Collecting data for user', user.id);
  const raw = await collectCollections(user.id);
  assertOwner();
  const parsedSettings = parseSettings(raw.settings);
  const referencedImages = new Set<string>();
  for (const task of raw.tasks) {
    if (task.image && task.image.trim()) referencedImages.add(task.image);
  }
  for (const entry of raw.diary) {
    for (const id of parseDiaryPhotos(entry.photos)) referencedImages.add(id);
  }
  const profileImageId = parsedSettings['profileImageId'];
  if (typeof profileImageId === 'string' && profileImageId.trim()) {
    referencedImages.add(profileImageId);
  }
  const referencedArray = Array.from(referencedImages);
  const exportedAt = new Date().toISOString();
  const payload: ExportPayload = {
    format: 'mosaic-user-backup',
    app: { name: APP_NAME, version: APP_VERSION },
    version: EXPORT_VERSION,
    exportedAt,
    history: { tombstonesIncluded: true, scope: 'current-local-owner-snapshot' },
    user,
    counts: {
      tasks: raw.tasks.length,
      categories: raw.categories.length,
      diary: raw.diary.length,
      bucketList: raw.bucketList.length,
      bucketTaskLinks: raw.bucketTaskLinks.length,
      settings: raw.settings.length,
      friendships: raw.friendships.length,
      images: 0,
      missingImages: 0,
    },
    data: {
      tasks: raw.tasks,
      categories: raw.categories,
      diary: raw.diary,
      bucketList: raw.bucketList,
      bucketTaskLinks: raw.bucketTaskLinks,
      settings: raw.settings,
      friendships: raw.friendships,
    },
    restore: {
      restorable: ['tasks', 'categories', 'diary', 'settings', 'bucketList', 'bucketTaskLinks'],
      referenceOnly: ['friendships'],
      excluded: ['messages'],
    },
    images: {
      included: includeImages,
      referenced: referencedArray,
      missingImages: [],
      note: includeImages
        ? 'Image blobs are bundled inside images/.'
        : 'Image blobs not included. Re-export with "Include photos" to bundle them.',
    },
  };
  if (!includeImages) {
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    assertOwner();
    if (DEBUG) console.log('[Export] JSON export ready', payload.counts);
    return {
      blob,
      filename: makeFilename('json'),
      counts: payload.counts,
    };
  }
  const imageBlobs = new Map<string, Blob>();
  const missing: string[] = [];
  let index = 0;
  for (const fileId of referencedArray) {
    index++;
    report(`Fetching photos (${index}/${referencedArray.length})…`);
    const blob = await fetchImageBlob(fileId, user.id);
    assertOwner();
    if (blob) imageBlobs.set(fileId, blob);
    else missing.push(fileId);
  }
  payload.counts.images = imageBlobs.size;
  payload.counts.missingImages = missing.length;
  payload.images.missingImages = missing;
  report('Compressing…');
  const encoder = new TextEncoder();
  const files: Record<string, Uint8Array> = {};
  files['manifest.json'] = encoder.encode(JSON.stringify(payload, null, 2));
  files['data/tasks.json'] = encoder.encode(
    JSON.stringify(raw.tasks, null, 2)
  );
  files['data/categories.json'] = encoder.encode(
    JSON.stringify(raw.categories, null, 2)
  );
  files['data/diary.json'] = encoder.encode(
    JSON.stringify(raw.diary, null, 2)
  );
  files['data/bucketList.json'] = encoder.encode(JSON.stringify(raw.bucketList, null, 2));
  files['data/bucketTaskLinks.json'] = encoder.encode(JSON.stringify(raw.bucketTaskLinks, null, 2));
  files['data/settings.json'] = encoder.encode(
    JSON.stringify(raw.settings, null, 2)
  );
  files['data/friendships.json'] = encoder.encode(
    JSON.stringify(raw.friendships, null, 2)
  );
  for (const [fileId, blob] of imageBlobs) {
    const buf = await blob.arrayBuffer();
    files[`images/${fileId}.webp`] = new Uint8Array(buf);
  }
  const zipped = await zipAsync(files);
  assertOwner();
  const zipBuffer = zipped.buffer as ArrayBuffer;
  const blob = new Blob([zipBuffer], { type: 'application/zip' });
  if (DEBUG) console.log('[Export] ZIP export ready', payload.counts);
  return {
    blob,
    filename: makeFilename('zip'),
    counts: payload.counts,
  };
}

export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
