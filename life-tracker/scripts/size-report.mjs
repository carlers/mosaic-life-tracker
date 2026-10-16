import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { readBuildSizeSnapshot } from './lib/build-size-diagnostics.mjs';

// This is diagnostics ONLY. It neither rebuilds nor evaluates budget ceilings;
// the seven legacy blocking checks remain unchanged until policy cutover.
const directory = resolve(process.argv[2] || 'dist');
const outputDirectory = resolve(
  process.env.MOSAIC_AUDIT_OUTPUT_DIR || '.mosaic/mobile-startup',
);
const snapshot = await readBuildSizeSnapshot(directory);
const largestAssets = Object.entries(snapshot.files)
  .sort((a, b) => b[1].gzipBytes - a[1].gzipBytes)
  .slice(0, 20)
  .map(([logicalName, size]) => ({
    logicalName,
    rawBytes: size.rawBytes,
    gzipBytes: size.gzipBytes,
  }));

const report = {
  schemaVersion: 1,
  sourceSha: process.env.MOSAIC_AUDIT_SOURCE_SHA || 'local-unknown',
  createdAt: new Date().toISOString(),
  buildProfile: {
    vercelEnvironment: process.env.VERCEL_ENV || 'local',
    giphyPresent: Boolean(process.env.VITE_GIPHY_API_KEY?.trim()),
    node: process.version,
  },
  metrics: snapshot.metrics,
  deferredGzipBytes: snapshot.deferredGzipBytes,
  unmappedGzipBytes: snapshot.unmappedGzipBytes,
  largestAssets,
  note: 'Static byte measurements, not actual network transfer or measured device latency.',
};

await mkdir(outputDirectory, { recursive: true });
const file = join(outputDirectory, 'size-snapshot.json');
await writeFile(file, JSON.stringify(report, null, 2) + '\n');
console.log('MOSAIC_SIZE_SNAPSHOT ' + file);
console.log(JSON.stringify(report.metrics));
