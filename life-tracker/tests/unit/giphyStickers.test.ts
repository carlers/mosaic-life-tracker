import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  giphyStickerMessage, giphyStickerSummary,
  parseGiphyStickerMessage, parseGiphySticker,
} from '../../src/lib/giphyStickers';

const validItem = {
  id: 'gAbC123', title: 'Happy Pusheen',
  url: 'https://giphy.com/gifs/sample-gAbC123',
  user: { username: 'animator' }, images: {
    fixed_width_small_still: { url: 'https://media1.giphy.com/media/gAbC123/100w_s.gif?cid=abc' },
    fixed_height_still: { url: 'https://media2.giphy.com/media/gAbC123/200_s.gif?cid=abc' },
    fixed_height: { webp: 'https://media2.giphy.com/media/gAbC123/200.webp?cid=abc' },
  },
  analytics: { onsent: { url: 'https://giphy-analytics.giphy.com/v2/pingback_simple?token=a' } },
};

describe('GIPHY provider message safety', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetModules(); });

  it('sends a readable reference with ID and sanitized label, never a URL', () => {
    const content = giphyStickerMessage({ id: 'gAbC123', label: '[Pusheen] 🐈\nHello' });
    expect(content).toBe('[Sticker: Pusheen 🐈 Hello]\n[gp1:gAbC123]');
    expect(parseGiphyStickerMessage(content)).toEqual({ id: 'gAbC123', label: 'Pusheen 🐈 Hello' });
    expect(giphyStickerSummary(content)).toBe('Sticker: Pusheen 🐈 Hello');
    expect(() => giphyStickerMessage({ id: 'https://evil.example/x', label: 'Bad' })).toThrow(/Invalid/);
    expect(parseGiphyStickerMessage('[Sticker: Gift]\n[gp1:http://evil]')).toBeNull();
    expect(parseGiphyStickerMessage('[Sticker: Gift]\n[gp1:gAbC123]\nhttp://evil')).toBeNull();
  });

  it('preserves only verified GIPHY media URLs and analytics hosts exactly', () => {
    const result = parseGiphySticker(validItem);
    expect(result).toMatchObject({
      id: 'gAbC123', label: 'Happy Pusheen',
      creator: 'animator', pageUrl: 'https://giphy.com/gifs/sample-gAbC123',
      previewUrl: 'https://media1.giphy.com/media/gAbC123/100w_s.gif?cid=abc',
      displayUrl: 'https://media2.giphy.com/media/gAbC123/200_s.gif?cid=abc',
      animatedUrl: 'https://media2.giphy.com/media/gAbC123/200.webp?cid=abc',
      analytics: { onsent: 'https://giphy-analytics.giphy.com/v2/pingback_simple?token=a' },
    });
    expect(parseGiphySticker({ ...validItem, images: {
      fixed_width_small_still: { url: 'https://evil.example/sticker.gif' },
      fixed_height_still: validItem.images.fixed_height_still,
      fixed_height: validItem.images.fixed_height,
    } })).toBeNull();
    expect(parseGiphySticker({ ...validItem, images: {
      fixed_width_small_still: { url: 'https://media.giphy.com.evil.example/x' },
      fixed_height_still: validItem.images.fixed_height_still,
      fixed_height: validItem.images.fixed_height,
    } })).toBeNull();
    expect(parseGiphySticker({ ...validItem, images: {
      fixed_width_small_still: { url: validItem.images.fixed_width_small_still.url },
      fixed_height_still: { url: 'https://evil.example/not-still.gif' },
      fixed_height: validItem.images.fixed_height,
    } })).toBeNull();
    // No static rendition: do not fetch an animated asset as the "still" fallback.
    expect(parseGiphySticker({ ...validItem, images: {
      fixed_height: validItem.images.fixed_height,
    } })).toBeNull();
    expect(parseGiphySticker({ ...validItem, id: 'invalid/id' })).toBeNull();
    expect(parseGiphySticker({ ...validItem, url: 'https://giphy.com.evil.example/sticker' })?.pageUrl).toBeUndefined();
  });

  it('calls provider search directly with exact search words, small result limit and no-store', async () => {
    vi.stubEnv('VITE_GIPHY_API_KEY', 'test_web_key');
    vi.resetModules();
    const { searchGiphyStickers } = await import('../../src/lib/giphyStickers');
    const fetcher = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ data: [validItem] }),
    });
    vi.stubGlobal('fetch', fetcher);
    const result = await searchGiphyStickers('Pusheen hugs');
    expect(result.map(item => item.id)).toEqual(['gAbC123']);
    const [rawUrl, init] = fetcher.mock.calls[0] as [string, RequestInit];
    const url = new URL(rawUrl);
    expect(url.origin).toBe('https://api.giphy.com');
    expect(url.pathname).toBe('/v1/stickers/search');
    expect(url.searchParams.get('q')).toBe('Pusheen hugs');
    expect(url.searchParams.get('rating')).toBe('g');
    expect(url.searchParams.get('limit')).toBe('16');
    expect(url.searchParams.get('api_key')).toBe('test_web_key');
    expect(init.cache).toBe('no-store');
  });

  it('resolves individual messages by ID without caching or uploading media', async () => {
    vi.stubEnv('VITE_GIPHY_API_KEY', 'test_web_key');
    vi.resetModules();
    const { getGiphySticker } = await import('../../src/lib/giphyStickers');
    const fetcher = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ data: validItem }),
    });
    vi.stubGlobal('fetch', fetcher);
    expect((await getGiphySticker('gAbC123'))?.id).toBe('gAbC123');
    expect(fetcher.mock.calls[0][0]).toContain('/v1/gifs/gAbC123?');
    expect(fetcher.mock.calls[0][1]).toMatchObject({ cache: 'no-store' });
    expect(await getGiphySticker('https://evil')).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
