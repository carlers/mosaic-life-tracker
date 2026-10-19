import shared from './playwright.config.mjs';

// Target a real WebKit browser engine with an iPad-sized touch viewport. This
// is not the iPadOS system Safari build or a virtual iOS keyboard simulation.
export default {
  ...shared,
  workers: 1,
  projects: [{
    name: 'webkit-ipad-viewport',
    use: {
      browserName: 'webkit',
      viewport: { width: 820, height: 1180 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      ignoreHTTPSErrors: true,
    },
  }],
};
