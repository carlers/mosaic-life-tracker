import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import {
  MOSAIC_SCRATCH_ENDPOINT,
  MOSAIC_SCRATCH_PROJECT_ID,
  MOSAIC_E2EE_LAB_PROJECT_ID,
  MOSAIC_E2EE_LAB_VERCEL_PROJECT_ID,
  MOSAIC_E2EE_LAB_FUNCTION_ID,
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

  it('accepts the explicit Oracle Scratch backend', () => {
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
      { ...scratch, VITE_APPWRITE_PROJECT_ID: '6ae9599c002ab812f9c3' },
      { ...scratch, VITE_APPWRITE_PROJECT_ID: '6a9703c50016b37110ff' },
      { ...scratch, VITE_APPWRITE_ENDPOINT: 'https://sgp.cloud.appwrite.io/v1' },
      { ...scratch, VITE_APPWRITE_PROJECT_ID: '6a96e82d000d1310b3be' },
      { ...scratch, VITE_APPWRITE_ENDPOINT: 'https://fra.cloud.appwrite.io/v1' },
    ]) {
      expect(() => assertPreviewBackendIsolation(env)).toThrow(/Refusing Mosaic Preview build/);
    }
  });

  it('routes only the dedicated E2EE Preview Vercel project to isolated Scratch', () => {
    const lab = {
      VERCEL_ENV: 'preview',
      MOSAIC_E2EE_LAB_VERCEL_PROJECT_ID: MOSAIC_E2EE_LAB_VERCEL_PROJECT_ID,
      VERCEL_PROJECT_ID: MOSAIC_E2EE_LAB_VERCEL_PROJECT_ID,
      VERCEL_GIT_COMMIT_REF: 'chatgpt/1662-isolated-lab-bootstrap-20261120',
      VITE_APPWRITE_PROJECT_ID: MOSAIC_E2EE_LAB_PROJECT_ID,
      VITE_APPWRITE_ENDPOINT: MOSAIC_SCRATCH_ENDPOINT,
      VITE_APPWRITE_MESSAGE_ACTION_FUNCTION_ID: MOSAIC_E2EE_LAB_FUNCTION_ID,
    };
    expect(assertPreviewBackendIsolation(lab)).toEqual({
      projectId: MOSAIC_E2EE_LAB_PROJECT_ID, endpoint: MOSAIC_SCRATCH_ENDPOINT,
    });
    expect(assertPreviewBackendIsolation({
      ...lab, VERCEL_GIT_COMMIT_REF: 'chatgpt/1662-e2ee-lab-identity-fix-20261121',
    })).toEqual({ projectId: MOSAIC_E2EE_LAB_PROJECT_ID, endpoint: MOSAIC_SCRATCH_ENDPOINT });
    for (const attempt of [
      { VERCEL_PROJECT_ID: 'prj_wrong' },
      { MOSAIC_E2EE_LAB_VERCEL_PROJECT_ID: 'prj_wrong' },
      { VITE_APPWRITE_PROJECT_ID: MOSAIC_SCRATCH_PROJECT_ID },
      { VITE_APPWRITE_PROJECT_ID: MOSAIC_PRODUCTION_PROJECT_ID },
      { VITE_APPWRITE_ENDPOINT: 'https://example.com/v1' },
      { VITE_APPWRITE_MESSAGE_ACTION_FUNCTION_ID: MOSAIC_PRODUCTION_FUNCTION_ID },
      { VERCEL_GIT_COMMIT_REF: 'main' },
      { VERCEL_GIT_COMMIT_REF: 'dev' },
      { VERCEL_GIT_COMMIT_REF: '' },
      { VERCEL_GIT_COMMIT_REF: 'unreviewed-feature-branch' },
    ]) {
      expect(() => assertPreviewBackendIsolation({ ...lab, ...attempt }))
        .toThrow(/Refusing Mosaic E2EE Lab Preview build/);
    }
    expect(() => assertProductionBackendIsolation({
      ...lab, VERCEL_ENV: 'production',
    })).toThrow(/Refusing Mosaic Production build/);
    expect(() => assertPreviewBackendIsolation({
      ...lab, MOSAIC_E2EE_LAB_VERCEL_PROJECT_ID: '',
    })).toThrow(/Refusing Mosaic Preview build/);
  });

  it('enforces the distinct production project, HTTPS endpoint and Function when building official main', () => {
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
      { ...production, VITE_APPWRITE_PROJECT_ID: '6a9703c50016b37110ff' },
      { ...production, VITE_APPWRITE_ENDPOINT: 'https://sgp.cloud.appwrite.io/v1' },
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
    // This also covers an independent E2EE Vercel project without a
    // GITHUB_REPOSITORY variable. Its Production build must fail closed.
    expect(vite).toContain(
      'process.env.VERCEL_PROJECT_ID === MOSAIC_E2EE_LAB_VERCEL_PROJECT_ID'
    );
    expect(vite).toContain('assertProductionBackendIsolation(process.env)');
  });
});
