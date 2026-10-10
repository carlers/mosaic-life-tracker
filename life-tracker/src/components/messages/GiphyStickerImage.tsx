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
  const [playOverride, setPlayOverride] = useState<boolean | null>(null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  useEffect(() => {
    setPlayOverride(null);
    setFailedSrc(null);
  }, [id]);

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
  const playing = playOverride ?? (autoplay && !reducedMotion);
  const src = image ? (playing ? image.animatedUrl : image.displayUrl) : null;
  return (
    <div ref={root} className="min-h-20 min-w-28">
      {image && src && failedSrc !== src ? (
        <button
          type="button"
          aria-label={(playing ? 'Pause' : 'Play') + ' animation: ' + label}
          aria-pressed={playing}
          onClick={event => { event.stopPropagation(); setPlayOverride(!playing); }}
          className="relative block max-w-36 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          <img src={src} alt={label} width={140} height={140}
            onLoad={() => sendGiphyAnalytics(image, 'onload')}
            onError={() => setFailedSrc(src)}
            loading="lazy" decoding="async" className="max-h-36 max-w-36 object-contain" />
          <span aria-hidden="true" className="absolute bottom-1 right-1 rounded-md bg-black/70 p-1 text-white">
            {playing ? <Pause size={13} /> : <Play size={13} />}
          </span>
        </button>
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
