import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APP_VERSION } from '../../src/lib/appVersion';
import { APP_BUILD_INFO } from '../../src/lib/buildInfo';

// Regression: PROJECT_REFERENCE.md §24.13 — displayed release version and package
// metadata stay aligned; build identity remains separate from the release number.
describe('app version and build identity', () => {
  it('publishes release 0.1.0 consistently', () => {
    const packageJson = JSON.parse(
      readFileSync(new URL('../../package.json', import.meta.url), 'utf8')
    ) as { version: string };

    expect(APP_VERSION).toBe('0.1.0');
    expect(packageJson.version).toBe(APP_VERSION);
    expect(APP_BUILD_INFO.version).toBe(APP_VERSION);
  });

  it('uses a stable local fallback outside deployment builds', () => {
    expect(APP_BUILD_INFO.channel).toBe('Local');
    expect(APP_BUILD_INFO.buildId).toBe('local');
    expect(APP_BUILD_INFO.commit).toBeNull();
    expect(APP_BUILD_INFO.branch).toBe('local');
  });
});
