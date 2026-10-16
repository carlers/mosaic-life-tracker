#!/usr/bin/env node
// Read-only archive integrity check; NEVER authorizes a deployment or loads a token.
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { verifyArchivedBuild } from './lib/preview-artifact-trust.mjs';

const directory = resolve(process.argv[2] || '.mosaic/preview-build');
try {
  const [archive, checksum, evidenceBytes, inventoryBytes] = await Promise.all([
    readFile(resolve(directory, 'dist.tar.gz')),
    readFile(resolve(directory, 'dist.tar.gz.sha256'), 'utf8'),
    readFile(resolve(directory, 'evidence.json'), 'utf8'),
    readFile(resolve(directory, 'inventory.json'), 'utf8'),
  ]);
  const line = checksum.trim();
  const match = /^([0-9a-f]{64})\s+\S*dist\.tar\.gz$/.exec(line);
  if (!match) throw new Error('Malformed compressed archive checksum');
  const verified = verifyArchivedBuild({
    archive, archiveSha256: match[1],
    evidence: JSON.parse(evidenceBytes), inventory: JSON.parse(inventoryBytes),
    expected: { sha: process.env.GITHUB_SHA, ref: process.env.GITHUB_REF },
  });
  console.log('CI artifact bytes verified: ' + verified.files + ' files, ' +
    verified.inventoryDigest + '; deploy authorization: FALSE');
} catch (error) {
  console.error('Preview CI archive invalid: ' + (error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
}