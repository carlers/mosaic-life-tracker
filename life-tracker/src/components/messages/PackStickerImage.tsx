import React, { useState } from 'react';
import type { ResolvedPackSticker } from '../../lib/stickerPacks';

interface PackStickerImageProps {
  sticker: ResolvedPackSticker;
  size?: 'chat' | 'picker';
}

/** A failed or withdrawn asset does not become a broken image or an arbitrary URL. */
export const PackStickerImage: React.FC<PackStickerImageProps> = ({ sticker, size = 'chat' }) => {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <span className="text-xs text-gray-400" role="img" aria-label={'Sticker unavailable: ' + sticker.label}>
      Sticker unavailable
    </span>;
  }

  return (
    <img
      src={sticker.url}
      alt={sticker.label}
      width={size === 'chat' ? 112 : 64}
      height={size === 'chat' ? 112 : 64}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={size === 'chat'
        ? 'block h-28 w-28 object-contain'
        : 'block h-16 w-16 object-contain'}
    />
  );
};
