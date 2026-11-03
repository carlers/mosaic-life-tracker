import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import {
  MOSAIC_PRODUCTION_ENDPOINT, MOSAIC_PRODUCTION_PROJECT_ID,
  MOSAIC_SCRATCH_ENDPOINT, MOSAIC_SCRATCH_PROJECT_ID,
  assertPreviewBackendIsolation, assertProductionBackendIsolation,
} from '../../scripts/lib/preview-backend-isolation.ts';
import { classifyAppwriteBackend } from '../../src/lib/appwriteBackendIdentity';

const prodId = '6ae9599c002ab812f9c3';
const prodEndpoint = 'https://129-221-244-67.sslip.io/v1';
const oldCloudId = '6a9703c50016b37110ff';
const oldCloudEndpoint = 'https://sgp.cloud.appwrite.io/v1';
const functionId = '6aa8057f002a4c306fdd';

describe('Oracle Production release candidate isolation (#975)', () => {
  it('pins Production to a distinct Oracle project, not old Cloud or Scratch', () => {
    expect(MOSAIC_PRODUCTION_PROJECT_ID).toBe(prodId);
    expect(MOSAIC_PRODUCTION_ENDPOINT).toBe(prodEndpoint);
    expect(MOSAIC_SCRATCH_PROJECT_ID).not.toBe(prodId);
    expect(MOSAIC_SCRATCH_ENDPOINT).toBe(prodEndpoint);
    expect(classifyAppwriteBackend(prodId, prodEndpoint)).toBe('production');
    expect(classifyAppwriteBackend(oldCloudId, oldCloudEndpoint)).toBe('custom');
    expect(classifyAppwriteBackend(MOSAIC_SCRATCH_PROJECT_ID, prodEndpoint)).toBe('scratch');
  });

  it('fails Production builds closed on old Cloud, Scratch or mismatched endpoints', () => {
    const production = { VERCEL_ENV: 'production', VITE_APPWRITE_PROJECT_ID: prodId,
      VITE_APPWRITE_ENDPOINT: prodEndpoint, VITE_APPWRITE_MESSAGE_ACTION_FUNCTION_ID: functionId };
    expect(assertProductionBackendIsolation(production)).toMatchObject({
      projectId: prodId, endpoint: prodEndpoint,
    });
    for (const rejected of [
      { VITE_APPWRITE_PROJECT_ID: oldCloudId, VITE_APPWRITE_ENDPOINT: oldCloudEndpoint },
      { VITE_APPWRITE_PROJECT_ID: MOSAIC_SCRATCH_PROJECT_ID },
      { VITE_APPWRITE_PROJECT_ID: oldCloudId },
      { VITE_APPWRITE_ENDPOINT: oldCloudEndpoint },
      { VITE_APPWRITE_MESSAGE_ACTION_FUNCTION_ID: 'wrong-function' },
    ]) expect(() => assertProductionBackendIsolation({ ...production, ...rejected }))
      .toThrow(/Refusing Mosaic Production build/);
    expect(() => assertPreviewBackendIsolation({ VERCEL_ENV: 'preview',
      VITE_APPWRITE_PROJECT_ID: prodId, VITE_APPWRITE_ENDPOINT: prodEndpoint,
      VITE_APPWRITE_MESSAGE_ACTION_FUNCTION_ID: functionId })).toThrow(/Refusing Mosaic Preview build/);
  });

  it('aligns CLI, official browser defaults and the exact main CI target', async () => {
    const config = JSON.parse(await readFile(new URL('../../appwrite.config.json', import.meta.url), 'utf8'));
    expect(config.projectId).toBe(prodId);
    expect(config.endpoint).toBe(prodEndpoint);
    const browser = await readFile(new URL('../../src/lib/appwriteConfig.ts', import.meta.url), 'utf8');
    expect(browser).toContain("'" + prodId + "'");
    expect(browser).toContain("'" + prodEndpoint + "'");
    const ci = await readFile(new URL('../../../.github/workflows/quality-gate.yml', import.meta.url), 'utf8');
    expect(ci).toContain("github.ref == 'refs/heads/main' && '" + prodId + "'");
    expect(ci).toContain("github.ref == 'refs/heads/main' && '" + prodEndpoint + "'");
  });
});
