import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { BottomSheet } from '../ui/BottomSheet';
import { StickerImage } from './StickerImage';
import { useStickers } from '../../hooks/useStickers';
import { MAX_STICKERS, type SavedSticker } from '../../lib/stickerProtocol';

interface StickerPickerSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onPick: (sticker: SavedSticker) => Promise<void>;
  userId: string;
}

function StickerTile({ sticker, userId, onPick, onRemove, disabled }: {
  sticker: SavedSticker;
  userId: string;
  onPick: (sticker: SavedSticker) => Promise<void>;
  onRemove: (fileId: string) => Promise<void>;
  disabled: boolean;
}) {
  const [ready, setReady] = useState(false);
  return (
    <div className="relative group flex flex-col items-center p-1 rounded-lg">
      <button type="button" disabled={!ready || disabled}
        onClick={() => void onPick(sticker)}
        className="flex items-center justify-center rounded-lg bg-surfaceHighlight disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-emerald-500">
        <StickerImage fileId={sticker.fileId} viewerId={userId} label={sticker.label} size="picker" onReady={setReady} />
      </button>
      <span className="w-20 truncate text-center text-xs text-gray-400 mt-1" title={sticker.label}>{sticker.label}</span>
      <button type="button" onClick={() => void onRemove(sticker.fileId)} disabled={disabled}
        aria-label={'Remove ' + sticker.label}
        className="absolute right-0 top-0 p-1 rounded-full bg-surface text-gray-300 border border-[#444444] focus-visible:ring-2 focus-visible:ring-emerald-500">
        <X size={12} aria-hidden="true" />
      </button>
    </div>
  );
}

export const StickerPickerSheet: React.FC<StickerPickerSheetProps> = ({
  isOpen, onClose, onPick, userId,
}) => {
  const { stickers, isLoading, addSticker, removeSticker } = useStickers();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const importFile = async (file: File | undefined) => {
    if (!file || busy) return;
    setBusy(true); setError(null);
    try {
      const defaultLabel = file.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ');
      await addSticker(file, label.trim() || defaultLabel);
      setLabel('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Cannot import sticker.');
    } finally {
      setBusy(false);
    }
  };
  const send = async (sticker: SavedSticker) => {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      await onPick(sticker);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send sticker.');
    } finally {
      setBusy(false);
    }
  };
  const remove = async (fileId: string) => {
    if (busy) return;
    setBusy(true); setError(null);
    try { await removeSticker(fileId); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not remove sticker.'); }
    finally { setBusy(false); }
  };
  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Stickers" height="auto">
      <div className="px-4 pt-2 pb-8 text-white">
        <p className="text-xs text-gray-400 mb-3">
          Add transparent PNG/WebP stickers from your phone. White/black solid image edges are removed automatically.
          For photos with complex backgrounds, use your phone’s background remover before importing.
        </p>
        <div className="flex gap-2 items-center mb-3">
          <input value={label} onChange={event => setLabel(event.target.value.slice(0, 40))}
            placeholder="Optional sticker name" aria-label="Sticker name"
            className="min-w-0 flex-1 rounded-lg border border-[#444444] bg-surface px-3 py-2 text-sm text-white" />
          <label className={'flex shrink-0 items-center gap-1 rounded-lg bg-surfaceHighlight px-3 py-2 border border-[#444444] text-sm ' + (busy || stickers.length >= MAX_STICKERS ? 'opacity-50' : '')}>
            <Plus size={16} aria-hidden="true" /> Add
            <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only"
              aria-label="Import sticker image from phone" disabled={busy || isLoading || stickers.length >= MAX_STICKERS}
              onChange={event => {
                const file = event.target.files?.[0];
                event.target.value = '';
                void importFile(file);
              }} />
          </label>
        </div>
        <p className="text-xs text-gray-400 mb-3">{stickers.length}/{MAX_STICKERS} stickers · up to 128 KB per image</p>
        {error && <p role="alert" className="text-sm text-red-400 mb-3">{error}</p>}
        {isLoading ? <p role="status" className="text-sm text-gray-400">Loading stickers…</p>
          : stickers.length === 0 ? <p className="text-sm text-gray-400 py-6 text-center">No stickers yet. Import a picture to get started.</p>
          : <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 justify-items-center max-h-[50dvh] overflow-y-auto overscroll-contain">
              {stickers.map(sticker => <StickerTile key={sticker.fileId} sticker={sticker} userId={userId}
                onPick={send} onRemove={remove} disabled={busy} />)}
            </div>}
        {busy && <p role="status" className="text-sm text-gray-400 mt-2">Processing sticker…</p>}
      </div>
    </BottomSheet>
  );
};
