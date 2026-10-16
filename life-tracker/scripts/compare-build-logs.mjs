#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { compareBuildEvidence, formatBuildParityReport, parseBuildEvidence } from './lib/build-parity-report.mjs';

// Read-only, local diagnostic. Full logs may contain secrets: never echo them.
const [ciPath, hostedPath, ciSha, hostedSha] = process.argv.slice(2);
if (!ciPath || !hostedPath || !ciSha || !hostedSha) {
  console.error('Usage: node scripts/compare-build-logs.mjs <ci-build.log> <hosted-build.log> <ci-full-sha> <hosted-full-sha>');
  process.exitCode = 2;
} else {
  try {
    const [ciLog, hostedLog] = await Promise.all([readFile(ciPath, 'utf8'), readFile(hostedPath, 'utf8')]);
    const report = compareBuildEvidence({
      ci: parseBuildEvidence(ciLog),
      hosted: parseBuildEvidence(hostedLog),
      ciSha,
      hostedSha,
    });
    console.log(formatBuildParityReport(report));
    if (report.status !== 'matching-measurements') process.exitCode = 1;
  } catch (error) {
    console.error('Cannot compare build evidence: ' + (error instanceof Error ? error.message : String(error)));
    process.exitCode = 2;
  }
}
