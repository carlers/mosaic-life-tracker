import { describe, it, expect } from 'vitest';
import { assessPublicPreviewBuild } from '../../scripts/lib/preview-public-profile.mjs';

const sha = 'a'.repeat(40);
const canary = 'fix/592-trusted-archive-20261014';
const preview = {
  GITHUB_REF: 'refs/heads/' + canary,
  GITHUB_SHA: sha,
  VERCEL_GIT_COMMIT_SHA: sha,
  VERCEL_GIT_COMMIT_REF: canary,
  VERCEL_ENV: 'preview',
  VITE_APPWRITE_PROJECT_ID: '6a96e82d000d1310b3be',
  VITE_APPWRITE_ENDPOINT: 'https://fra.cloud.appwrite.io/v1',
  VITE_APPWRITE_MESSAGE_ACTION_FUNCTION_ID: '6aa8057f002a4c306fdd',
  VITE_GIPHY_API_KEY: 'public-stickers-key',
  VITE_POSTHOG_TOKEN: 'public-analytics-token',
  VITE_POSTHOG_HOST: 'https://us.i.posthog.com',
};

describe('Preview CI public-profile admission (#592)', () => {
  it('accepts the canary with explicit Scratch and browser-public features', () => {
    expect(assessPublicPreviewBuild(preview)).toEqual({
      eligible: true, mandatory: true, reasons: [], preview: true,
      giphy: 'enabled', posthog: 'enabled',
    });
  });
  it('rejects missing GIPHY and PostHog only for the canary (not routine feature development)', () => {
    const missing = { ...preview, VITE_GIPHY_API_KEY: '', VITE_POSTHOG_TOKEN: '' };
    expect(assessPublicPreviewBuild(missing)).toMatchObject({ eligible: false, mandatory: true });
    const noncanary = { ...missing, GITHUB_REF: 'refs/heads/fix/unrelated',
      VERCEL_GIT_COMMIT_REF: 'fix/unrelated' };
    expect(assessPublicPreviewBuild(noncanary)).toMatchObject({
      eligible: true, mandatory: false, giphy: 'disabled', posthog: 'disabled',
    });
  });
  it('rejects a Production Appwrite identity or missing source binding on canary', () => {
    for (const changed of [
      { VITE_APPWRITE_PROJECT_ID: '6a9703c50016b37110ff' },
      { VITE_APPWRITE_ENDPOINT: 'https://sgp.cloud.appwrite.io/v1' },
      { VERCEL_ENV: 'production' },
      { GITHUB_SHA: 'b'.repeat(40) },
      { VERCEL_GIT_COMMIT_REF: 'main' },
      { VITE_POSTHOG_HOST: 'http://evil.example' },
    ]) expect(assessPublicPreviewBuild({ ...preview, ...changed }).eligible).toBe(false);
  });
  it('checks exact main independently; never requires Preview tokens on main', () => {
    const main = { ...preview, GITHUB_REF: 'refs/heads/main',
      VERCEL_GIT_COMMIT_REF: 'main', VERCEL_ENV: 'production',
      VITE_APPWRITE_PROJECT_ID: '6a9703c50016b37110ff',
      VITE_APPWRITE_ENDPOINT: 'https://sgp.cloud.appwrite.io/v1',
      VITE_GIPHY_API_KEY: '', VITE_POSTHOG_TOKEN: '' };
    expect(assessPublicPreviewBuild(main)).toMatchObject({
      eligible: true, mandatory: false, preview: false,
    });
  });
});
