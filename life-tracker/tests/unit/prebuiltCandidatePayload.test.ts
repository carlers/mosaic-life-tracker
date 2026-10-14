import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { deflateRawSync } from 'node:zlib';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inventoryBuild } from '../../scripts/lib/preview-build-evidence.mjs';
import { preparePreviewRoutes } from '../../scripts/lib/preview-build-routes.mjs';
import { verifyPrebuiltCandidateBytes, assembleVerifiedCandidateStatic,
  TRUSTED_HIGH_LEVEL_CONFIG_SHA256,
  approvedHighLevelConfigHashes } from '../../scripts/lib/prebuilt-candidate-payload.mjs';

const sha = 'a'.repeat(40);
const branch = 'fix/592-trusted-archive-20261014';
const hash = (value: Buffer | string) =>
  createHash('sha256').update(value).digest('hex');
const crcTable = Array.from({ length: 256 }, (_, v) => {
  let n = v;
  for (let i = 0; i < 8; i++) n = (n >>> 1) ^ ((n & 1) ? 0xedb88320 : 0);
  return n >>> 0;
});
function crc32(bytes: Buffer) {
  let n = 0xffffffff;
  for (const b of bytes) n = crcTable[(n ^ b) & 255] ^ (n >>> 8);
  return (n ^ 0xffffffff) >>> 0;
}
function pack(data: Record<string, Buffer>) {
  const local: Buffer[] = [], central: Buffer[] = [];
  let at = 0;
  for (const [key, contents] of Object.entries(data)) {
    const name = Buffer.from(key), compressed = deflateRawSync(contents);
    const crc = crc32(contents);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(8, 6);
    header.writeUInt16LE(8, 8);
    header.writeUInt16LE(name.length, 26);
    const trailer = Buffer.alloc(16);
    trailer.writeUInt32LE(0x08074b50);
    trailer.writeUInt32LE(crc, 4);
    trailer.writeUInt32LE(compressed.length, 8);
    trailer.writeUInt32LE(contents.length, 12);
    local.push(header, name, compressed, trailer);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50);
    c.writeUInt16LE(0x0314, 4);
    c.writeUInt16LE(20, 6);
    c.writeUInt16LE(8, 8);
    c.writeUInt16LE(8, 10);
    c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(compressed.length, 20);
    c.writeUInt32LE(contents.length, 24);
    c.writeUInt16LE(name.length, 28);
    c.writeUInt32LE(0o100644 * 65536, 38);
    c.writeUInt32LE(at, 42);
    central.push(c, name);
    at += 30 + name.length + compressed.length + 16;
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(central.length / 2, 8);
  end.writeUInt16LE(central.length / 2, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(at, 16);
  return Buffer.concat([...local, directory, end]);
}
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'mosaic-prebuilt-admission-'));
  const dist = join(root, 'dist');
  await mkdir(join(dist, '.vite'), { recursive: true });
  await mkdir(join(dist, 'assets'), { recursive: true });
  await writeFile(join(dist, 'index.html'), '<html>test output</html>');
  await writeFile(join(dist, 'sw.js'), 'self.addEventListener("fetch",()=>{})');
  await writeFile(join(dist, '.vite', 'manifest.json'), '{}');
  await writeFile(join(dist, 'assets', 'main.js'), 'console.log("safe")');
  const inventory = await inventoryBuild(dist);
  const archive = execFileSync('tar', ['-czf', '-', '-C', dist, '.']);
  const input = await readFile('vercel.json');
  expect(approvedHighLevelConfigHashes().has(hash(input))).toBe(true);
  expect(hash(input)).not.toBe(TRUSTED_HIGH_LEVEL_CONFIG_SHA256);
  const routing = preparePreviewRoutes(JSON.parse(input.toString()), input);
  const evidence = {
    schemaVersion: 1, kind: 'non-deployable-ci-build-evidence',
    deploymentAuthorized: false,
    source: { sha, ref: 'refs/heads/' + branch },
    inventory: { digest: inventory.digest, count: inventory.files.length },
    jsCssFingerprint: 'f'.repeat(64),
    buildProfile: { environment: 'untrusted-ci-diagnostic', nodeMajor: 24,
      giphy: 'enabled', posthog: 'enabled', appwriteBackend: 'scratch',
      vercelEnvironment: 'preview' },
    metrics: { initialClosureGzipBytes: 146064, homeClosureGzipBytes: 368752 },
  };
  const files = {
    'config.json': Buffer.from(routing.serialized),
    'dist.tar.gz': archive,
    'dist.tar.gz.sha256': Buffer.from(hash(archive) + '  .mosaic/preview-build/dist.tar.gz\n'),
    'evidence.json': Buffer.from(JSON.stringify(evidence)),
    'inventory.json': Buffer.from(JSON.stringify(inventory)),
    'routing-evidence.json': Buffer.from(JSON.stringify(routing.evidence)),
  };
  const zip = pack(files);
  return { root, files, zip, digest: 'sha256:' + hash(zip),
    expected: { sha, branch }, evidence };
}

describe('trusted main byte-level prebuilt admission #592', () => {
  it('verifies all bytes and materializes only the reviewed static build', async () => {
    const f = await fixture();
    try {
      const candidate = verifyPrebuiltCandidateBytes(f.zip, { ...f.expected, digest: f.digest });
      expect(candidate).toMatchObject({ fileCount: 4, deploymentAuthorized: false });
      const result = await assembleVerifiedCandidateStatic(candidate, join(f.root, 'staged'));
      expect(result).toMatchObject({ files: 4, deploymentAuthorized: false });
      expect(await readFile(join(f.root, 'staged', '.vercel', 'output', 'static', 'index.html'), 'utf8'))
        .toContain('test output');
      await expect(assembleVerifiedCandidateStatic(candidate, join(f.root, 'staged')))
        .rejects.toThrow(/EEXIST/);
    } finally { await rm(f.root, { recursive: true, force: true }); }
  });
  it('rejects changed archive bytes, forged routing claims or wrong build profile', async () => {
    const f = await fixture();
    try {
      expect(() => verifyPrebuiltCandidateBytes(f.zip, { ...f.expected,
        digest: 'sha256:' + 'e'.repeat(64) })).toThrow(/ZIP digest/);
      const badRoute = { ...f.files, 'config.json': Buffer.from('{"version":3,"routes":[]}') };
      const changed = pack(badRoute);
      expect(() => verifyPrebuiltCandidateBytes(changed, { ...f.expected,
        digest: 'sha256:' + hash(changed) })).toThrow(/routing/);
      const withoutGiphy = { ...f.evidence,
        buildProfile: { ...f.evidence.buildProfile, giphy: 'disabled' } };
      const changedProfile = pack({ ...f.files,
        'evidence.json': Buffer.from(JSON.stringify(withoutGiphy)) });
      expect(() => verifyPrebuiltCandidateBytes(changedProfile, { ...f.expected,
        digest: 'sha256:' + hash(changedProfile) })).toThrow(/profile/);
      expect(() => verifyPrebuiltCandidateBytes(f.zip, { ...f.expected,
        sha: 'b'.repeat(40), digest: f.digest })).toThrow(/source SHA/);
    } finally { await rm(f.root, { recursive: true, force: true }); }
  });
  it('rejects repacked ZIPs with forged inner archive hash or file inventory', async () => {
    const f = await fixture();
    try {
      // An attacker can repackage candidate bytes and recalculate a matching
      // outer ZIP digest. The inner content still must match CI's own proof.
      const checksum = Buffer.from('0'.repeat(64) + '  .mosaic/preview-build/dist.tar.gz\n');
      const alteredChecksum = pack({ ...f.files, 'dist.tar.gz.sha256': checksum });
      expect(() => verifyPrebuiltCandidateBytes(alteredChecksum, { ...f.expected,
        digest: 'sha256:' + hash(alteredChecksum) }))
        .toThrow(/compressed archive digest mismatch/);

      const inventory = JSON.parse(f.files['inventory.json'].toString('utf8'));
      inventory.files[0].sha256 = '0'.repeat(64);
      const alteredInventory = pack({ ...f.files,
        'inventory.json': Buffer.from(JSON.stringify(inventory)) });
      expect(() => verifyPrebuiltCandidateBytes(alteredInventory, { ...f.expected,
        digest: 'sha256:' + hash(alteredInventory) }))
        .toThrow(/archive differs from signed-by-CI inventory/);
    } finally { await rm(f.root, { recursive: true, force: true }); }
  });
});
