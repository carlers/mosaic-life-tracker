/** Wire-compatible text envelope: legacy clients display a readable [Sticker: label]. */
export const STICKER_SETTINGS_KEY = 'chat_stickers_v1';
export const MAX_STICKERS = 32;
export const STICKER_FILE_ID = /^stk_[0-9a-f]{32}$/;
export interface SavedSticker { fileId: string; label: string }

export function stickerLabel(label: string): string {
  return label.replace(/[\r\n<>]/g, ' ').replaceAll('[', ' ').replaceAll(']', ' ').replace(/\s+/g, ' ').trim().slice(0, 40) || 'Sticker';
}

export function stickerMessage(sticker: SavedSticker): string {
  if (!STICKER_FILE_ID.test(sticker.fileId)) throw new Error('Invalid sticker ID');
  return '[Sticker: ' + stickerLabel(sticker.label) + ']\n[ms1:' + sticker.fileId + ']';
}

export function parseStickerMessage(content: string): SavedSticker | null {
  const match = /^\[Sticker: ([^\]\r\n]{1,40})\]\n\[ms1:(stk_[0-9a-f]{32})\]$/.exec(content);
  return match ? { label: match[1], fileId: match[2] } : null;
}

export function stickerSummary(content: string): string {
  const sticker = parseStickerMessage(content);
  return sticker ? 'Sticker: ' + sticker.label : content;
}

export function normalizeStickers(raw: unknown): SavedSticker[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const entries: SavedSticker[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const fileId = (item as SavedSticker).fileId;
    const label = (item as SavedSticker).label;
    if (typeof fileId !== 'string' || !STICKER_FILE_ID.test(fileId) || seen.has(fileId)) continue;
    if (typeof label !== 'string' || label.length > 100) continue;
    seen.add(fileId);
    entries.push({ fileId, label: stickerLabel(label) });
    if (entries.length === MAX_STICKERS) break;
  }
  return entries;
}
