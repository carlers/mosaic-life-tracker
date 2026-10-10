/**
 * Curated, rights-cleared sticker references, never user-authored URLs.
 * Twemoji graphics © Twitter, Inc. and contributors, CC BY 4.0.
 * Source: https://github.com/jdecked/twemoji
 * License: https://creativecommons.org/licenses/by/4.0/
 * Unmodified transparent SVGs are requested only from the pinned jsDelivr release.
 * No artwork is included in JS, Appwrite Storage, or the PWA install precache.
 */
const TWEMOJI_CDN = 'https://cdn.jsdelivr.net/gh/jdecked/twemoji@17.0.2/assets/svg/';
const PREFS_PREFIX = 'mosaic_installed_sticker_packs_v1:';
const WIRE = /^\[Sticker: ([^\]\r\n]{1,40})\]\n\[mp1:([a-z0-9_]{1,24}):([a-z0-9_]{1,24}):1\]$/;

export interface PackSticker {
  id: string;
  label: string;
  codepoint: string;
}
export interface StickerPack {
  id: string;
  name: string;
  description: string;
  stickers: readonly PackSticker[];
}

export const STICKER_PACKS: readonly StickerPack[] = [
  {
    id: 'reactions',
    name: 'Reactions',
    description: 'Say it without typing',
    stickers: [
      { id: 'love', label: 'Sending love', codepoint: '1f970' },
      { id: 'happytears', label: 'Happy tears', codepoint: '1f979' },
      { id: 'laugh', label: 'Laughing', codepoint: '1f923' },
      { id: 'heart_eyes', label: 'Heart eyes', codepoint: '1f60d' },
      { id: 'thinking', label: 'Thinking', codepoint: '1f914' },
      { id: 'crying', label: 'Crying', codepoint: '1f62d' },
      { id: 'thumbs_up', label: 'Nice!', codepoint: '1f44d' },
      { id: 'thanks', label: 'Thank you', codepoint: '1f64f' },
    ],
  },
  {
    id: 'vibes',
    name: 'Little Vibes',
    description: 'Everyday moods and moments',
    stickers: [
      { id: 'party', label: 'Celebrate', codepoint: '1f389' },
      { id: 'rocket', label: 'Lets go', codepoint: '1f680' },
      { id: 'letter', label: 'Love letter', codepoint: '1f48c' },
      { id: 'star', label: 'Shining star', codepoint: '1f31f' },
      { id: 'sleep', label: 'Sleepy', codepoint: '1f4a4' },
      { id: 'fire', label: 'On fire', codepoint: '1f525' },
      { id: 'rainbow', label: 'Rainbow', codepoint: '1f308' },
      { id: 'lucky', label: 'Lucky', codepoint: '1f340' },
    ],
  },
  {
    id: 'critters',
    name: 'Little Critters',
    description: 'Animals for any reaction',
    stickers: [
      { id: 'cat', label: 'Kitty', codepoint: '1f431' },
      { id: 'dog', label: 'Puppy', codepoint: '1f436' },
      { id: 'panda', label: 'Panda', codepoint: '1f43c' },
      { id: 'fox', label: 'Fox', codepoint: '1f98a' },
      { id: 'penguin', label: 'Penguin', codepoint: '1f427' },
      { id: 'frog', label: 'Frog', codepoint: '1f438' },
      { id: 'bunny', label: 'Bunny', codepoint: '1f430' },
      { id: 'bear', label: 'Bear', codepoint: '1f43b' },
    ],
  },
];

export interface ResolvedPackSticker extends PackSticker {
  packId: string;
  url: string;
}

export function findSticker(packId: string, stickerId: string): ResolvedPackSticker | null {
  const pack = STICKER_PACKS.find(candidate => candidate.id === packId);
  const sticker = pack?.stickers.find(candidate => candidate.id === stickerId);
  if (!sticker || !/^[0-9a-f]{4,6}$/.test(sticker.codepoint)) return null;
  return { ...sticker, packId, url: TWEMOJI_CDN + sticker.codepoint + '.svg' };
}

/** A readable old-client fallback plus one compact, explicitly versioned reference. */
export function packStickerMessage(packId: string, stickerId: string): string {
  const sticker = findSticker(packId, stickerId);
  if (!sticker) throw new Error('Unrecognized sticker');
  return '[Sticker: ' + sticker.label + ']\n[mp1:' + packId + ':' + stickerId + ':1]';
}

export function parsePackStickerMessage(content: string): ResolvedPackSticker | null {
  const match = WIRE.exec(content);
  if (!match) return null;
  const sticker = findSticker(match[2], match[3]);
  return sticker?.label === match[1] ? sticker : null;
}

export function packStickerSummary(content: string): string {
  const sticker = parsePackStickerMessage(content);
  return sticker ? 'Sticker: ' + sticker.label : content;
}

/** Installed packs are lightweight UI bookmarks, scoped to the logged-in browser account. */
export function readInstalledPacks(ownerId: string): string[] {
  if (!ownerId) return [];
  try {
    const raw = localStorage.getItem(PREFS_PREFIX + ownerId);
    if (raw === null) return ['reactions'];
    const ids: unknown = JSON.parse(raw);
    if (!Array.isArray(ids)) return ['reactions'];
    const unique = new Set(ids.filter((id): id is string => typeof id === 'string'));
    return STICKER_PACKS.filter(pack => unique.has(pack.id)).map(pack => pack.id);
  } catch {
    return ['reactions'];
  }
}

export function saveInstalledPacks(ownerId: string, ids: readonly string[]): void {
  if (!ownerId) return;
  const accepted = new Set(ids);
  const safe = STICKER_PACKS.filter(pack => accepted.has(pack.id)).map(pack => pack.id);
  try {
    localStorage.setItem(PREFS_PREFIX + ownerId, JSON.stringify(safe));
  } catch {
    // Storage may be unavailable in private mode; the current view still works.
  }
}
