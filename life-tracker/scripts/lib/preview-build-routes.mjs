import { createHash } from 'node:crypto';
import { getTransformedRoutes } from '@vercel/routing-utils';

// This is a static-only Vite PWA. These are existing behavior/security
// invariants, not newly introduced routing rules. Fail closed if Vercel's
// high-level config acquires unsupported features.
const expectedKeys = ['$schema', 'git', 'framework', 'buildCommand', 'outputDirectory',
  'headers', 'rewrites'];
const headers = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(self), geolocation=()',
};
const deepLinks = [
  '/reset-password', '/login', '/home', '/backlog', '/bucket-list',
  '/bucket-list/:path*', '/explore', '/friends/:path*', '/notifications',
  '/messages', '/messages/:path*', '/account', '/settings',
  '/settings/:path*', '/profile',
];

export const sha256 = value => createHash('sha256').update(value).digest('hex');

export function preparePreviewRoutes(highLevel, rawBytes) {
  if (!highLevel || typeof highLevel !== 'object' ||
      Object.keys(highLevel).some(key => !expectedKeys.includes(key)) ||
      highLevel.framework !== 'vite' ||
      highLevel.buildCommand !== 'npm run build' ||
      highLevel.outputDirectory !== 'dist') {
    throw new Error('Unsupported Vercel static configuration for prebuilt Preview');
  }
  if (!Array.isArray(highLevel.headers) || highLevel.headers.length !== 1 ||
      highLevel.headers[0].source !== '/(.*)' ||
      JSON.stringify(Object.fromEntries((highLevel.headers[0].headers || [])
        .map(({ key, value }) => [key, value]))) !== JSON.stringify(headers)) {
    throw new Error('Missing mandatory Preview security headers');
  }
  if (!Array.isArray(highLevel.rewrites) ||
      highLevel.rewrites.length !== deepLinks.length ||
      highLevel.rewrites.some((rule, i) =>
        rule.source !== deepLinks[i] || rule.destination !== '/index.html' ||
        Object.keys(rule).length !== 2)) {
    throw new Error('Unexpected route or unsafe Preview rewrite');
  }
  const { routes, error } = getTransformedRoutes({
    headers: highLevel.headers,
    rewrites: highLevel.rewrites,
  });
  if (error || !Array.isArray(routes) || routes.length < deepLinks.length ||
      !routes.some(item => item?.headers?.['X-Frame-Options'] === 'DENY') ||
      !routes.some(item => item?.dest === '/index.html')) {
    throw new Error('Vercel routing adapter failed to preserve static Preview contracts');
  }
  const output = { version: 3, routes };
  const serialized = JSON.stringify(output, null, 2) + '\n';
  return {
    config: output,
    serialized,
    evidence: {
      schemaVersion: 1,
      kind: 'non-deployable-preview-routing-evidence',
      vercelConfigSha256: sha256(rawBytes),
      generatedConfigSha256: sha256(serialized),
      rewrites: deepLinks.length,
      headerNames: Object.keys(headers),
      deploymentAuthorized: false,
    },
  };
}
