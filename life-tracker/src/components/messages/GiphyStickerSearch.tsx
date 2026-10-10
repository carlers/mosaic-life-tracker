import React, { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import {
  giphyEnabled,
  searchGiphyStickers,
  sendGiphyAnalytics,
  type GiphySticker,
} from '../../lib/giphyStickers';

interface Props { onPick: (sticker: GiphySticker) => void }
type SearchState = { query: string; results: GiphySticker[]; error?: string };

export const GiphyStickerSearch: React.FC<Props> = ({ onPick }) => {
  const [query, setQuery] = useState('');
  const [state, setState] = useState<SearchState>({ query: '', results: [] });
  const trimmed = query.trim();

  useEffect(() => {
    if (!giphyEnabled || trimmed.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void searchGiphyStickers(query, controller.signal).then(
        results => setState({ query, results }),
        (err: unknown) => {
          if (!controller.signal.aborted) {
            setState({ query, results: [], error: err instanceof Error ? err.message : 'Search failed' });
          }
        }
      );
    }, 450);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, trimmed]);

  return (
    <div className="pt-3 pb-4">
      {!giphyEnabled ? (
        <div className="py-5 text-sm text-gray-400">
          <p>GIPHY search needs a Web API key before it can be used in this Preview.</p>
          <p className="mt-2">The app owner can create a beta key in the{' '}
            <a className="underline" href="https://developers.giphy.com/dashboard/" target="_blank" rel="noopener noreferrer">GIPHY Developer Dashboard</a>
            {' '}and configure <code>VITE_GIPHY_API_KEY</code> for the Preview deployment.
          </p>
        </div>
      ) : (
        <>
          <label className="flex items-center gap-2 rounded-xl border border-[#444444] bg-surface px-3 py-2 text-gray-400">
            <Search size={16} aria-hidden="true" />
            <input aria-label="Search GIPHY stickers" value={query}
              maxLength={50} onChange={event => setQuery(event.target.value)}
              placeholder="Search GIPHY stickers"
              className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-gray-400" />
          </label>
          {trimmed.length < 2 ? (
            <p className="py-7 text-center text-sm text-gray-400">Type two or more characters to search stickers.</p>
          ) : state.query !== query ? (
            <p role="status" className="py-7 text-center text-sm text-gray-400">Searching GIPHY…</p>
          ) : state.error ? (
            <p role="alert" className="py-7 text-center text-sm text-gray-400">{state.error}</p>
          ) : state.results.length === 0 ? (
            <p role="status" className="py-7 text-center text-sm text-gray-400">No stickers found.</p>
          ) : (
            <div className="grid grid-cols-4 gap-2 pt-3" aria-label="GIPHY sticker search results">
              {state.results.map(sticker => (
                <button key={sticker.id} type="button"
                  aria-label={'Send GIPHY sticker ' + sticker.label}
                  className="flex aspect-square items-center justify-center rounded-xl bg-surface focus-visible:ring-2 focus-visible:ring-emerald-500"
                  onClick={() => { sendGiphyAnalytics(sticker, 'onclick'); onPick(sticker); }}>
                  <img src={sticker.previewUrl} alt={sticker.label} loading="lazy" decoding="async"
                    onLoad={() => sendGiphyAnalytics(sticker, 'onload')}
                    className="h-16 w-16 object-contain" />
                </button>
              ))}
            </div>
          )}
        </>
      )}
      <a href="https://giphy.com" target="_blank" rel="noopener noreferrer"
        className="mt-3 inline-block rounded bg-black px-2 py-1 text-xs font-bold tracking-wide text-white"
        aria-label="Powered by GIPHY">
        Powered by GIPHY
      </a>
      <p className="mt-2 text-[11px] text-gray-400">
        GIPHY media loads directly from its service, not Mosaic storage. Unavailable stickers cannot be restored offline.
      </p>
    </div>
  );
};
