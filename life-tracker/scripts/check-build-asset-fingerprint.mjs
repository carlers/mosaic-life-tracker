#!/usr/bin/env node
import { resolve } from 'node:path';
import { compareBuildAssetFingerprints, readBuildAssetFingerprint } from './lib/build-asset-fingerprint.mjs';

const [first = 'dist', second] = process.argv.slice(2);
try {
  const ci = await readBuildAssetFingerprint(resolve(first));
  console.log('Mosaic JS/CSS asset fingerprint: SHA-256 ' + ci.digest + ' (' + ci.assetCount + ' logical assets)');
  if (second) {
    const hosted = await readBuildAssetFingerprint(resolve(second));
    const comparison = compareBuildAssetFingerprints(ci, hosted);
    console.log('Hosted JS/CSS fingerprint: SHA-256 ' + hosted.digest + ' (' + hosted.assetCount + ' logical assets)');
    console.log('JS/CSS parity: ' + (comparison.matched ? 'matching' : 'different'));
    for (const change of comparison.changes) {
      console.log(change.state + ': ' + change.key + ' (raw bytes ' +
        (change.rawDeltaBytes >= 0 ? '+' : '') + change.rawDeltaBytes + ')');
    }
    if (!comparison.matched) process.exitCode = 1;
  }
} catch (error) {
  console.error('Cannot fingerprint JS/CSS assets: ' + (error instanceof Error ? error.message : String(error)));
  process.exitCode = 2;
}
