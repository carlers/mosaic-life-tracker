#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createBuildEvidence, verifyBuildEvidence } from './lib/preview-build-evidence.mjs';

// Produce and verify evidence only. No Vercel credentials, provider API,
// secrets, deployment, alias, canonical-acceptance decision, or build step.
const [command = 'create', distPath = 'dist', reportPath = '.mosaic/preview-build'] = process.argv.slice(2);
const directory = resolve(distPath);
const output = resolve(reportPath);
try {
  if (command === 'create') {
    const { evidence, inventory } = await createBuildEvidence({
      directory,
      sha: process.env.GITHUB_SHA,
      ref: process.env.GITHUB_REF,
      profile: {
        giphy: Boolean(process.env.VITE_GIPHY_API_KEY?.trim()),
        posthog: Boolean(process.env.VITE_POSTHOG_TOKEN?.trim() && process.env.VITE_POSTHOG_HOST?.trim()),
        vercelEnvironment: process.env.VERCEL_ENV,
        appwriteBackend: process.env.VERCEL_ENV === 'preview' ? 'scratch' : 'production',
      },
    });
    await mkdir(output, { recursive: true });
    await writeFile(join(output, 'evidence.json'), JSON.stringify(evidence, null, 2) + '\n');
    await writeFile(join(output, 'inventory.json'), JSON.stringify(inventory, null, 2) + '\n');
    console.log('Non-deployable CI build evidence: ' + evidence.source.sha +
      ', ' + inventory.files.length + ' files, digest ' + inventory.digest);
    console.log('Provider deployments created: 0');
  } else if (command === 'verify') {
    const evidence = JSON.parse(await readFile(join(output, 'evidence.json'), 'utf8'));
    const inventory = JSON.parse(await readFile(join(output, 'inventory.json'), 'utf8'));
    await verifyBuildEvidence(directory, evidence, inventory, {
      sha: process.env.GITHUB_SHA,
      ref: process.env.GITHUB_REF,
    });
    console.log('Read-only build byte verification passed (NOT deployment approval).');
  } else {
    throw new Error('Usage: preview-build-evidence.mjs create|verify [dist] [evidence directory]');
  }
} catch (error) {
  console.error('Build evidence failed: ' + (error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
}
