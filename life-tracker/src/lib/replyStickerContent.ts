import { parseGiphyStickerMessage } from './giphyStickers';
import { parsePackStickerMessage } from './stickerPacks';

/**
 * Reply snapshots must be displayable after the original message leaves the
 * viewport or another device loads the conversation. Only exact validated
 * sticker wires qualify; never treat an arbitrary quote as an image URL.
 *
 * Older outgoing messages collapsed the required newline to a space. Accept
 * that legacy form in quotes only, without weakening normal message parsing.
 */
export function canonicalReplyStickerContent(content: string): string | null {
  if (parsePackStickerMessage(content) || parseGiphyStickerMessage(content)) {
    return content;
  }
  if (!content.includes('] [') || content.includes('\n')) return null;
  const candidate = content.replace('] [', ']\n[');
  return parsePackStickerMessage(candidate) || parseGiphyStickerMessage(candidate)
    ? candidate
    : null;
}
