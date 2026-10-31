import { getImageCacheUsage } from './imageCache';
import { getPendingImageUsageForUser } from './pendingImages';

export interface DeviceStorageUsage {
  ownerId: string;
  /** Approximate browser-reported usage/quota for this origin, not free disk space. */
  origin: { usedBytes: number | null; quotaBytes: number | null } | null;
  /** null = browser unavailable/declined/error */
  persistent: boolean | null;
  /** Device-wide cache, NOT partitioned by account. */
  downloadedImages: { bytes: number; count: number } | null;
  /** Current owner's offline image uploads only. */
  pendingImages: { bytes: number; count: number } | null;
}

function validBytes(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value : null;
}

async function originEstimate(): Promise<DeviceStorageUsage['origin']> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null;
  const estimate = await navigator.storage.estimate();
  return {
    usedBytes: validBytes(estimate.usage),
    quotaBytes: validBytes(estimate.quota),
  };
}

async function persistenceState(): Promise<boolean | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persisted) return null;
  return Boolean(await navigator.storage.persisted());
}

/** Storage instrumentation is only called when the dedicated page is visited. */
export async function readDeviceStorageUsage(ownerId: string): Promise<DeviceStorageUsage> {
  if (!ownerId) throw new Error('Storage inventory requires an authenticated owner.');
  const [origin, persistent, downloadedImages, pendingImages] = await Promise.allSettled([
    originEstimate(),
    persistenceState(),
    getImageCacheUsage(),
    getPendingImageUsageForUser(ownerId),
  ]);
  return {
    ownerId,
    origin: origin.status === 'fulfilled' ? origin.value : null,
    persistent: persistent.status === 'fulfilled' ? persistent.value : null,
    downloadedImages: downloadedImages.status === 'fulfilled' ? downloadedImages.value : null,
    pendingImages: pendingImages.status === 'fulfilled' ? pendingImages.value : null,
  };
}
