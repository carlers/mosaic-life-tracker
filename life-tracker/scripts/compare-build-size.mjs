#!/usr/bin/env node
import { resolve } from 'node:path';
import { readBuildSizeSnapshot, compareSizeSnapshots, formatSizeDiagnostics } from './lib/build-size-diagnostics.mjs';

const [previous, current] = process.argv.slice(2);
if (!previous || !current) {
  console.error('Usage: node scripts/compare-build-size.mjs <previous-dist> <candidate-dist>');
  process.exitCode = 2;
} else {
  try {
    const [before, after] = await Promise.all([
      readBuildSizeSnapshot(resolve(previous)),
      readBuildSizeSnapshot(resolve(current)),
    ]);
    console.log(formatSizeDiagnostics(after, compareSizeSnapshots(before, after)));
  } catch (error) {
    console.error('Cannot compare production builds: ' + (error instanceof Error ? error.message : String(error)));
    process.exitCode = 2;
  }
}
