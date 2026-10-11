import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STICKER_PACKS,
  findSticker,
  packStickerMessage,
  packStickerSummary,
  parsePackStickerMessage,
  readInstalledPacks,
  saveInstalledPacks,
} from '../../src/lib/stickerPacks';

describe('curated sticker pack transport', () => {
  it('keeps old-client text readable and resolves exactly one approved asset', () => {
    const content = packStickerMessage('reactions', 'love');
    expect(content).toBe('[Sticker: Sending love]\n[mp1:reactions:love:1]');
    expect(packStickerSummary(content)).toBe('Sticker: Sending love');
    expect(parsePackStickerMessage(content)).toEqual(findSticker('reactions', 'love'));
  });

  it('fails closed for forged labels, unknown packs, unknown versions and URL payloads', () => {
    for (const content of [
      '[Sticker: False label]\n[mp1:reactions:love:1]',
      '[Sticker: Sending love]\n[mp1:reactions:love:2]',
      '[Sticker: Sending love]\n[mp1:unknown:love:1]',
      '[Sticker: Sending love]\n[mp1:reactions:https://evil.example:1]',
      '[Sticker: Sending love]\n[mp1:reactions:unknown:1]',
    ]) {
      expect(parsePackStickerMessage(content)).toBeNull();
      expect(packStickerSummary(content)).toBe(content);
    }
    expect(() => packStickerMessage('external', 'https://example.com')).toThrow(/Unrecognized/);
  });

  it('only emits images from a pinned allowed origin, not user-supplied links', () => {
    for (const pack of STICKER_PACKS) {
      for (const item of pack.stickers) {
        const asset = parsePackStickerMessage(packStickerMessage(pack.id, item.id));
        expect(asset?.url).toMatch(
          /^https:\/\/cdn\.jsdelivr\.net\/gh\/jdecked\/twemoji@17\.0\.2\/assets\/svg\/[0-9a-f]+\.svg$/
        );
      }
    }
  });
});

describe('device-local installed pack bookmarks', () => {
  const saved = new Map<string, string>();
  beforeEach(() => {
    saved.clear();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => saved.get(key) ?? null,
      setItem: (key: string, value: string) => { saved.set(key, value); },
    });
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('stores only allowlisted unique pack IDs and isolates accounts', () => {
    expect(readInstalledPacks('owner-a')).toEqual(['reactions']);
    saveInstalledPacks('owner-a', ['critters', 'critters', 'evil', 'vibes']);
    expect(readInstalledPacks('owner-a')).toEqual(['vibes', 'critters']);
    expect(readInstalledPacks('owner-b')).toEqual(['reactions']);
    expect(readInstalledPacks('')).toEqual([]);
  });

  it('handles corrupt or blocked browser storage without leaking another user preference', () => {
    saved.set('mosaic_installed_sticker_packs_v1:owner-a', 'not-json');
    expect(readInstalledPacks('owner-a')).toEqual(['reactions']);
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('disabled'); },
      setItem: () => { throw new Error('disabled'); },
    });
    expect(readInstalledPacks('owner-a')).toEqual(['reactions']);
    expect(() => saveInstalledPacks('owner-a', ['reactions'])).not.toThrow();
  });
});
