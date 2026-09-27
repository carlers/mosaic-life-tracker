import { describe, expect, it } from 'vitest';
import { resolveAppwriteEnvValue } from '../../src/lib/appwriteConfig';

describe('fork-safe Appwrite configuration', () => {
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
