import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, Cloud, HardDrive, Images, RefreshCw, Trash2 } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BottomSheet } from '../components/ui/BottomSheet';
import { useAuth } from '../hooks/useAuth';
import { hasExpectedRouteParent, makeRouteParentState } from '../lib/primarySwipeNavigation';
import { clearAllCachedImages } from '../lib/imageCache';
import { CloudReclaimSection } from '../components/settings/CloudReclaimSection';
import { readDeviceStorageUsage, type DeviceStorageUsage } from '../lib/deviceStorageUsage';
import type { CloudMediaInventory, CloudMediaKind } from '../lib/cloudMediaUsage';

function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) return 'Unavailable';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let result = bytes / 1024;
  let index = 0;
  while (result >= 1024 && index < units.length - 1) {
    result /= 1024;
    index++;
  }
  return `${result.toFixed(1)} ${units[index]}`;
}

export function StoragePage() {
  const { user } = useAuth();
  const ownerId = user?.$id ?? '';
  const ownerRef = useRef(ownerId);
  const cloudScanRef = useRef<AbortController | null>(null);
  useEffect(() => {
    ownerRef.current = ownerId;
    return () => {
      cloudScanRef.current?.abort();
      cloudScanRef.current = null;
    };
  }, [ownerId]);
  const navigate = useNavigate();
  const location = useLocation();
  const [refreshIndex, setRefreshIndex] = useState(0);
  const requestKey = `${ownerId}:${refreshIndex}`;
  const [report, setReport] = useState<{ key: string; usage: DeviceStorageUsage | null } | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [cloudReport, setCloudReport] = useState<{ ownerId: string; loading: boolean; error: string; data: CloudMediaInventory | null } | null>(null);

  useEffect(() => {
    let active = true;
    if (ownerId) {
      void readDeviceStorageUsage(ownerId)
        .then((usage) => { if (active) setReport({ key: requestKey, usage }); })
        .catch(() => { if (active) setReport({ key: requestKey, usage: null }); });
    }
    return () => { active = false; };
  }, [ownerId, requestKey]);

  const loading = Boolean(ownerId && report?.key !== requestKey);
  const current = report?.key === requestKey && report.usage?.ownerId === ownerId ? report.usage : null;
  const downloaded = current?.downloadedImages;
  const visibleCloud = cloudReport?.ownerId === ownerId ? cloudReport : null;
  const cloudBusy = Boolean(visibleCloud?.loading);
  const canClear = Boolean(ownerId && downloaded && downloaded.count > 0 && !loading && !clearing);

  const handleCloudCheck = async () => {
    if (!ownerId || cloudBusy) return;
    const requestOwner = ownerId;
    cloudScanRef.current?.abort();
    const controller = new AbortController();
    cloudScanRef.current = controller;
    setCloudReport({ ownerId: requestOwner, loading: true, error: '', data: null });
    try {
      const { scanOwnerReferencedCloudMedia } = await import('../lib/cloudMediaUsage');
      if (controller.signal.aborted) return;
      const data = await scanOwnerReferencedCloudMedia(requestOwner, controller.signal);
      if (!controller.signal.aborted && ownerRef.current === requestOwner) {
        setCloudReport({ ownerId: requestOwner, loading: false, error: '', data });
      }
    } catch {
      if (!controller.signal.aborted && ownerRef.current === requestOwner) {
        setCloudReport({
          ownerId: requestOwner, loading: false,
          error: 'Cloud photos could not be checked. Verify your connection and sign-in.',
          data: null,
        });
      }
    } finally {
      if (cloudScanRef.current === controller) cloudScanRef.current = null;
    }
  };

  const cloudKindName = (kind: CloudMediaKind) =>
    kind === 'tasks' ? 'Task photos'
      : kind === 'diary' ? 'Diary photos'
        : kind === 'profile' ? 'Profile photos'
          : 'Referenced in multiple places';

  const handleBack = () => {
    if (hasExpectedRouteParent(location.key, location.state, '/settings/data')) {
      navigate(-1);
    } else {
      navigate('/settings/data', { replace: true, state: makeRouteParentState('/settings') });
    }
  };

  const handleClear = async () => {
    if (!canClear || ownerRef.current !== ownerId) return;
    setClearing(true);
    setFeedback('');
    try {
      // This only clears mosaic_image_cache, never RxDB, queued media, or PWA assets.
      await clearAllCachedImages();
      if (ownerRef.current === ownerId) {
        setConfirmClear(false);
        setFeedback('Downloaded image cache cleared on this device.');
        setRefreshIndex((value) => value + 1);
      }
    } catch {
      if (ownerRef.current === ownerId) {
        setFeedback('Could not clear downloaded images. Your other data was not changed.');
      }
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="flex min-h-full flex-col bg-background text-white">
      <header className="sticky top-0 z-20 flex items-center justify-center border-b border-[#333333] bg-background px-4 py-3">
        <button type="button" aria-label="Back" onClick={handleBack}
          className="absolute left-4 rounded-lg p-2 text-gray-400 hover:bg-surfaceHighlight focus-visible:ring-2 focus-visible:ring-emerald-500/60">
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
        <h1 className="text-lg font-bold">Storage</h1>
      </header>
      <div className="flex-1 pb-24">
        <section className="border-b border-[#333333] px-4 py-5" aria-label="Device storage">
          <div className="mb-3 flex items-center gap-2"><HardDrive size={18} aria-hidden="true" /><h2 className="font-semibold">This device</h2></div>
          {loading && <p role="status" className="text-sm text-gray-400">Measuring storage…</p>}
          {!loading && !current && <p role="status" className="text-sm text-gray-400">Storage information is unavailable.</p>}
          {!loading && current && (
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3"><dt>Estimated browser storage used</dt><dd className="font-medium">{formatBytes(current.origin?.usedBytes)}</dd></div>
              <div className="flex items-center justify-between gap-3"><dt>Estimated browser quota</dt><dd>{formatBytes(current.origin?.quotaBytes)}</dd></div>
              <div className="flex items-center justify-between gap-3"><dt>Persistent browser storage</dt><dd>{current.persistent === null ? 'Unavailable' : current.persistent ? 'Granted' : 'Not granted'}</dd></div>
              <p className="text-xs leading-relaxed text-gray-400">Browser estimates cover this site's origin, not available phone storage. They may include the app, database and other caches; the figures below are measured separately and should not be added to the estimate.</p>
            </dl>
          )}
        </section>
        <section className="border-b border-[#333333] px-4 py-5" aria-label="Media storage">
          <h2 className="mb-4 font-semibold">Media</h2>
          <div className="mb-4 flex items-start gap-3">
            <Images size={18} className="mt-1 shrink-0 text-gray-400" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="font-medium">Downloaded images (all accounts on this device)</p>
              <p className="text-sm text-gray-400">{formatBytes(downloaded?.bytes)}{downloaded ? ` · ${downloaded.count} cached images` : ''}</p>
            </div>
          </div>
          <button type="button" disabled={!canClear} onClick={() => setConfirmClear(true)}
            className="w-full rounded-xl border border-[#333333] bg-surface px-4 py-3 text-sm font-medium disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-emerald-500/60">
            Clear downloaded images
          </button>
          <p className="mt-2 text-xs leading-relaxed text-gray-400">Only cached downloads are removed. Cloud originals remain unchanged. Previously viewed photos may be unavailable offline until re-downloaded. Images may be cached again while Mosaic is open.</p>
          <div className="mt-5 flex items-start gap-3">
            <RefreshCw size={18} className="mt-1 shrink-0 text-gray-400" aria-hidden="true" />
            <div>
              <p className="font-medium">Pending photo uploads (this account)</p>
              <p className="text-sm text-gray-400">{formatBytes(current?.pendingImages?.bytes)}{current?.pendingImages ? ` · ${current.pendingImages.count} waiting` : ''}</p>
              <p className="mt-1 text-xs text-gray-400">Protected offline files — not removed by cache cleanup. Other pending synced work is not included.</p>
            </div>
          </div>
        </section>
        <section className="border-b border-[#333333] px-4 py-5" aria-label="Referenced cloud photos">
          <div className="mb-3 flex items-center gap-2">
            <Cloud size={18} aria-hidden="true" />
            <h2 className="font-semibold">Referenced cloud photos</h2>
          </div>
          <p className="mb-4 text-sm leading-relaxed text-gray-400">
            Check photos referenced by your synced tasks, Diary and profile. This is not your
            full account storage usage or a cloud quota. Unreferenced, missing and chat files are excluded.
            No files are downloaded or deleted.
          </p>
          <button type="button" disabled={!ownerId || cloudBusy}
            onClick={() => void handleCloudCheck()}
            className="w-full rounded-xl border border-[#333333] bg-surface px-4 py-3 text-sm font-medium disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-emerald-500/60">
            {cloudBusy ? 'Checking cloud photos…' : 'Check referenced cloud photos'}
          </button>
          {cloudBusy && <p role="status" className="mt-3 text-sm text-gray-400">Reading owner-referenced cloud metadata…</p>}
          {visibleCloud?.error && <p role="status" className="mt-3 text-sm text-red-400">{visibleCloud.error}</p>}
          {visibleCloud?.data && (
            <div className="mt-4 space-y-3">
              <dl className="space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt>Verified referenced subtotal</dt>
                  <dd className="font-semibold">{formatBytes(visibleCloud.data.verified.bytes)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt>Verified files</dt><dd>{visibleCloud.data.verified.count}</dd>
                </div>
                {(['tasks', 'diary', 'profile', 'multiple'] as const).map(kind => (
                  <div className="flex items-center justify-between gap-3" key={kind}>
                    <dt>{cloudKindName(kind)}</dt>
                    <dd>{formatBytes(visibleCloud.data!.byKind[kind].bytes)} · {visibleCloud.data!.byKind[kind].count}</dd>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-3">
                  <dt>Unavailable or unverified files</dt><dd>{visibleCloud.data.unavailable}</dd>
                </div>
              </dl>
              {(visibleCloud.data.truncated || visibleCloud.data.unavailable > 0) && (
                <p role="status" className="text-xs text-gray-400">Partial inventory: additional referenced files may exist or be unavailable. These totals are not exhaustive.</p>
              )}
              {visibleCloud.data.largest.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold">Largest verified photos</h3>
                  <ol className="space-y-1 text-sm text-gray-400">
                    {visibleCloud.data.largest.map((entry, index) => (
                      <li className="flex justify-between gap-3" key={index}>
                        <span>{cloudKindName(entry.kind)}</span><span>{formatBytes(entry.bytes)}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              <p className="text-xs text-gray-400">Last checked: {new Date(visibleCloud.data.checkedAt).toLocaleString()} · Read-only, reference-backed estimate.</p>
            </div>
          )}
        </section>
        <CloudReclaimSection key={ownerId} ownerId={ownerId} />
        <div className="px-4 py-4">
          <button type="button" disabled={loading || clearing} onClick={() => setRefreshIndex((value) => value + 1)}
            className="rounded-lg px-3 py-2 text-sm text-gray-300 hover:bg-surfaceHighlight focus-visible:ring-2 focus-visible:ring-emerald-500/60">Refresh usage</button>
          {feedback && <p role="status" className="mt-3 text-sm text-gray-300">{feedback}</p>}
        </div>
      </div>
      <BottomSheet isOpen={confirmClear} onClose={() => { if (!clearing) setConfirmClear(false); }}
        title="Clear downloaded images" height="auto" isLocked={clearing} preventDismiss={clearing}>
        <div className="px-4 pb-8 pt-2">
          <p className="mb-5 text-sm leading-relaxed text-gray-300">Remove {formatBytes(downloaded?.bytes)} of cached images for all Mosaic accounts on this device? Uploaded originals are not deleted, but cached photos may be unavailable offline. Pending uploads, tasks, Diary and app files are kept.</p>
          <div className="flex gap-3">
            <button type="button" disabled={clearing} onClick={() => setConfirmClear(false)} className="flex-1 rounded-xl bg-surfaceHighlight py-3 focus-visible:ring-2 focus-visible:ring-emerald-500/60">Cancel</button>
            <button type="button" disabled={!canClear} onClick={() => void handleClear()} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-500 py-3 font-medium text-white disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-red-500/60">
              <Trash2 size={16} aria-hidden="true" />{clearing ? 'Clearing…' : 'Clear cache'}
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
