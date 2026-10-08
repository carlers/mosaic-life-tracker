import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolveAppwriteEnvValue } from '../../src/lib/appwriteConfig';

describe('fork-safe Appwrite configuration', () => {
  // Dynamic env indexing bundles unrelated VITE_* vars, including
  // deployment-specific metadata, into the application entry.
  it('uses explicit environment references for every Appwrite setting', async () => {
    const source = await readFile(new URL('../../src/lib/appwriteConfig.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/import\.meta\.env\s*\[/);
    for (const key of [
      'ENDPOINT', 'PROJECT_ID', 'DATABASE_ID', 'STORAGE_BUCKET_ID',
      'MESSAGE_ACTION_FUNCTION_ID', 'TABLE_TASKS', 'TABLE_CATEGORIES',
      'TABLE_DIARY', 'TABLE_SETTINGS', 'TABLE_FRIENDSHIPS',
      'TABLE_PROFILES', 'TABLE_MESSAGES',
    ]) {
      expect(source).toContain(`import.meta.env.VITE_APPWRITE_${key}`);
    }
  });
  it('uses an explicit fork value before any fallback', () => {
    expect(
      resolveAppwriteEnvValue(
        ' fork_project ',
        'production_project',
        'REPLACE_WITH_APPWRITE_PROJECT_ID',
        false
      )
    ).toBe('fork_project');
  });

  it('does not expose the official production fallback to a non-official build', () => {
    expect(
      resolveAppwriteEnvValue(
        undefined,
        '6a9703c50016b37110ff',
        'REPLACE_WITH_APPWRITE_PROJECT_ID',
        false
      )
    ).toBe('REPLACE_WITH_APPWRITE_PROJECT_ID');

    expect(
      resolveAppwriteEnvValue(
        undefined,
        'https://sgp.cloud.appwrite.io/v1',
        'https://appwrite.invalid/v1',
        false
      )
    ).toBe('https://appwrite.invalid/v1');
  });

  it('preserves the checked-in production fallback only for an official build', () => {
    expect(
      resolveAppwriteEnvValue(
        undefined,
        '6a9703c50016b37110ff',
        'REPLACE_WITH_APPWRITE_PROJECT_ID',
        true
      )
    ).toBe('6a9703c50016b37110ff');
  });
});
