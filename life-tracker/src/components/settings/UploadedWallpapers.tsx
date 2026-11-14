import React, { useEffect, useRef, useState } from 'react';
import { Check, ImagePlus, Trash2 } from 'lucide-react';
import { useTaskImage } from '../../hooks/useTaskImage';
import { type WallpaperUploadSlot } from '../../lib/calendarWallpaper';
import {
  MAX_WALLPAPER_UPLOADS, wallpaperFileIdForOwner,
  listOwnerWallpaperSlots, uploadOwnerWallpaper, deleteOwnerWallpaper,
} from '../../lib/wallpaperUploadStorage';

interface Props {
  ownerId: string;
  slots: readonly WallpaperUploadSlot[];
  selected: string;
  onSlotsChange: (slots: WallpaperUploadSlot[]) => Promise<void>;
  onSelect: (id: `upload:${WallpaperUploadSlot}`) => Promise<void>;
  onBeforeDelete: (slot: WallpaperUploadSlot) => Promise<void>;
}
function WallpaperPhotoTile({ ownerId, slot, selected, onSelect, onDelete, busy }: {
  ownerId: string; slot: WallpaperUploadSlot; selected: boolean; busy: boolean;
  onSelect: (slot: WallpaperUploadSlot) => void;
  onDelete: (slot: WallpaperUploadSlot) => void;
}) {
  const { imageUrl, isLoading } = useTaskImage(wallpaperFileIdForOwner(ownerId, slot));
  return (
    <div className="relative min-w-0">
      <button type="button" aria-label={`Use uploaded wallpaper ${slot + 1}`}
        aria-pressed={selected} onClick={() => onSelect(slot)} disabled={busy}
        className={`w-full overflow-hidden rounded-xl border-2 bg-surface text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${selected ? 'border-emerald-500' : 'border-border'}`}>
        <span className="relative flex h-20 items-center justify-center overflow-hidden">
          {imageUrl ? <img src={imageUrl} alt="" className="h-full w-full object-cover" /> :
            <span className="text-xs text-gray-400">{isLoading ? 'Loading…' : 'Unavailable offline'}</span>}
          {selected && <span aria-hidden="true" className="absolute bottom-1 left-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-black shadow-sm"><Check size={13} strokeWidth={3} /></span>}
        </span>
        <span className="block truncate px-2 py-1 text-xs font-medium text-gray-300">Photo {slot + 1}</span>
      </button>
      <button type="button" aria-label={`Delete uploaded wallpaper ${slot + 1}`}
        onClick={() => onDelete(slot)} disabled={busy}
        className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-surface/95 text-gray-300 focus-visible:ring-2 focus-visible:ring-accent">
        <Trash2 size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
export const UploadedWallpapers: React.FC<Props> = ({
  ownerId, slots, selected, onSlotsChange, onSelect, onBeforeDelete,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [remoteSlots, setRemoteSlots] = useState<WallpaperUploadSlot[]>([...slots]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState<WallpaperUploadSlot | null>(null);
  const ownerRef = useRef(ownerId);
  const slotsChanged = useRef(onSlotsChange);
  useEffect(() => { ownerRef.current = ownerId; }, [ownerId]);
  useEffect(() => { slotsChanged.current = onSlotsChange; }, [onSlotsChange]);

  useEffect(() => {
    let active = true;
    void listOwnerWallpaperSlots(ownerId).then(found => {
      if (!active || ownerRef.current !== ownerId) return;
      setRemoteSlots(found);
      if (found.join(',') !== slots.join(',')) void slotsChanged.current(found).catch(() => {});
    }).catch(() => { /* Offline: use the last owner-synced gallery. */ });
    return () => { active = false; };
    // Only run a remote scan on account change; the upload/delete handlers
    // apply their own verified updates to this component and synced settings.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerId]);

  const addFile = async (file: File | undefined) => {
    if (!file || busy) return;
    setError('');
    setBusy(true);
    try {
      const slot = await uploadOwnerWallpaper(ownerId, file);
      if (ownerRef.current !== ownerId) return;
      const updated = [...new Set([...remoteSlots, slot])].sort((a, b) => a - b);
      setRemoteSlots(updated);
      await onSlotsChange(updated);
      await onSelect(`upload:${slot}`);
    } catch (cause) {
      if (ownerRef.current === ownerId)
        setError(cause instanceof Error ? cause.message : 'Wallpaper upload failed.');
    } finally {
      if (ownerRef.current === ownerId) setBusy(false);
    }
  };
  const erase = async (slot: WallpaperUploadSlot) => {
    if (busy) return;
    setError('');
    setBusy(true);
    try {
      await onBeforeDelete(slot);
      await deleteOwnerWallpaper(ownerId, slot);
      if (ownerRef.current !== ownerId) return;
      const updated = remoteSlots.filter(item => item !== slot);
      setRemoteSlots(updated);
      await onSlotsChange(updated);
      setConfirm(null);
    } catch (cause) {
      if (ownerRef.current === ownerId)
        setError(cause instanceof Error ? cause.message : 'Wallpaper deletion failed.');
    } finally {
      if (ownerRef.current === ownerId) setBusy(false);
    }
  };
  return (
    <section className="mt-5" aria-label="My uploaded wallpapers">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-gray-300">My photos</h4>
        <span className="text-xs tabular-nums text-gray-400">{remoteSlots.length} / {MAX_WALLPAPER_UPLOADS}</span>
      </div>
      <p className="mb-2 mt-1 text-xs text-gray-400">
        Tap a photo to use it on Home. Selected photos have a highlighted border and check mark. Up to 5 uploads, synced to your account and cached for offline use.
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {remoteSlots.map(slot => (
          <WallpaperPhotoTile key={slot} ownerId={ownerId} slot={slot}
            busy={busy} selected={selected === `upload:${slot}`}
            onSelect={choice => void onSelect(`upload:${choice}`)}
            onDelete={choice => setConfirm(choice)} />
        ))}
        {remoteSlots.length < MAX_WALLPAPER_UPLOADS && (
          <button type="button" onClick={() => inputRef.current?.click()} disabled={busy}
            className="flex h-[108px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface/60 text-sm font-medium text-gray-300 transition-colors hover:bg-surfaceHighlight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50">
            <ImagePlus size={22} aria-hidden="true" />
            {busy ? 'Working…' : 'Upload photo'}
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only"
        tabIndex={-1} aria-label="Choose wallpaper photo"
        onChange={event => {
          const file = event.currentTarget.files?.[0];
          if (file) void addFile(file);
          event.currentTarget.value = '';
        }} />
      {remoteSlots.length >= MAX_WALLPAPER_UPLOADS &&
        <p className="mt-2 text-xs text-gray-400">Five-photo limit reached. Delete an existing photo before adding another.</p>}
      {error && <p role="alert" className="mt-2 text-xs text-red-400">{error}</p>}
      {confirm !== null && (
        <div role="group" aria-label="Confirm wallpaper deletion"
          className="mt-3 rounded-xl border border-border bg-surface px-3 py-3">
          <p className="mb-3 text-sm text-gray-300">
            Delete photo {confirm + 1} from your account? Pages using it will revert to Off.
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setConfirm(null)} disabled={busy}
              className="flex-1 rounded-lg border border-border bg-surfaceHighlight px-3 py-2 text-sm font-medium text-gray-300">Cancel</button>
            <button type="button" onClick={() => void erase(confirm)} disabled={busy}
              className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">Delete photo</button>
          </div>
        </div>
      )}
    </section>
  );
};
export default UploadedWallpapers;
