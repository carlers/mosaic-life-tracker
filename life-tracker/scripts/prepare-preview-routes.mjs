#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { preparePreviewRoutes } from './lib/preview-build-routes.mjs';

const configPath = resolve(process.argv[2] ?? 'vercel.json');
const outputDir = resolve(process.argv[3] ?? '.mosaic/preview-build');
try {
  const raw = await readFile(configPath);
  const { serialized, evidence } = preparePreviewRoutes(JSON.parse(raw), raw);
  await mkdir(outputDir, { recursive: true });
  await writeFile(join(outputDir, 'config.json'), serialized);
  await writeFile(join(outputDir, 'routing-evidence.json'),
    JSON.stringify(evidence, null, 2) + '\n');
  console.log('Non-deployable Vercel Build Output API v3 routing evidence: ' +
    evidence.rewrites + ' existing SPA routes, ' + evidence.headerNames.length +
    ' mandatory security headers; sha256=' + evidence.generatedConfigSha256);
} catch (error) {
  console.error('Unsafe Preview routing package: ' +
    (error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
}
