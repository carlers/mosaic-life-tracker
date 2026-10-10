import React, { useEffect, useRef, useState } from 'react';
import { getGiphySticker, giphyEnabled, sendGiphyAnalytics } from '../../lib/giphyStickers';

interface Props { id: string; label: string }
type AssetState = { id: string; image?: Awaited<ReturnType<typeof getGiphySticker>>; failed?: boolean };

export const GiphyStickerImage: React.FC<Props> = ({ id, label }) => {
  const root = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === 'undefined');
  const [state, setState] = useState<AssetState | null>(null);

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
  return (
    <div ref={root} className="min-h-20 min-w-28">
      {image ? (
        <img src={image.displayUrl} alt={label} width={140} height={140}
          onLoad={() => sendGiphyAnalytics(image, 'onload')}
          loading="lazy" decoding="async" className="max-h-36 max-w-36 object-contain" />
      ) : (
        <span role="status" className="block max-w-36 py-3 text-xs text-gray-400">
          {!giphyEnabled || state?.id === id && state.failed
            ? 'GIPHY sticker unavailable: ' + label
            : 'Loading sticker: ' + label}
        </span>
      )}
      <a href="https://giphy.com" target="_blank" rel="noopener noreferrer"
        className="mt-1 inline-block rounded bg-black px-1.5 py-0.5 text-[10px] font-bold text-white">
        Powered by GIPHY
      </a>
    </div>
  );
};
