import { defineConfig } from '@playwright/test';

export default defineConfig({
  // Browser contracts are isolated per test/page. Run tests within the large
  // interaction-contract file concurrently instead of serializing the whole file.
  fullyParallel: true,
  // GitHub's medium hosted runner exposes two cores. Using both cuts wall time
  // without oversubscribing Chromium/Vite on CI; local runs keep Playwright's default.
  workers: process.env.CI ? 2 : undefined,
});
