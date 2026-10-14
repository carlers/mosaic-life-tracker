#!/usr/bin/env node
// Default-main only, GitHub-read-only artifact admission. No Vercel token,
// CLI, candidate execution, provider POST or alias mutation can be performed.
import { loadAcceptedArtifact } from './lib/prebuilt-github-admission.mjs';

async function main() {
  if (process.env.MOSAIC_TRUSTED_PREVIEW_CREATE_ENABLED === 'true' ||
      process.env.MOSAIC_TRUSTED_PREVIEW_ALIAS_ENABLED === 'true') {
    throw new Error('Read-only receiver refuses provider create and alias flags');
  }
  const { acceptedRun, verified } = await loadAcceptedArtifact();
  console.log('Trusted read-only artifact admission succeeded for SHA ' + acceptedRun.sha +
    ', run ' + acceptedRun.runId + '/' + acceptedRun.attempt +
    ', files ' + verified.fileCount + ', output schema v3.');
  console.log('No provider deployment, alias write, candidate execution or Production change.');
}
main().catch(error => {
  console.error(error instanceof Error ? error.message : 'Trusted admission blocked');
  process.exitCode = 1;
});
