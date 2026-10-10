import { Permission, Role } from 'appwrite';
import { guardedStorage } from './sdk';
import { APPWRITE_PROJECT_ID, APPWRITE_STORAGE_BUCKET_ID } from './appwriteConfig';
import { getCachedImage, cacheImage, deleteCachedImage } from './imageCache';
import { getConnectivitySnapshot } from './connectivity';
import { STICKER_FILE_ID } from './stickerProtocol';

const MAX_INPUT_BYTES = 10 * 1024 * 1024;
const MAX_INPUT_PIXELS = 16_000_000;
export const MAX_STICKER_BYTES = 128 * 1024;
const EDGE_THRESHOLD = 42;

function ownerPermissions(userId: string): string[] {
  return [
    Permission.read(Role.user(userId)),
    Permission.update(Role.user(userId)),
    Permission.delete(Role.user(userId)),
  ];
}
const cachedKey = (userId: string, fileId: string) => userId + ':sticker:' + fileId;
const isConflict = (error: unknown): boolean => (error as { code?: number })?.code === 409;

function nearBg(value: number, bg: 0 | 255): boolean {
  return Math.abs(value - bg) <= EDGE_THRESHOLD;
}

/** Preserve existing alpha. For opaque sticker art, cut *connected* white/black
 * background from the image perimeter. Reject complex photos instead of hiding
 * opaque backgrounds behind a fake transparent canvas. */
export async function prepareSticker(file: File): Promise<Blob> {
  if (file.size <= 0 || file.size > MAX_INPUT_BYTES ||
      !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    throw new Error('Choose a PNG, JPEG or WebP image under 10 MB.');
  }
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width * bitmap.height > MAX_INPUT_PIXELS) {
      throw new Error('Sticker resolution is too large.');
    }
    if (!bitmap.width || !bitmap.height) throw new Error('Invalid image dimensions');
    // Downsample before reading pixels; otherwise a phone photo can allocate
    // >100 MB just for flood-fill buffers on a low-memory Android device.
    const scanScale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scanScale));
    const h = Math.max(1, Math.round(bitmap.height * scanScale));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Canvas unavailable');
    ctx.drawImage(bitmap, 0, 0, w, h);
    const image = ctx.getImageData(0, 0, w, h);
    const a = image.data;
    let hasAlpha = false;
    for (let i = 3; i < a.length; i += 4) {
      if (a[i] < 250) { hasAlpha = true; break; }
    }
    if (!hasAlpha) {
      // Only accept near-solid white/black edges (typical sticker screenshots).
      // Never apply automatic removal to a mixed-background photo.
      const corners = [0, (w - 1) * 4, (h - 1) * w * 4, (h * w - 1) * 4];
      const light = corners.every(i => nearBg(a[i], 255) && nearBg(a[i + 1], 255) && nearBg(a[i + 2], 255));
      const dark = corners.every(i => nearBg(a[i], 0) && nearBg(a[i + 1], 0) && nearBg(a[i + 2], 0));
      if (!light && !dark) {
        throw new Error('Background is not transparent. Use your phone’s Cut Out / Remove Background first, then import a transparent PNG or WebP.');
      }
      const bg: 0 | 255 = light ? 255 : 0;
      const visited = new Uint8Array(w * h);
      const queue = new Uint32Array(w * h);
      let head = 0, tail = 0;
      const push = (pixel: number) => {
        if (visited[pixel]) return;
        visited[pixel] = 1;
        const i = pixel * 4;
        if (nearBg(a[i], bg) && nearBg(a[i + 1], bg) && nearBg(a[i + 2], bg)) queue[tail++] = pixel;
      };
      for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
      for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
      while (head < tail) {
        const pixel = queue[head++], x = pixel % w, y = (pixel / w) | 0;
        a[pixel * 4 + 3] = 0;
        if (x > 0) push(pixel - 1);
        if (x + 1 < w) push(pixel + 1);
        if (y > 0) push(pixel - w);
        if (y + 1 < h) push(pixel + w);
      }
      if (tail < 1) throw new Error('Could not remove background.');
      ctx.putImageData(image, 0, 0);
    }
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (a[(y * w + x) * 4 + 3] > 8) {
        x0 = Math.min(x0, x); x1 = Math.max(x1, x);
        y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
    }
    if (x1 < x0 || y1 < y0) throw new Error('No visible sticker pixels remain.');
    const pad = Math.max(2, Math.round(Math.max(x1 - x0, y1 - y0) * 0.025));
    const sx = Math.max(0, x0 - pad), sy = Math.max(0, y0 - pad);
    const sw = Math.min(w - sx, x1 - sx + 1 + pad);
    const sh = Math.min(h - sy, y1 - sy + 1 + pad);
    let maxSide = 384;
    while (maxSide >= 96) {
      const scale = Math.min(1, maxSide / Math.max(sw, sh));
      const target = document.createElement('canvas');
      target.width = Math.max(1, Math.round(sw * scale));
      target.height = Math.max(1, Math.round(sh * scale));
      const targetCtx = target.getContext('2d');
      if (!targetCtx) throw new Error('Canvas unavailable');
      targetCtx.drawImage(canvas, sx, sy, sw, sh, 0, 0, target.width, target.height);
      for (const quality of [0.87, 0.72, 0.55, 0.4]) {
        const blob = await new Promise<Blob | null>(resolve => target.toBlob(resolve, 'image/webp', quality));
        if (blob?.type === 'image/webp' && blob.size <= MAX_STICKER_BYTES) return blob;
      }
      maxSide = Math.floor(maxSide * 0.75);
    }
    throw new Error('Sticker cannot be compressed below 128 KB.');
  } finally {
    bitmap.close();
  }
}

export async function uploadSticker(file: File, userId: string): Promise<string> {
  if (!userId) throw new Error('Missing account');
  if (getConnectivitySnapshot().status !== 'online') throw new Error('Connect to upload a sticker.');
  const blob = await prepareSticker(file);
  const salt = new TextEncoder().encode(userId + ':');
  const bytes = new Uint8Array(salt.byteLength + blob.size);
  bytes.set(salt);
  bytes.set(new Uint8Array(await blob.arrayBuffer()), salt.byteLength);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  const fileId = 'stk_' + Array.from(digest.slice(0, 16), b => b.toString(16).padStart(2, '0')).join('');
  try {
    await guardedStorage.createFile({
      bucketId: APPWRITE_STORAGE_BUCKET_ID, fileId,
      file: new File([blob], fileId + '.webp', { type: 'image/webp' }),
      permissions: ownerPermissions(userId),
    });
  } catch (error) {
    if (!isConflict(error)) throw error;
    const existing = await guardedStorage.getFile({ bucketId: APPWRITE_STORAGE_BUCKET_ID, fileId });
    if (!Array.isArray(existing.$permissions) ||
        !ownerPermissions(userId).every(permission => existing.$permissions.includes(permission))) {
      throw new Error('Sticker ID belongs to a different owner.', { cause: error });
    }
  }
  await cacheImage(cachedKey(userId, fileId), blob).catch(() => {});
  return fileId;
}

/** Share *one* deduplicated file with each chat recipient, never globally.
 * Called immediately before delivering each queued message, including after
 * offline reconnect. No extra file copy is created per send. */
export async function allowStickerRecipient(userId: string, recipientId: string, fileId: string): Promise<void> {
  if (!STICKER_FILE_ID.test(fileId) || !userId || !recipientId) throw new Error('Invalid sticker share');
  const expected = ownerPermissions(userId);
  const readRecipient = Permission.read(Role.user(recipientId));
  for (let attempt = 0; attempt < 3; attempt++) {
    const file = await guardedStorage.getFile({ bucketId: APPWRITE_STORAGE_BUCKET_ID, fileId });
    const perms = file.$permissions ?? [];
    if (!expected.every(permission => perms.includes(permission)) ||
        perms.includes(Permission.read(Role.users())) || perms.includes(Permission.read(Role.any()))) {
      throw new Error('Sticker must be owned privately by the sender.');
    }
    if (perms.includes(readRecipient)) return;
    await guardedStorage.updateFile({
      bucketId: APPWRITE_STORAGE_BUCKET_ID, fileId,
      permissions: [...perms, readRecipient],
    });
    const confirmed = await guardedStorage.getFile({ bucketId: APPWRITE_STORAGE_BUCKET_ID, fileId });
    if (confirmed.$permissions?.includes(readRecipient)) return;
  }
  throw new Error('Could not share sticker with recipient.');
}

export async function loadStickerImage(fileId: string, viewerId: string): Promise<string | null> {
  if (!STICKER_FILE_ID.test(fileId) || !viewerId) return null;
  const key = cachedKey(viewerId, fileId);
  const cached = await getCachedImage(key);
  if (cached) return URL.createObjectURL(cached);
  if (getConnectivitySnapshot().status !== 'online') return null;
  const url = guardedStorage.getFileView({ bucketId: APPWRITE_STORAGE_BUCKET_ID, fileId });
  const response = await fetch(url.toString(), {
    credentials: 'include',
    headers: { 'X-Appwrite-Project': APPWRITE_PROJECT_ID },
  });
  if (!response.ok) return null;
  const blob = await response.blob();
  if (blob.size > MAX_STICKER_BYTES || !['image/webp', 'image/png'].includes(blob.type)) return null;
  await cacheImage(key, blob).catch(() => {});
  return URL.createObjectURL(blob);
}

/** Only reclaim never-shared, never-messaged files. Sent images survive
 * removal from the personal picker so old chat history is not broken. */
export async function deleteUnusedSticker(fileId: string, userId: string, hasLocalReference: boolean): Promise<void> {
  if (!STICKER_FILE_ID.test(fileId) || !userId || hasLocalReference ||
      getConnectivitySnapshot().status !== 'online') return;
  const file = await guardedStorage.getFile({ bucketId: APPWRITE_STORAGE_BUCKET_ID, fileId });
  const actual = file.$permissions ?? [];
  const expected = ownerPermissions(userId);
  if (actual.length !== expected.length || !expected.every(p => actual.includes(p))) return;
  await guardedStorage.deleteFile({ bucketId: APPWRITE_STORAGE_BUCKET_ID, fileId });
  await deleteCachedImage(cachedKey(userId, fileId));
}
