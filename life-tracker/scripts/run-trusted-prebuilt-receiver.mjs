#!/usr/bin/env node
// Default-main only, GitHub-read-only artifact admission. No Vercel token,
// CLI, candidate execution, provider POST or alias mutation can be performed.
import { appendFileSync, readFileSync } from 'node:fs';
import { loadAcceptedArtifact, sourceOptInStatus } from './lib/prebuilt-github-admission.mjs';

async function main() {
  if (process.env.MOSAIC_TRUSTED_PREVIEW_CREATE_ENABLED === 'true' ||
      process.env.MOSAIC_TRUSTED_PREVIEW_ALIAS_ENABLED === 'true') {
    throw new Error('Read-only receiver refuses provider create and alias flags');
  }
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  if (!await sourceOptInStatus(event)) {
    console.log('No reviewed source Git suppression; ordinary Git Preview unchanged.');
    return;
  }
  const { acceptedRun, verified } = await loadAcceptedArtifact();
  if (!process.env.GITHUB_OUTPUT) throw new Error('Missing receiver job-output channel');
  appendFileSync(process.env.GITHUB_OUTPUT, 'admitted=true\n');
  console.log('Trusted read-only artifact admission succeeded for SHA ' + acceptedRun.sha +
    ', run ' + acceptedRun.runId + '/' + acceptedRun.attempt +
    ', files ' + verified.fileCount + ', output schema v3.');
  console.log('No provider deployment, alias write, candidate execution or Production change.');
}
main().catch(error => {
  console.error(error instanceof Error ? error.message : 'Trusted admission blocked');
  process.exitCode = 1;
});
