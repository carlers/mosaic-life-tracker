import { readFileSync } from 'node:fs';

function read(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('PostHog production source-map build contract', () => {
  // Regression: §24.15 / DELIVERY.md (optional source-map upload stays opt-in).
  // It must not make ordinary Vercel builds depend on stale
  // external PostHog credentials.
  it('requires an explicit source-map opt-in in addition to the three build credentials', () => {
    const vite = read('vite.config.ts');
    const deployment = read('docs/DELIVERY.md');

    expect(vite).toContain("vercelEnvironment !== 'preview'");
    expect(vite).toContain("process.env.POSTHOG_SOURCE_MAPS_ENABLED === 'true'");
    expect(vite).toContain('process.env.POSTHOG_PERSONAL_API_KEY');
    expect(vite).toContain('process.env.POSTHOG_PROJECT_ID');
    expect(vite).toContain('process.env.POSTHOG_HOST');
    expect(deployment).toContain('POSTHOG_SOURCE_MAPS_ENABLED=true');
    expect(deployment).toContain('credentials alone MUST NOT');
  });
});
