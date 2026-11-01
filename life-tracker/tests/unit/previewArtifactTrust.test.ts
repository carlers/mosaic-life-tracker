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
    inventory: { digest: inventory.digest, count: inventory.files.length },
    jsCssFingerprint: 'b'.repeat(64),
    metrics: { initialClosureGzipBytes: 50 },
  };
  const pack = (...files: string[]) => execFileSync('tar', ['-czf', '-', ...files], { cwd: dist });
  return { dir, dist, inventory, evidence, pack };
}

function check(archive: Buffer, evidence: Record<string, unknown>, inventory: Record<string, unknown>) {
  return verifyArchivedBuild({ archive, archiveSha256: hash(archive), evidence, inventory,
    expected: { sha, ref } });
}

describe('trust boundary: unprivileged CI archive (#592)', () => {
  it('recognizes actual GNU tar layout and verifies all emitted static bytes', async () => {
    const f = await fixture();
    try {
      const archive = f.pack('.');
      expect(inspectGzipTar(archive)).toEqual(f.inventory.files);
      expect(check(archive, f.evidence, f.inventory)).toMatchObject({
        files: 4, source: { sha, ref }, deploymentAuthorized: false,
      });
    } finally { await rm(f.dir, { recursive: true, force: true }); }
  });

  it('allows only a bounded optional Whisper WASM archive entry', async () => {
    const f = await fixture();
    try {
      const wasm = join(f.dist, 'assets', 'ort-wasm-simd-threaded.asyncify-CxOG5pUO.wasm');
      await writeFile(wasm, Buffer.alloc(26_861_770));
      const inventory = await inventoryBuild(f.dist);
      const evidence = { ...f.evidence, inventory: { digest: inventory.digest, count: inventory.files.length } };
      const archive = f.pack('.');
      expect(inspectGzipTar(archive).some(file => file.name.endsWith('CxOG5pUO.wasm'))).toBe(true);
      expect(check(archive, evidence, inventory).files).toBe(5);

      await rm(wasm); // Preserve the unchanged 32 MiB total decompression bound.
      await writeFile(join(f.dist, 'assets', 'other-runtime.wasm'), Buffer.alloc(8 * 1024 * 1024 + 1));
      expect(() => inspectGzipTar(f.pack('.'))).toThrow(/Oversized tar entry/);
      await rm(join(f.dist, 'assets', 'other-runtime.wasm'));
      await writeFile(wasm, Buffer.alloc(28 * 1024 * 1024 + 1));
      expect(() => inspectGzipTar(f.pack('.'))).toThrow(/Oversized tar entry/);
    } finally { await rm(f.dir, { recursive: true, force: true }); }
  });

  it('rejects compressed checksum changes and content changes even with a fresh checksum', async () => {
    const f = await fixture();
    try {
      const archive = f.pack('.');
      expect(() => verifyArchivedBuild({ archive, archiveSha256: 'c'.repeat(64),
        evidence: f.evidence, inventory: f.inventory, expected: { sha, ref } }))
        .toThrow(/digest mismatch/);
      await writeFile(join(f.dist, 'assets', 'entry.js'), 'console.log("malicious")');
      expect(() => check(f.pack('.'), f.evidence, f.inventory)).toThrow(/differs/);
      expect(() => verifyArchivedBuild({ archive, archiveSha256: hash(archive),
        evidence: f.evidence, inventory: f.inventory, expected: { sha: 'c'.repeat(40), ref } }))
        .toThrow(/source SHA mismatch/);
    } finally { await rm(f.dir, { recursive: true, force: true }); }
  });

  it('rejects symlink entries, duplicates, and tar path traversal without extracting', async () => {
    const f = await fixture();
    try {
      await symlink('index.html', join(f.dist, 'unsafe-link'));
      expect(() => inspectGzipTar(f.pack('.'))).toThrow(/link, extension/);
      await rm(join(f.dist, 'unsafe-link'));
      const duplicated = execFileSync('tar', ['-czf', '-', '--transform=s|sw.js|index.html|', 'index.html', 'sw.js'], { cwd: f.dist });
      expect(() => inspectGzipTar(duplicated)).toThrow(/Duplicate/);
      // Mutate the filename in a legitimate tar header and repair its checksum.
      const tar = gunzipSync(f.pack('index.html'));
      const dangerous = Buffer.from('../escape.html');
      tar.fill(0, 0, 100);
      dangerous.copy(tar, 0);
      tar.fill(32, 148, 156);
      let sum = 0;
      for (let i = 0; i < 512; i += 1) sum += tar[i];
      const checksum = sum.toString(8).padStart(6, '0') + '\0 ';
      tar.write(checksum, 148, 'ascii');
      expect(() => inspectGzipTar(gzipSync(tar))).toThrow(/Unsafe tar artifact path/);
    } finally { await rm(f.dir, { recursive: true, force: true }); }
  });

  it('rejects missing inventory, malicious profile flags, and unbounded expansion', async () => {
    const f = await fixture();
    try {
      const archive = f.pack('.');
      expect(() => check(archive, { ...f.evidence, deploymentAuthorized: true }, f.inventory))
        .toThrow(/not a deployment authorization/);
      expect(() => check(archive, f.evidence, { ...f.inventory, files: [] }))
        .toThrow(/Incomplete expected/);
      expect(() => inspectGzipTar(archive, 100)).toThrow(/bounded/);
    } finally { await rm(f.dir, { recursive: true, force: true }); }
  });
});