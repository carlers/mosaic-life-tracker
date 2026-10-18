#!/usr/bin/env node
/**
 * Read-only Appwrite container platform audit for a GENERATED disposable
 * Docker Compose stack. No pulls, builds, container starts, or remote writes.
 *
 * Docker manifest inspection is experimental and registry-dependent. Unknown
 * results are never reported as supported.
 */
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TARGETS = new Set(['arm64', 'amd64']);

export function normalizeArchitecture(value) {
  if (value === 'x64' || value === 'x86_64') return 'amd64';
  if (value === 'aarch64') return 'arm64';
  return value;
}

export function parseManifestPlatforms(manifest) {
  // --verbose emits an array of descriptors for multi-platform images.
  // A regular index contains manifests[].platform; single-image manifests
  // may lack architecture metadata and must remain unverified.
  const rows = Array.isArray(manifest)
    ? manifest
    : Array.isArray(manifest?.manifests)
      ? manifest.manifests
      : [manifest];
  const found = new Set();
  for (const row of rows) {
    const platform = row?.platform ?? row?.Platform ??
      row?.descriptor?.platform ?? row?.Descriptor?.platform;
    if (!platform || typeof platform !== 'object') continue;
    const os = platform.os ?? platform.OS;
    const architecture = normalizeArchitecture(platform.architecture ?? platform.Architecture);
    if (os && architecture) found.add(String(os).toLowerCase() + '/' + architecture);
  }
  return [...found].sort();
}

export function auditComposeServices(services, imagePlatforms, targetArch = 'arm64') {
  const arch = normalizeArchitecture(targetArch);
  if (!TARGETS.has(arch)) throw new Error('Target architecture must be arm64 or amd64');
  if (!services || typeof services !== 'object' || Array.isArray(services) ||
      Object.keys(services).length === 0) {
    throw new Error('No Compose services supplied');
  }
  const rows = Object.entries(services).map(([name, service]) => {
    const image = typeof service?.image === 'string' ? service.image : null;
    const configured = typeof service?.platform === 'string'
      ? service.platform.toLowerCase().replace('linux/x86_64', 'linux/amd64')
        .replace('linux/aarch64', 'linux/arm64')
      : null;
    const platforms = image ? (imagePlatforms[image] ?? []) : [];
    let status = 'unverified';
    let reason = 'Image reference or platform metadata unavailable';
    if (configured && configured !== 'linux/' + arch &&
        !configured.startsWith('linux/' + arch + '/')) {
      status = 'unsupported';
      reason = 'Compose pins an incompatible platform';
    } else if (image && platforms.includes('linux/' + arch)) {
      status = 'supported';
      reason = 'Registry manifest advertises the requested Linux architecture';
    } else if (platforms.length) {
      status = 'unsupported';
      reason = 'Requested Linux architecture is absent from registry manifest';
    }
    return { service: name, image, configuredPlatform: configured,
      advertisedPlatforms: platforms, status, reason };
  });
  return {
    target: 'linux/' + arch,
    outcome: rows.every(row => row.status === 'supported') ? 'pass' : 'blocked',
    services: rows,
    notes: [
      'Manifest support is necessary but not sufficient for successful Appwrite execution.',
      'Dynamically spawned Appwrite Function/runtime images are not included unless supplied with --image.',
      'No images were pulled, built or started; no credentials or Compose environment were printed.',
    ],
  };
}

export function parseAuditArgs(argv) {
  if (argv.length === 1 && argv[0] === '--help') return { help: true };
  const options = { compose: null, architecture: 'arm64', images: [], json: false };
  for (let index = 0; index < argv.length; index++) {
    const name = argv[index];
    if (name === '--json') {
      options.json = true;
    } else if (['--compose', '--arch', '--image'].includes(name)) {
      const value = argv[++index];
      if (!value || value.startsWith('--')) throw new Error(name + ' requires a value');
      if (name === '--compose') {
        if (options.compose) throw new Error('Specify only one --compose path');
        options.compose = value;
      } else if (name === '--arch') options.architecture = normalizeArchitecture(value);
      else options.images.push(value);
    } else throw new Error('Unknown argument: ' + name);
  }
  if (!TARGETS.has(options.architecture)) throw new Error('Target architecture must be arm64 or amd64');
  if (!options.compose && !options.images.length) {
    throw new Error('Pass --compose <generated-compose.yml> and/or --image <image:tag>');
  }
  return options;
}

function docker(args, timeoutMs = 30000) {
  const result = spawnSync('docker', args, {
    encoding: 'utf8', timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  // Do not include Docker stderr: Compose error output can contain secrets
  // interpolated from .env, even though this tool never prints config.
  if (result.error || result.status !== 0) return null;
  return result.stdout;
}

export function runImageAudit(argv = process.argv.slice(2)) {
  const options = parseAuditArgs(argv);
  if (options.help) {
    console.log('Usage: npm run selfhost:images -- --compose <generated-compose.yml> [--arch arm64|amd64] [--image <runtime-image>] [--json]');
    return { help: true };
  }
  let services = {};
  if (options.compose) {
    const output = docker(['compose', '--file', resolve(options.compose), 'config', '--format', 'json']);
    if (!output) throw new Error('Cannot resolve Compose config; check Docker Compose v2 and the disposable configuration locally');
    let config;
    try { config = JSON.parse(output); } catch {
      throw new Error('Docker Compose did not return JSON configuration');
    }
    if (!config.services || typeof config.services !== 'object') {
      throw new Error('Docker Compose configuration contains no services');
    }
    services = config.services;
  }
  options.images.forEach((image, index) => {
    services['extra-image-' + (index + 1)] = { image };
  });
  const imagePlatforms = Object.create(null);
  const images = [...new Set(Object.values(services)
    .map(service => service?.image).filter(image => typeof image === 'string'))];
  for (const image of images) {
    const result = docker(['manifest', 'inspect', '--verbose', image], 45000);
    if (!result) {
      imagePlatforms[image] = [];
      continue;
    }
    try { imagePlatforms[image] = parseManifestPlatforms(JSON.parse(result)); }
    catch { imagePlatforms[image] = []; }
  }
  const report = auditComposeServices(services, imagePlatforms, options.architecture);
  if (options.json) console.log(JSON.stringify(report, null, 2));
  else {
    console.log('Target ' + report.target + ': ' + report.outcome.toUpperCase());
    for (const row of report.services) {
      console.log(row.status.toUpperCase() + ' ' + row.service + ' ' +
        (row.image ?? '(no image)') + ': ' + row.reason);
    }
    report.notes.forEach(note => console.log('NOTE ' + note));
  }
  if (report.outcome !== 'pass') process.exitCode = 1;
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { runImageAudit(); }
  catch (error) {
    console.error(error instanceof Error ? error.message : 'Image audit failed');
    process.exitCode = 2;
  }
}
