#!/usr/bin/env node
// Token-free default-main shadow entrypoint. It never creates deployments.
import { admitVerifiedArtifact } from './lib/prebuilt-admission-runner.mjs';

async function main() {
  if (process.env.MOSAIC_TRUSTED_PREVIEW_CREATE_ENABLED === 'true' ||
      process.env.MOSAIC_TRUSTED_PREVIEW_ALIAS_ENABLED === 'true')
    throw new Error('Read-only shadow explicitly refuses all provider-write flags');
  const { acceptedRun, verified } = await admitVerifiedArtifact();
  console.log('Trusted read-only artifact admission succeeded for SHA ' + acceptedRun.sha +
    ', run ' + acceptedRun.runId + '/' + acceptedRun.attempt +
    ', files ' + verified.fileCount + ', output schema v3.');
  console.log('No provider deployment, alias write, candidate execution or Production change.');
}
main().catch(error => {
  console.error(error instanceof Error ? error.message : 'Trusted admission blocked');
  process.exitCode = 1;
});
