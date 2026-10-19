import shared from './playwright.config.mjs';

// Run the same correctness corpus under the actual WebKit engine, with
// mobile touch emulation. The dedicated task-entry case also exercises an
// iPad-sized viewport. Neither simulates the native iPadOS keyboard/PWA.
export default {
  ...shared,
  workers: process.env.CI ? 1 : undefined,
  projects: [{
    name: 'webkit-mobile',
    use: {
      browserName: 'webkit',
      viewport: { width: 412, height: 915 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      ignoreHTTPSErrors: true,
    },
  }],
};
