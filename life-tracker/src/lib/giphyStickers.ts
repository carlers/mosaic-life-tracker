/**
 * Optional GIPHY Web API integration. GIPHY media is never stored, rewritten,
 * proxied, cached by Mosaic, or inserted into its own pack catalog.
 * https://developers.giphy.com/docs/api/
 */
const KEY = import.meta.env.VITE_GIPHY_API_KEY?.trim() || '';
const GIF_ID = /^[a-zA-Z0-9_-]{1,64}$/;
const WIRE = /^\[Sticker: ([^\]\r\n]{1,40})\]\n\[gp1:([a-zA-Z0-9_-]{1,64})\]$/;

export const giphyEnabled = KEY.length > 0;

export interface GiphyStickerReference { id: string; label: string }
export interface GiphySticker extends GiphyStickerReference {
  previewUrl: string;
  displayUrl: string;
  analytics: { onload?: string; onclick?: string; onsent?: string };
}

function safeGiphyUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  try {
    const url = new URL(raw);
    // Check the source, but use exactly the provider-supplied URL string.
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.giphy.com')) return null;
    return raw;
  } catch {
    return null;
  }
}

function safeAnalyticsUrl(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && url.hostname === 'giphy-analytics.giphy.com'
      ? raw : undefined;
  } catch {
    return undefined;
  }
}

export function parseGiphySticker(item: unknown): GiphySticker | null {
  if (!item || typeof item !== 'object') return null;
  const obj = item as Record<string, unknown>;
  if (typeof obj.id !== 'string' || !GIF_ID.test(obj.id)) return null;
  const images = obj.images as Record<string, Record<string, unknown>> | undefined;
  const previewUrl = safeGiphyUrl(images?.fixed_width?.webp ?? images?.fixed_height?.webp);
  const displayUrl = safeGiphyUrl(images?.fixed_height?.webp ?? images?.original?.webp);
  if (!previewUrl || !displayUrl) return null;
  const sourceAnalytics = obj.analytics as Record<string, { url?: unknown }> | undefined;
  const label = giphyStickerLabel(typeof obj.title === 'string' ? obj.title : 'GIPHY sticker');
  return {
    id: obj.id,
    label,
    previewUrl,
    displayUrl,
    analytics: {
      onload: safeAnalyticsUrl(sourceAnalytics?.onload?.url),
      onclick: safeAnalyticsUrl(sourceAnalytics?.onclick?.url),
      onsent: safeAnalyticsUrl(sourceAnalytics?.onsent?.url),
    },
  };
}

export function giphyStickerLabel(raw: string): string {
  return raw.replace(/[\r\n<>\[\]]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40) || 'GIPHY sticker';
}

export function giphyStickerMessage(item: GiphyStickerReference): string {
  if (!GIF_ID.test(item.id)) throw new Error('Invalid GIPHY ID');
  return '[Sticker: ' + giphyStickerLabel(item.label) + ']\n[gp1:' + item.id + ']';
}

export function parseGiphyStickerMessage(content: string): GiphyStickerReference | null {
  const match = WIRE.exec(content);
  return match ? { label: match[1], id: match[2] } : null;
}

export function giphyStickerSummary(content: string): string {
  const ref = parseGiphyStickerMessage(content);
  return ref ? 'Sticker: ' + ref.label : content;
}

async function request(url: URL, signal?: AbortSignal): Promise<unknown> {
  if (!giphyEnabled) throw new Error('GIPHY is not configured');
  url.searchParams.set('api_key', KEY);
  url.searchParams.set('rating', 'g');
  const response = await fetch(url.toString(), { cache: 'no-store', signal });
  if (!response.ok) throw new Error(response.status === 429
    ? 'GIPHY search limit reached. Try again later.'
    : 'GIPHY is unavailable. Try again later.');
  return response.json();
}

export async function searchGiphyStickers(query: string, signal?: AbortSignal): Promise<GiphySticker[]> {
  if (query.trim().length < 2) return [];
  const url = new URL('https://api.giphy.com/v1/stickers/search');
  // Respect the user's search words without silently adding "sticker" or other terms.
  url.searchParams.set('q', query.slice(0, 50));
  url.searchParams.set('limit', '16');
  const response = await request(url, signal) as { data?: unknown };
  if (!Array.isArray(response.data)) throw new Error('Unexpected GIPHY response');
  // Preserve the returned ranking. Invalid media receives no external URL.
  return response.data.map(parseGiphySticker).filter((item): item is GiphySticker => item !== null);
}

export async function getGiphySticker(id: string, signal?: AbortSignal): Promise<GiphySticker | null> {
  if (!GIF_ID.test(id)) return null;
  const url = new URL('https://api.giphy.com/v1/gifs/' + encodeURIComponent(id));
  const response = await request(url, signal) as { data?: unknown };
  return parseGiphySticker(response.data);
}

let ephemeralCustomerId: string | null = null;
export function sendGiphyAnalytics(item: GiphySticker, action: keyof GiphySticker['analytics']): void {
  const raw = item.analytics[action];
  const safe = safeAnalyticsUrl(raw);
  if (!safe) return;
  // Never send Mosaic account identity or persist an analytics identifier.
  ephemeralCustomerId ??= crypto.randomUUID();
  const url = new URL(safe);
  url.searchParams.set('customer_id', ephemeralCustomerId);
  url.searchParams.set('ts', String(Date.now()));
  void fetch(url.toString(), { cache: 'no-store', keepalive: true }).catch(() => {});
}
