import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APP_VERSION } from '../../src/lib/appVersion';
import {
  APP_BUILD_INFO,
  parseEmbeddedBuildInfo,
} from '../../src/lib/buildInfo';

// Regression: §24.13 (release version and package metadata stay aligned).
describe('app version and build identity', () => {
  it('publishes release 0.2.0 consistently', () => {
    const packageJson = JSON.parse(
      readFileSync(new URL('../../package.json', import.meta.url), 'utf8')
    ) as { version: string };

    expect(APP_VERSION).toBe('0.2.0');
    expect(packageJson.version).toBe(APP_VERSION);
    expect(APP_BUILD_INFO.version).toBe(APP_VERSION);
  });

  it('parses hosted build identity from index metadata', () => {
    expect(
      parseEmbeddedBuildInfo(
        JSON.stringify({
          commit: 'abcdef1234567890',
          commitMessage: 'refactor: backend workflow',
          branch: 'refactor/appwrite-version-control-audit',
          builtAt: '2026-10-05T15:34:00.000Z',
          channel: 'Preview',
        })
      )
    ).toEqual({
      commit: 'abcdef1234567890',
      commitMessage: 'refactor: backend workflow',
      branch: 'refactor/appwrite-version-control-audit',
      builtAt: '2026-10-05T15:34:00.000Z',
      channel: 'Preview',
    });
    expect(parseEmbeddedBuildInfo('{not-json')).toBeNull();
  });

  it('uses a stable local fallback outside deployment builds', () => {
    expect(APP_BUILD_INFO.channel).toBe('Local');
    expect(APP_BUILD_INFO.buildId).toBe('local');
    expect(APP_BUILD_INFO.commit).toBeNull();
    expect(APP_BUILD_INFO.branch).toBeNull();
    expect(APP_BUILD_INFO.commitMessage).toBeNull();
  });
});
