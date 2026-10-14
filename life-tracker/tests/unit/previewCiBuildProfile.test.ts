import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('official CI build profile safety (#592)', () => {
  it('always targets Scratch for Preview, Production only on exact main', async () => {
    const text = await readFile('../.github/workflows/quality-gate.yml', 'utf8');
    const start = text.indexOf('  build_check:');
    const end = text.indexOf('\n  browser_contract:', start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const build = text.slice(start, end);
    expect(build).toContain("VERCEL_ENV: ${{ github.ref == 'refs/heads/main' && 'production' || 'preview' }}");
    expect(build).toContain("VITE_APPWRITE_PROJECT_ID: ${{ github.ref == 'refs/heads/main' && '6a9703c50016b37110ff' || '6a96e82d000d1310b3be' }}");
    expect(build).toContain("VITE_APPWRITE_ENDPOINT: ${{ github.ref == 'refs/heads/main' && 'https://sgp.cloud.appwrite.io/v1' || 'https://fra.cloud.appwrite.io/v1' }}");
    expect(build).toContain("VITE_APPWRITE_MESSAGE_ACTION_FUNCTION_ID: '6aa8057f002a4c306fdd'");
    expect(build).toContain("VERCEL_GIT_COMMIT_SHA: ${{ github.sha }}");
    expect(build).toContain("VERCEL_GIT_COMMIT_REF: ${{ github.ref_name }}");
  });

  it('allows only opt-in browser-public feature tokens; never passes provider write credentials to CI build', async () => {
    const text = await readFile('../.github/workflows/quality-gate.yml', 'utf8');
    const build = text.slice(text.indexOf('  build_check:'), text.indexOf('\n  browser_contract:'));
    for (const feature of ['GIPHY_KEY', 'POSTHOG_TOKEN', 'POSTHOG_HOST']) {
      expect(build).toContain("secrets.MOSAIC_PUBLIC_PREVIEW_" + feature + " || ''");
    }
    expect(build).not.toMatch(/MOSAIC_PREVIEW_AUTO_VERCEL_TOKEN|POSTHOG_PERSONAL_API_KEY/);
    expect(build).not.toMatch(/secrets\.(?!MOSAIC_PUBLIC_PREVIEW_)/);
    expect(build).toContain("POSTHOG_SOURCE_MAPS_ENABLED: 'false'");
  });
});
