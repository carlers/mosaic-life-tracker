#!/usr/bin/env node
/**
 * Local, read-only OCI Compute capacity report watcher for Singapore A1.
 * Only IAM availability-domain list and Compute capacity-report create
 * (report generation, NOT instance provisioning) may be invoked.
 * Never prints CLI stderr, profile configuration, credentials or OCIDs.
 */
import { spawnSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SHAPE = 'VM.Standard.A1.Flex';
const REGION = 'ap-singapore-1';
const OCPUS = 2;
const MEMORY_GB = 12;

export function parseCapacityWatchArgs(argv) {
  const options = { watch: false, intervalMinutes: 60, profile: null, json: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--watch') options.watch = true;
    else if (arg === '--once') options.watch = false;
    else if (arg === '--json') options.json = true;
    else if (arg === '--profile' || arg === '--interval-minutes') {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw new Error(arg + ' requires a value');
      if (arg === '--profile') {
        if (!/^[A-Za-z0-9_-]{1,64}$/.test(value)) throw new Error('Invalid profile name');
        options.profile = value;
      } else {
        if (!/^\d+$/.test(value)) throw new Error('Invalid interval');
        options.intervalMinutes = Number(value);
        if (!Number.isSafeInteger(options.intervalMinutes) ||
            options.intervalMinutes < 15 || options.intervalMinutes > 1440) {
          throw new Error('Interval must be 15-1440 minutes');
        }
      }
    } else throw new Error('Unknown argument: ' + arg);
  }
  if (!options.watch && argv.includes('--interval-minutes')) {
    throw new Error('--interval-minutes requires --watch');
  }
  return options;
}

export function extractRootAndADs(response) {
  const data = response?.data;
  if (!Array.isArray(data) || !data.length) throw new Error('Missing OCI availability domains');
  const roots = new Set(data.map(d => d?.['compartment-id'] ?? d?.compartmentId));
  if (roots.size !== 1) throw new Error('Ambiguous root tenancy');
  const root = [...roots][0];
  if (typeof root !== 'string' || !/^ocid1\.tenancy\./.test(root)) {
    throw new Error('Expected root tenancy OCID');
  }
  const ads = [...new Set(data.map(d => d?.name).filter(x =>
    typeof x === 'string' && /(^|:)AP-SINGAPORE-1-AD-\d+$/i.test(x)))];
  if (!ads.length) throw new Error('No Singapore availability domains in OCI response');
  return { root, ads: ads.sort() };
}

export function summarizeCapacityReport(response) {
  const data = response?.data;
  const raw = data?.['shape-availabilities'] ?? data?.shapeAvailabilities;
  if (!Array.isArray(raw) || !raw.length) return { status: 'UNKNOWN', availableCount: null };
  const rows = raw.filter(r => (r?.['instance-shape'] ?? r?.instanceShape) === SHAPE);
  if (!rows.length) return { status: 'UNKNOWN', availableCount: null };
  const results = rows.map(r => {
    const status = r?.['availability-status'] ?? r?.availabilityStatus;
    const count = r?.['available-count'] ?? r?.availableCount ?? null;
    if (!['AVAILABLE', 'OUT_OF_HOST_CAPACITY', 'HARDWARE_NOT_SUPPORTED'].includes(status)) {
      return { status: 'UNKNOWN', availableCount: null };
    }
    if (count !== null && (!Number.isSafeInteger(count) || count < 0)) {
      return { status: 'UNKNOWN', availableCount: null };
    }
    if (status === 'AVAILABLE' && count !== null && count > 0) {
      return { status, availableCount: count };
    }
    // An "AVAILABLE" status without a positive count needs confirmation,
    // not an unconditional readiness claim.
    if (status === 'AVAILABLE') return { status: 'POSSIBLE', availableCount: count };
    return { status, availableCount: count };
  });
  const positive = results.filter(r => r.status === 'AVAILABLE');
  if (positive.length) return { status: 'AVAILABLE', availableCount: positive.reduce((s, r) => s + r.availableCount, 0) };
  if (results.some(r => r.status === 'POSSIBLE')) return { status: 'POSSIBLE', availableCount: null };
  if (results.every(r => r.status === 'OUT_OF_HOST_CAPACITY')) return { status: 'OUT_OF_HOST_CAPACITY', availableCount: 0 };
  if (results.every(r => r.status === 'HARDWARE_NOT_SUPPORTED')) return { status: 'HARDWARE_NOT_SUPPORTED', availableCount: 0 };
  return { status: 'UNKNOWN', availableCount: null };
}

function executeOci(subcommand, args, options, spawn = spawnSync) {
  const allowed = new Set(['iam availability-domain list', 'compute compute-capacity-report create']);
  if (!allowed.has(subcommand.join(' '))) throw new Error('Disallowed OCI command');
  const flags = ['--region', REGION, '--no-retry', '--output', 'json'];
  if (options.profile) flags.push('--profile', options.profile);
  const result = spawn('oci', [...subcommand, ...args, ...flags], {
    encoding: 'utf8', timeout: 60000, maxBuffer: 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'], shell: false,
  });
  // OCI diagnostics can expose profile paths, identities and signed URLs.
  if (result.error || result.status !== 0) {
    throw new Error('OCI read-only CLI query failed. Check local OCI CLI configuration, profile, IAM policy and network.');
  }
  try { return JSON.parse(result.stdout); }
  catch { throw new Error('OCI CLI did not return JSON'); }
}

export function capacityCheck(options, spawn = spawnSync) {
  const { root, ads } = extractRootAndADs(executeOci(['iam', 'availability-domain', 'list'], [], options, spawn));
  const request = JSON.stringify([{
    instanceShape: SHAPE, instanceShapeConfig: { ocpus: OCPUS, memoryInGBs: MEMORY_GB },
  }]);
  const results = ads.map(ad => {
    const report = executeOci(['compute', 'compute-capacity-report', 'create'], [
      '--availability-domain', ad, '--compartment-id', root,
      '--shape-availabilities', request,
    ], options, spawn);
    const result = summarizeCapacityReport(report);
    return { availabilityDomain: ad.slice(ad.lastIndexOf(':') + 1), ...result };
  });
  return {
    checkedAt: new Date().toISOString(), region: REGION, shape: SHAPE,
    ocpus: OCPUS, memoryGB: MEMORY_GB, results,
    likelyAvailable: results.some(r => r.status === 'AVAILABLE'),
    caveat: 'Capacity reports are advisory. A report is not Always Free eligibility or a successful VM launch.',
  };
}

export async function runCapacityWatch(argv = process.argv.slice(2), {
  spawn = spawnSync, sleepImpl = sleep, log = console.log,
} = {}) {
  const options = parseCapacityWatchArgs(argv);
  let lastSignal = null;
  do {
    let result;
    try { result = capacityCheck(options, spawn); }
    catch (error) {
      // Watch should survive a transient OCI/permissions error, but never
      // interpret a failed query as capacity. Single-run errors fail closed.
      if (!options.watch) throw error;
      log(JSON.stringify({ status: 'CHECK_FAILED', reason: error.message }));
      result = null;
    }
    if (result) {
      const signal = result.results.map(r => r.availabilityDomain + ':' + r.status).join(',');
      if (options.json || signal !== lastSignal || result.likelyAvailable) {
        log(options.json ? JSON.stringify(result) :
          result.checkedAt + ' ' + result.shape + ' ' + result.ocpus + ' OCPU / ' +
          result.memoryGB + ' GB — ' + signal +
          (result.likelyAvailable ? ' — CHECK ORACLE CONSOLE NOW (not guaranteed)' : ''));
        if (result.likelyAvailable && !options.json) log('\x07');
      }
      lastSignal = signal;
      if (!options.watch) return result;
    }
    if (options.watch) await sleepImpl(options.intervalMinutes * 60000);
  } while (options.watch);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCapacityWatch().catch(e => {
    console.error(e instanceof Error ? e.message : 'OCI capacity check failed');
    process.exitCode = 1;
  });
}
