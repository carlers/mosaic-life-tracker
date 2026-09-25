import { describe, expect, it } from 'vitest';
import { isChunkLoadError } from '../../src/lib/chunkLoadErrors';

describe('chunk-load error classification', () => {
  it.each([
    'Failed to fetch dynamically imported module: /assets/HomePage.js',
    'error loading dynamically imported module',
    'Importing a module script failed',
    'Unable to preload CSS for /assets/HomePage.css',
    'Load failed',
  ])('recognizes a browser/bundler load failure: %s', (message) => {
    expect(isChunkLoadError(new Error(message))).toBe(true);
  });

  it('leaves ordinary application errors on the in-place retry path', () => {
    expect(isChunkLoadError(new Error('Database initialization failed'))).toBe(false);
  });
});
