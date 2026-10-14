import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inventoryBuild } from '../../scripts/lib/preview-build-evidence.mjs';
import { preparePreviewRoutes } from '../../scripts/lib/preview-build-routes.mjs';
import { assembleVerifiedStaticOutput, verifyPreviewRoutingEvidence,
  verifyStaticOutputFiles } from '../../scripts/lib/preview-static-output.mjs';

const sha = 'a'.repeat(40);
const ref = 'refs/heads/fix/accepted-preview';
const hash = (b: Buffer) => createHash('sha256').update(b).digest('hex');

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'mosaic-prebuilt-static-'));
  const dist = join(root, 'dist');
  await mkdir(join(dist, '.vite'), { recursive: true });
  await mkdir(join(dist, 'assets'), { recursive: true });
  await writeFile(join(dist, 'index.html'), '<html>safe fixture</html>');
  await writeFile(join(dist, 'sw.js'), 'self.addEventListener("fetch",()=>{});');
  await writeFile(join(dist, '.vite', 'manifest.json'), '{}');
  await writeFile(join(dist, 'assets', 'app.js'), 'console.log("fixture")');
  const inventory = await inventoryBuild(dist);
  const archive = execFileSync('tar', ['-czf', '-', '-C', dist, '.']);
  const trustedVercelConfigBytes = await readFile(join(process.cwd(), 'vercel.json'));
  const { serialized, evidence: routingEvidence } =
    preparePreviewRoutes(JSON.parse(trustedVercelConfigBytes.toString('utf8')), trustedVercelConfigBytes);
  const evidence = {
    schemaVersion: 1, kind: 'non-deployable-ci-build-evidence', deploymentAuthorized: false,
    source: { sha, ref },
    buildProfile: { environment: 'untrusted-ci-diagnostic', giphy: 'disabled', nodeMajor: 24 },
    inventory: { digest: inventory.digest, count: inventory.files.length },
    jsCssFingerprint: 'b'.repeat(64),
    metrics: { initialClosureGzipBytes: 100 },
  };
  return { root, archive, archiveSha256: hash(archive), inventory, evidence,
    expected: { sha, ref }, trustedVercelConfigBytes, routingEvidence,
    configBytes: Buffer.from(serialized), outputRoot: join(root, 'output') };
}

describe('verified Vercel static output (never a deploy authorization) #592', () => {
  it('reuses every accepted CI file byte and exact generated routing config', async () => {
    const f = await fixture();
    try {
      const result = await assembleVerifiedStaticOutput(f);
      expect(result).toMatchObject({ files: 4, deploymentAuthorized: false,
        source: { sha, ref }, staticDigest: f.inventory.digest });
      expect(await verifyStaticOutputFiles(f.outputRoot, f.inventory)).toBe(true);
      expect(await readFile(join(f.outputRoot, '.vercel', 'output', 'config.json')))
        .toEqual(f.configBytes);
      await writeFile(join(f.outputRoot, '.vercel', 'output', 'static', 'assets', 'app.js'),
        'console.log("tampered")');
      await expect(verifyStaticOutputFiles(f.outputRoot, f.inventory))
        .rejects.toThrow(/changed after/);
    } finally { await rm(f.root, { recursive: true, force: true }); }
  });

  it('rejects altered route bytes, unexpected high-level config and unsupported routes', async () => {
    const f = await fixture();
    try {
      expect(() => verifyPreviewRoutingEvidence({ ...f,
        configBytes: Buffer.from('{"version":3,"routes":[]}'),
      })).toThrow(/digest mismatch/);
      expect(() => verifyPreviewRoutingEvidence({ ...f,
        trustedVercelConfigBytes: Buffer.from('{}'),
      })).toThrow(/digest mismatch/);
      const changed = Buffer.from('{"version":3,"routes":[]}');
      expect(() => verifyPreviewRoutingEvidence({ ...f, configBytes: changed,
        routingEvidence: { ...f.routingEvidence, generatedConfigSha256: hash(changed) },
      })).toThrow(/Incomplete/);
    } finally { await rm(f.root, { recursive: true, force: true }); }
  });

  it('refuses unsafe archive, source mismatch and an already-existing output path', async () => {
    const f = await fixture();
    try {
      await expect(assembleVerifiedStaticOutput({ ...f,
        archiveSha256: 'f'.repeat(64) })).rejects.toThrow(/digest mismatch/);
      await expect(assembleVerifiedStaticOutput({ ...f,
        expected: { sha: 'c'.repeat(40), ref } })).rejects.toThrow(/source SHA mismatch/);
      await mkdir(f.outputRoot);
      await expect(assembleVerifiedStaticOutput(f)).rejects.toThrow(/EEXIST/);
    } finally { await rm(f.root, { recursive: true, force: true }); }
  });
});
