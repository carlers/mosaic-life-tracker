import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause } from 'lucide-react';
import { getGiphySticker, giphyEnabled, sendGiphyAnalytics } from '../../lib/giphyStickers';

interface Props {
  id: string;
  label: string;
  autoplay?: boolean;
  reducedMotion?: boolean;
}
type AssetState = { id: string; image?: Awaited<ReturnType<typeof getGiphySticker>>; failed?: boolean };

/** A static sticker until the user opts into animation. Never stores provider URLs. */
export const GiphyStickerImage: React.FC<Props> = ({
  id, label, autoplay = false, reducedMotion = false,
}) => {
  const root = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === 'undefined');
  const [state, setState] = useState<AssetState | null>(null);
  // Key local playback/error state by sticker ID without a reset effect.
  const [playOverride, setPlayOverride] = useState<{ id: string; playing: boolean } | null>(null);
  const [failedAsset, setFailedAsset] = useState<{ id: string; url: string } | null>(null);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const target = root.current;
    if (!target) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: '200px' });
    observer.observe(target);
    return () => observer.disconnect();
  }, [id]);

  useEffect(() => {
    if (!visible || !giphyEnabled) return;
    const controller = new AbortController();
    void getGiphySticker(id, controller.signal).then(
      image => { if (!controller.signal.aborted) setState({ id, image, failed: !image }); },
      () => { if (!controller.signal.aborted) setState({ id, failed: true }); }
    );
    return () => controller.abort();
  }, [id, visible]);

  const image = state?.id === id ? state.image : null;
  // Reduce Motion always suppresses automatic playback, but does not prevent
  // an explicit user tap from playing a sticker.
  const playing = playOverride?.id === id
    ? playOverride.playing : autoplay && !reducedMotion;
  const src = image ? (playing ? image.animatedUrl : image.displayUrl) : null;
  const failedSrc = failedAsset?.id === id ? failedAsset.url : null;
  return (
    <div ref={root} className="min-h-20 min-w-28">
      {image && src && failedSrc !== src ? (
        <div className="relative inline-block max-w-36">
          <img src={src} alt={label} width={140} height={140}
            onLoad={() => sendGiphyAnalytics(image, 'onload')}
            onError={() => setFailedAsset({ id, url: src })}
            loading="lazy" decoding="async" className="max-h-36 max-w-36 object-contain" />
          {/* The message bubble captures swipe pointers. Reserve the small playback
              control; the image stays swipeable for reply gestures. */}
          <button
            type="button"
            aria-label={(playing ? 'Pause' : 'Play') + ' animation: ' + label}
            aria-pressed={playing}
            onPointerDown={event => event.stopPropagation()}
            onKeyDown={event => event.stopPropagation()}
            onClick={event => { event.stopPropagation(); setPlayOverride({ id, playing: !playing }); }}
            className="absolute bottom-1 right-1 flex h-9 w-9 touch-manipulation items-center justify-center rounded-full bg-black/75 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            {playing ? <Pause size={16} /> : <Play size={16} />}
          </button>
        </div>
      ) : (
        <span role="status" className="block max-w-36 py-3 text-xs text-gray-400">
          {!giphyEnabled || state?.id === id && state.failed || failedSrc === src
            ? 'GIPHY sticker unavailable: ' + label
            : 'Loading sticker: ' + label}
        </span>
      )}
      <a href={image?.pageUrl ?? "https://giphy.com"} target="_blank" rel="noopener noreferrer"
        className="mt-1 inline-block rounded bg-black px-1.5 py-0.5 text-[10px] font-bold text-white">
        Powered by GIPHY{image?.creator ? ' · @' + image.creator : ''}
      </a>
    </div>
  );
};
