import React, { useState } from 'react';
import type { GiphySticker } from '../../lib/giphyStickers';

const GiphyStickerSearch = React.lazy(() => import('./GiphyStickerSearch').then(module => ({ default: module.GiphyStickerSearch })));

import { Check, Plus, Search } from 'lucide-react';
import { BottomSheet } from '../ui/BottomSheet';
import { PackStickerImage } from './PackStickerImage';
import {
  STICKER_PACKS,
  findSticker,
  readInstalledPacks,
  saveInstalledPacks,
} from '../../lib/stickerPacks';

interface StickerPackSheetProps {
  isOpen: boolean;
  onClose: () => void;
  ownerId: string;
  onPick: (packId: string, stickerId: string) => void;
  onPickGiphy?: (sticker: GiphySticker) => void;
}

export const StickerPackSheet: React.FC<StickerPackSheetProps> = ({
  isOpen, onClose, ownerId, onPick, onPickGiphy,
}) => {
  const [tab, setTab] = useState<'installed' | 'discover' | 'giphy'>('installed');
  const [query, setQuery] = useState('');
  const [activePackId, setActivePackId] = useState('reactions');
  const [prefs, setPrefs] = useState(() => ({
    ownerId, ids: readInstalledPacks(ownerId),
  }));
  const installed = prefs.ownerId === ownerId ? prefs.ids : readInstalledPacks(ownerId);
  const term = query.toLowerCase().trim();
  const availablePacks = STICKER_PACKS.filter(pack => tab === 'discover' || installed.includes(pack.id));
  const matches = availablePacks.filter(pack =>
    !term ||
    pack.name.toLowerCase().includes(term) ||
    pack.description.toLowerCase().includes(term) ||
    pack.stickers.some(sticker => sticker.label.toLowerCase().includes(term))
  );
  const activePack = matches.find(pack => pack.id === activePackId) ?? matches[0];

  const toggleInstall = (packId: string) => {
    const next = installed.includes(packId)
      ? installed.filter(id => id !== packId)
      : [...installed, packId];
    setPrefs({ ownerId, ids: next });
    saveInstalledPacks(ownerId, next);
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Stickers" height="auto">
      <div className="px-1 pt-2 pb-6">
        <div className="flex gap-2 mb-3" role="tablist" aria-label="Sticker libraries">
          <button type="button" role="tab" aria-selected={tab === 'installed'}
            className={'flex-1 rounded-lg px-3 py-2 text-sm font-medium focus-visible:ring-2 focus-visible:ring-emerald-500 ' +
              (tab === 'installed' ? 'bg-surfaceHighlight text-white' : 'bg-surface text-gray-400')}
            onClick={() => setTab('installed')}>My Packs</button>
          <button type="button" role="tab" aria-selected={tab === 'discover'}
            className={'flex-1 rounded-lg px-3 py-2 text-sm font-medium focus-visible:ring-2 focus-visible:ring-emerald-500 ' +
              (tab === 'discover' ? 'bg-surfaceHighlight text-white' : 'bg-surface text-gray-400')}
            onClick={() => setTab('discover')}>Discover</button>
          <button type="button" role="tab" aria-selected={tab === 'giphy'}
            className={'flex-1 rounded-lg px-3 py-2 text-sm font-medium focus-visible:ring-2 focus-visible:ring-emerald-500 ' +
              (tab === 'giphy' ? 'bg-surfaceHighlight text-white' : 'bg-surface text-gray-400')}
            onClick={() => setTab('giphy')}>GIPHY</button>
        </div>
        {tab === 'giphy' ? (
          <React.Suspense fallback={<div role="status" className="py-8 text-center text-sm text-gray-400">Opening GIPHY…</div>}>
            <GiphyStickerSearch onPick={sticker => onPickGiphy?.(sticker)} />
          </React.Suspense>
        ) : (
        <>
        <label className="flex items-center gap-2 rounded-xl border border-[#444444] bg-surface px-3 py-2 text-gray-400">
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">Search stickers</span>
          <input value={query} onChange={event => setQuery(event.target.value)}
            placeholder="Search stickers" aria-label="Search stickers"
            className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-gray-400" />
        </label>
        {tab === 'discover' && (
          <p className="mt-2 text-xs text-gray-400">
            Browse the licensed starter collection. Character packs require distribution rights.
          </p>
        )}
        {matches.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-400">
            {tab === 'installed' && installed.length === 0
              ? 'No packs installed. Explore Discover to add one.'
              : 'No matching stickers.'}
          </div>
        ) : (
          <>
            <div className="flex gap-2 overflow-x-auto py-3" aria-label="Sticker packs">
              {matches.map(pack => (
                <button key={pack.id} type="button" aria-pressed={activePack?.id === pack.id}
                  onClick={() => setActivePackId(pack.id)}
                  className={'flex-shrink-0 rounded-xl border px-3 py-2 text-xs font-medium focus-visible:ring-2 focus-visible:ring-emerald-500 ' +
                    (activePack?.id === pack.id
                      ? 'border-emerald-500 bg-surfaceHighlight text-white'
                      : 'border-[#444444] bg-surface text-gray-300')}>
                  {pack.name}
                </button>
              ))}
            </div>
            {activePack && (
              <section aria-label={activePack.name}>
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div>
                    <h4 className="font-semibold text-sm text-white">{activePack.name}</h4>
                    <p className="text-xs text-gray-400">{activePack.description}</p>
                  </div>
                  <button type="button"
                    onClick={() => toggleInstall(activePack.id)}
                    aria-label={(installed.includes(activePack.id) ? 'Remove ' : 'Install ') + activePack.name}
                    className="flex shrink-0 items-center gap-1 rounded-lg border border-[#444444] bg-surface px-3 py-2 text-xs text-white focus-visible:ring-2 focus-visible:ring-emerald-500">
                    {installed.includes(activePack.id) ? <Check size={14} /> : <Plus size={14} />}
                    {installed.includes(activePack.id) ? 'Added' : 'Add'}
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-2" aria-label="Available stickers">
                  {activePack.stickers.filter(sticker => !term ||
                    activePack.name.toLowerCase().includes(term) ||
                    activePack.description.toLowerCase().includes(term) ||
                    sticker.label.toLowerCase().includes(term)
                  ).map(sticker => {
                    const asset = findSticker(activePack.id, sticker.id);
                    if (!asset) return null;
                    return (
                      <button key={sticker.id} type="button" aria-label={'Send ' + sticker.label}
                        onClick={() => onPick(activePack.id, sticker.id)}
                        className="flex aspect-square items-center justify-center rounded-xl bg-surface hover:bg-surfaceHighlight focus-visible:ring-2 focus-visible:ring-emerald-500">
                        <PackStickerImage sticker={asset} size="picker" />
                      </button>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}
        <p className="mt-4 text-[11px] text-gray-400">
          Art: <a href="https://github.com/jdecked/twemoji" target="_blank" rel="noopener noreferrer" className="underline">Twemoji contributors</a>
          {' · '}<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer" className="underline">CC BY 4.0</a>
          {' · '}Unmodified, delivered on demand. Packs saved on this device only.
        </p>
        </>
        )}
      </div>
    </BottomSheet>
  );
};
