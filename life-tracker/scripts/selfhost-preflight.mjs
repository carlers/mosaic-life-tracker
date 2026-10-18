#!/usr/bin/env node
/**
 * Read-only Linux host prerequisite probe for Mosaic's isolated Appwrite self-host PoC.
 * This is not a capacity benchmark, deployment, or proof of data compatibility.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, statfsSync } from 'node:fs';
import { arch, availableParallelism, platform, totalmem } from 'node:os';
import { fileURLToPath } from 'node:url';

const GIB = 1024 ** 3;
export const APPWRITE_HOST_MINIMUM = Object.freeze({
  logicalCpus: 2,
  memoryBytes: 4 * GIB,
  swapBytes: 2 * GIB,
});

export function parseSwapTotalBytes(meminfo) {
  const match = /^SwapTotal:\s+(\d+)\s+kB\s*$/m.exec(meminfo);
  if (!match) throw new Error('SwapTotal unavailable in /proc/meminfo');
  return Number(match[1]) * 1024;
}

export function assessSelfHostPrerequisites(host) {
  const checks = [
    {
      id: 'linux',
      ok: host.platform === 'linux',
      detail: 'Linux Docker host required for this OCI-focused probe',
    },
    {
      id: 'architecture',
      ok: host.arch === 'arm64' || host.arch === 'x64',
      detail: 'Supported candidate host architectures: arm64 or x64 (full Appwrite stack unverified)',
    },
    {
      id: 'cpu',
      ok: Number.isFinite(host.logicalCpus) &&
        host.logicalCpus >= APPWRITE_HOST_MINIMUM.logicalCpus,
      detail: 'At least 2 logical CPUs (installation minimum, not a throughput guarantee)',
    },
    {
      id: 'memory',
      ok: Number.isFinite(host.memoryBytes) &&
        host.memoryBytes >= APPWRITE_HOST_MINIMUM.memoryBytes,
      detail: 'At least 4 GiB RAM (conservative interpretation of the 4 GB minimum)',
    },
    {
      id: 'swap',
      ok: Number.isFinite(host.swapBytes) &&
        host.swapBytes >= APPWRITE_HOST_MINIMUM.swapBytes,
      detail: 'At least 2 GiB swap',
    },
    {
      id: 'docker',
      ok: host.dockerCli === true,
      detail: 'Docker CLI installed',
    },
    {
      id: 'compose',
      ok: host.dockerComposeV2 === true,
      detail: 'Docker Compose v2 available',
    },
    {
      id: 'daemon',
      ok: host.dockerDaemon === true,
      detail: 'Docker daemon reachable by current operator',
    },
  ];
  return {
    meetsPrerequisites: checks.every((check) => check.ok),
    checks,
  };
}

function commandSucceeds(args) {
  const result = spawnSync('docker', args, {
    encoding: 'utf8',
    timeout: 8000,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return result.status === 0 && !result.error;
}

function readSwap() {
  try {
    return parseSwapTotalBytes(readFileSync('/proc/meminfo', 'utf8'));
  } catch {
    return null;
  }
}

function freeDiskBytes(path) {
  try {
    const stats = statfsSync(path, { bigint: true });
    return Number(stats.bavail * stats.bsize);
  } catch {
    return null;
  }
}

export function probeSelfHost() {
  const host = {
    platform: platform(),
    arch: arch(),
    logicalCpus: availableParallelism(),
    memoryBytes: totalmem(),
    swapBytes: readSwap(),
    dockerCli: commandSucceeds(['--version']),
    dockerComposeV2: commandSucceeds(['compose', 'version', '--short']),
    dockerDaemon: commandSucceeds(['info', '--format', '{{.ServerVersion}}']),
  };
  const assessment = assessSelfHostPrerequisites(host);
  return {
    ...assessment,
    host,
    freeDiskBytes: freeDiskBytes(process.cwd()),
    cautions: [
      'Passing checks only proves minimum host prerequisites; it does not validate Docker images, Appwrite Functions, performance, backup restores or privacy.',
      'Disk space and OCI Always Free billing eligibility require separate review; no fixed Appwrite production disk minimum is assumed.',
      'Do not point Mosaic Preview or Production at this host until isolated synthetic acceptance and explicit approvals.',
    ],
  };
}

export function runSelfHostPreflight(args = process.argv.slice(2)) {
  if (args.includes('--help') && args.length === 1) {
    console.log('Usage: npm run selfhost:preflight -- [--json] (read-only; Linux host)');
    return { help: true };
  }
  if (args.some((arg) => arg !== '--json') || args.length > 1) {
    throw new Error('Only --json or --help are supported');
  }
  const result = probeSelfHost();
  if (args.includes('--json')) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    for (const check of result.checks) {
      console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.id}: ${check.detail}`);
    }
    console.log(`Disk available on working filesystem: ${result.freeDiskBytes === null
      ? 'unknown' : (result.freeDiskBytes / GIB).toFixed(1) + ' GiB'}`);
    console.log(result.meetsPrerequisites
      ? 'Minimum host prerequisites met. Full-stack synthetic testing remains required.'
      : 'Minimum host prerequisites NOT met. Do not deploy yet.');
    for (const caution of result.cautions) console.log(`NOTE ${caution}`);
  }
  if (!result.meetsPrerequisites) process.exitCode = 1;
  return result;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    runSelfHostPreflight();
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Preflight failed');
    process.exitCode = 1;
  }
}
