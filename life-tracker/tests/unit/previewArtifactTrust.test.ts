import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { gzipSync, gunzipSync } from 'node:zlib';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inventoryBuild } from '../../scripts/lib/preview-build-evidence.mjs';
import { inspectGzipTar, verifyArchivedBuild } from '../../scripts/lib/preview-artifact-trust.mjs';

const sha = 'a'.repeat(40);
const ref = 'refs/heads/fix/accepted-preview';
const hash = (data: Buffer) => createHash('sha256').update(data).digest('hex');

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'mosaic-592-tar-'));
  const dist = join(dir, 'dist');
  await mkdir(join(dist, '.vite'), { recursive: true });
  await mkdir(join(dist, 'assets'), { recursive: true });
  await writeFile(join(dist, 'index.html'), '<html></html>');
  await writeFile(join(dist, 'sw.js'), 'self.addEventListener("fetch", () => {})');
  await writeFile(join(dist, '.vite', 'manifest.json'), '{}');
  await writeFile(join(dist, 'assets', 'entry.js'), 'console.log("ok")');
  const inventory = await inventoryBuild(dist);
  const evidence = {
    schemaVersion: 1,
    kind: 'non-deployable-ci-build-evidence',
    deploymentAuthorized: false,
    source: { sha, ref },
    buildProfile: { environment: 'untrusted-ci-diagnostic', giphy: 'disabled', nodeMajor: 24 },
    inventory: {¶»§q«^