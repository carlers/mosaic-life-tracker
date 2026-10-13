import shared from './playwright.config.mjs';

// Isolated production-output diagnostic: never use the development server,
// existing browser cache, or a Vercel deployment for this measurement.
export default {
  ...shared,
  workers: 1,
  retries: 0,
  timeout: 250_000,
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4179 --strictPort',
    url: 'http://127.0.0.1:4179/login',
    reuseExistingServer: false,
    timeout: 45_000,
  },
};
