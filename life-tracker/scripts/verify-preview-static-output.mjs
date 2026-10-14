#!/usr/bin/env node
// A zero-provider smoke check of EXACT saved CI bytes, not a deployment.
// The trusted default-main receiver must revalidate the GitHub canonical run.
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { assembleVerifiedStaticOutput, verifyStaticOutputFiles } from './lib/preview-static-output.mjs';

const directory = resolve(process.argv[2] || '.mosaic/preview-build');
const temp = await mkdtemp(join(tmpdir(), 'mosaic-592-verified-static-'));
try {
  const names = ['dist.tar.gz', 'dist.tar.gz.sha256', 'evidence.json',
    'inventory.json', 'config.json', 'routing-evidence.json'];
  const files = await Promise.all(names.map(name => readFile(join(directory, name))));
  const [archive, checksum, evidenceBytes, inventoryBytes, configBytes, routingBytes] = files;
  const line = checksum.toString('utf8').trim();
  const digest = /^([a-f0-9]{64})\s+\S*dist\.tar\.gz$/.exec(line);
  if (!digest) throw new Error('Malformed CI archive checksum');
  const evidence = JSON.parse(evidenceBytes.toString('utf8'));
  const inventory = JSON.parse(inventoryBytes.toString('utf8'));
  const result = await assembleVerifiedStaticOutput({
    archive,
    archiveSha256: digest[1],
    evidence,
    inventory,
    expected: { sha: process.env.GITHUB_SHA, ref: process.env.GITHUB_REF },
    configBytes,
    routingEvidence: JSON.parse(routingBytes.toString('utf8')),
    trustedVercelConfigBytes: await readFile('vercel.json'),
    outputRoot: join(temp, 'staged'),
  });
  await verifyStaticOutputFiles(result.outputRoot, inventory);
  console.log('Read-only Vercel static output verified: ' + result.files +
    ' identical files, v3 routing SHA-256 ' + result.configSha256 +
    ', deploymentAuthorized=false; provider requests: ZERO');
} catch (error) {
  console.error('CI static output rejected: ' +
    (error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
} finally {
  await rm(temp, { recursive: true, force: true });
}
