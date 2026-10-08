import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import {
  MOSAIC_SCRATCH_ENDPOINT,
  MOSAIC_SCRATCH_PROJECT_ID,
  MOSAIC_PRODUCTION_ENDPOINT,
  MOSAIC_PRODUCTION_PROJECT_ID,
  MOSAIC_PRODUCTION_FUNCTION_ID,
  assertPreviewBackendIsolation,
  assertProductionBackendIsolation,
} from '../../scripts/lib/preview-backend-isolation.ts';

describe('Vercel Preview Appwrite isolation', () => {
  const scratch = {
    VERCEL_ENV: 'preview',
    VITE_APPWRITE_PROJECT_ID: MOSAIC_SCRATCH_PROJECT_ID,
    VITE_APPWRITE_ENDPOINT: MOSAIC_SCRATCH_ENDPOINT,
    VITE_APPWRITE_MESSAGE_ACTION_FUNCTION_ID: 'scratch-message-action',
  };

  it('accepts the explicit, region-matched scratch backend', () => {
    expect(assertPreviewBackendIsolation(scratch)).toEqual({
      projectId: MOSAIC_SCRATCH_PROJECT_ID,
      endpoint: MOSAIC_SCRATCH_ENDPOINT,
    });
  });

  it('refuses missing preview overrides and the production fallback', () => {
    for (const env of [
      { VERCEL_ENV: 'preview' },
      { ...scratch, VITE_APPWRITE_PROJECT_ID: '' },
      { ...scratch, VITE_APPWRITE_ENDPOINT: '' },
      { ...scratch, VITE_APPWRITE_MESSAGE_ACTION_FUNCTION_ID: '' },
      { ...scratch, VITE_APPWRITE_PROJECT_ID: '6a9703c50016b37110ff' },
      { ...scratch, VITE_APPWRITE_ENDPOINT: 'https://sgp.cloud.appwrite.io/v1' },
    ]) {
      expect(() => assertPreviewBackendIsolation(env)).toThrow(/Refusing Mosaic Preview build/);
    }
  });

  it('enforces the production project, region and Function when building official main', () => {
    const production = {
      VERCEL_ENV: 'production',
      VITE_APPWRITE_PROJECT_ID: MOSAIC_PRODUCTION_PROJECT_ID,
      VITE_APPWRITE_ENDPOINT: MOSAIC_PRODUCTION_ENDPOINT,
      VITE_APPWRITE_MESSAGE_ACTION_FUNCTION_ID: MOSAIC_PRODUCTION_FUNCTION_ID,
    };
    expect(assertProductionBackendIsolation(production)).toEqual({
      projectId: MOSAIC_PRODUCTION_PROJECT_ID,
      endpoint: MOSAIC_PRODUCTION_ENDPOINT,
      functionId: MOSAIC_PRODUCTION_FUNCTION_ID,
    });
    expect(assertProductionBackendIsolation({ VERCEL_ENV: 'production' })).toEqual({
      projectId: MOSAIC_PRODUCTION_PROJECT_ID,
      endpoint: MOSAIC_PRODUCTION_ENDPOINT,
      functionId: MOSAIC_PRODUCTION_FUNCTION_ID,
    });
    for (const env of [
      { ...production, VITE_APPWRITE_PROJECT_ID: MOSAIC_SCRATCH_PROJECT_ID },
      { ...production, VITE_APPWRITE_ENDPOINT: MOSAIC_SCRATCH_ENDPOINT },
      { ...production, VITE_APPWRITE_MESSAGE_ACTION_FUNCTION_ID: 'wrong-function' },
    ]) {
      expect(() => assertProductionBackendIsolation(env)).toThrow(/Refusing Mosaic Production build/);
    }
  });

  it('leaves local builds and production unchanged', () => {
    expect(assertPreviewBackendIsolation({ VERCEL_ENV: 'production' })).toBeNull();
    expect(assertPreviewBackendIsolation({})).toBeNull();
  });

  it('keeps the isolation assertion in the actual Vite build path', async () => {
    const vite = await readFile(new URL('../../vite.config.ts', import.meta.url), 'utf8');
    expect(vite).toContain('assertPreviewBackendIsolation(process.env)');
  });
});
