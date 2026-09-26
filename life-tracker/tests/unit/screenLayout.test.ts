import { describe, expect, it, vi } from 'vitest';
import {
  applyScreenLayoutModes,
  cacheContentWidthMode,
  cacheSheetWidthMode,
  isContentWidthMode,
  isSheetWidthMode,
  readCachedContentWidthMode,
  readCachedSheetWidthMode,
} from '../../src/lib/screenLayout';

describe('screen layout preferences', () => {
  // Regression: §2 (layout preferences validate and hydrate from the local cache).
  it('validates and round-trips the two layout modes', () => {
    expect(isContentWidthMode('full')).toBe(true);
    expect(isContentWidthMode('comfortable')).toBe(true);
    expect(isContentWidthMode('wide')).toBe(true);
    expect(isContentWidthMode('unknown')).toBe(false);
    expect(isSheetWidthMode('full')).toBe(true);
    expect(isSheetWidthMode('compact')).toBe(true);
    expect(isSheetWidthMode('phone')).toBe(false);

    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: vi.fn((key: string, value: string) => values.set(key, value)),
    };

    cacheContentWidthMode('comfortable', storage);
    cacheSheetWidthMode('compact', storage);

    expect(readCachedContentWidthMode(storage)).toBe('comfortable');
    expect(readCachedSheetWidthMode(storage)).toBe('compact');
  });

  it('applies layout mode data to the root element', () => {
    const root = { dataset: {} } as unknown as HTMLElement;

    applyScreenLayoutModes('comfortable', 'compact', root);

    expect(root.dataset.contentWidthMode).toBe('comfortable');
    expect(root.dataset.sheetWidthMode).toBe('compact');
  });
});
