import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APP_VERSION } from '../../src/lib/appVersion';

// Regression: PROJECT_REFERENCE.md §24.13 — displayed release version and package
// metadata stay aligned.
describe('app version', () => {
  it('publishes release 0.0.1 consistently', () => {
    const packageJson = JSON.parse(
      readFileSync(new URL('../../package.json', import.meta.url), 'utf8')
    ) as { version: string };

    expect(APP_VERSION).toBe('0.0.1');
    expect(packageJson.version).toBe(APP_VERSION);
  });
});
