import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { inspectGzipTar, verifyArchivedBuild } from './preview-artifact-trust.mjs';
import { preparePreviewRoutes } from './preview-build-routes.mjs';

// This reconstructs the candidate's public static bytes, never executes them.
// Its return value is explicitly NOT permission to create a Vercel deployment.
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const requiredHeaders = [
  'X-Content-Type-Options', 'X-Frame-Options',
  'Referrer-Policy', 'Permissions-Policy',
];

export function verifyPreviewRoutingEvidence({ configBytes, routingEvidence,
  trustedVercelConfigBytes }) {
  if (!Buffer.isBuffer(configBytes) || configBytes.length === 0 ||
      configBytes.length > 64 * 1024 ||
      !Buffer.isBuffer(trustedVercelConfigBytes) ||
      trustedVercelConfigBytes.length === 0 ||
      trustedVercelConfigBytes.length > 64 * 1024 ||
      routingEvidence?.schemaVersion !== 1 ||
      routingEvidence.kind !== 'non-deployable-preview-routing-evidence' ||
      routingEvidence.deploymentAuthorized !== false ||
      routingEvidence.vercelConfigSha256 !== digest(trustedVercelConfigBytes) ||
      routingEvidence.generatedConfigSha256 !== digest(configBytes) ||
      routingEvidence.rewrites !== 16 ||
      JSON.stringify(routingEvidence.headerNames) !== JSON.stringify(requiredHeaders)) {
    throw new Error('Preview routing evidence or trusted Vercel config digest mismatch');
  }
  let config;
  try { config = JSON.parse(configBytes.toString('utf8')); }
  catch { throw new Error('Malformed static routing configuration'); }
  if (config?.version !== 3 || !Array.isArray(config.routes) ||
      Object.keys(config).some(key => key !== 'version' && key !== 'routes') ||
      config.routes.filter(route =>
        route?.dest === '/index.html' || route?.dest === '/index.html?path=$1').length !== 16 ||
      !config.routes.some(route => route?.handle === 'filesystem') ||
      !config.routes.some(route =>
        route?.headers?.['X-Frame-Options'] === 'DENY' &&
        route?.headers?.['X-Content-Type-Options'] === 'nosniff')) {
    throw new Error('Incomplete or unexpected Build Output API v3 routing');
  }
  // Candidate source can forge BOTH the config and its unsigned hash evidence.
  // Recompute from trusted, fixed high-level config rather than treating that
  // hash as proof of routing behavior. No untrusted routing code is executed.
  let canonical;
  try {
    const highLevel = JSON.parse(trustedVercelConfigBytes.toString('utf8'));
    canonical = preparePreviewRoutes(highLevel, trustedVercelConfigBytes).serialized;
  } catch {
    throw new Error('Trusted Preview routing configuration is unsupported');
  }
  if (!Buffer.from(canonical, 'utf8').equals(configBytes)) {
    throw new Error('Prebuilt routes do not match trusted Vercel configuration');
  }
  return config;
}

export async function assembleVerifiedStaticOutput({
  archive, archiveSha256, evidence, inventory, expected,
  configBytes, routingEvidence, trustedVercelConfigBytes, outputRoot,
}) {
  verifyArchivedBuild({ archive, archiveSha256, evidence, inventory, expected });
  verifyPreviewRoutingEvidence({ configBytes, routingEvidence, trustedVercelConfigBytes });
  // The parser has already bounded expansion, checked checksums and refused
  // symlinks, path traversal, extension records and duplicate archive entries.
  const { files, data } = inspectGzipTar(archive, undefined, true);
  if (JSON.stringify(files) !== JSON.stringify(inventory.files))
    throw new Error('Archive inventory changed during static package assembly');
  const root = resolve(outputRoot);
  // Exclusive creation: never write into an existing path/symlink or clone.
  await mkdir(root);
  const staticRoot = join(root, '.vercel', 'output', 'static');
  const configPath = join(root, '.vercel', 'output', 'config.json');
  await mkdir(staticRoot, { recursive: true });
  for (const file of files) {
    const bytes = data.get(file.name);
    if (!bytes || bytes.length !== file.bytes || digest(bytes) !== file.sha256)
      throw new Error('Static output file bytes differ from verified CI inventory');
    const dest = join(staticRoot, file.name);
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, bytes, { flag: 'wx' });
  }
  await writeFile(configPath, configBytes, { flag: 'wx' });
  return { outputRoot: root, files: files.length, source: evidence.source,
    staticDigest: inventory.digest, configSha256: routingEvidence.generatedConfigSha256,
    deploymentAuthorized: false };
}

export async function verifyStaticOutputFiles(outputRoot, inventory) {
  for (const file of inventory.files) {
    const bytes = await readFile(join(resolve(outputRoot), '.vercel', 'output', 'static', file.name));
    if (bytes.length !== file.bytes || digest(bytes) !== file.sha256)
      throw new Error('Emitted Vercel static file changed after package assembly');
  }
  return true;
}
