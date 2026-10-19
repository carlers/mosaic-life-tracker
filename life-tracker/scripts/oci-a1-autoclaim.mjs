#!/usr/bin/env node
// #975: staged, opt-in Singapore OCI A1 claim controller. NOT app runtime.
// It makes no launch calls unless all explicit gates pass.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { capacityCheck } from './oci-capacity-watch.mjs';

export const SPEC = Object.freeze({
  region: 'ap-singapore-1', shape: 'VM.Standard.A1.Flex',
  ocpus: 2, memoryGB: 12, bootGB: 50,
  name: 'mosaic-appwrite-test',
});

const COMMANDS = new Set([
  'compute instance launch',
  'compute image get', 'compute image-shape-compatibility-entry list',
  'network subnet get',
]);

export function validateConfig(config) {
  for (const kind of ['compartment', 'subnet', 'image']) {
    const value = config[kind + 'Id'];
    if (typeof value !== 'string' ||
        !new RegExp('^ocid1\\.' + kind + '\\.oc1\\.[a-z0-9.]+$').test(value)) {
      throw new Error('Dedicated ' + kind + ' OCID required');
    }
  }
  if (config.freeTierConfirmed !== 'CONFIRMED' ||
      config.quotaConfirmed !== 'CONFIRMED') {
    throw new Error('Explicit Always Free and dedicated-compartment quota checks required');
  }
  const pub = readFileSync(config.sshPublicKeyFile, 'utf8').trim();
  if (!/^(ssh-ed25519|ssh-rsa) [A-Za-z0-9+/]+={0,3}(?: [^\r\n]*)?$/.test(pub) ||
      pub.length > 2000) {
    throw new Error('Missing or invalid public SSH key');
  }
}

// A successful OCI CLI instance-list call can emit zero bytes on an empty
// compartment. Use the OCI Python SDK's explicit paginated result instead;
// absent/malformed metadata is never proof that the compartment has no A1 VM.
export function readInstanceInventory(compartmentId, spawn = spawnSync) {
  const python = [
    'import json, os, oci',
    'config = oci.config.from_file()',
    'client = oci.core.ComputeClient(config, retry_strategy=oci.retry.NoneRetryStrategy())',
    'instances = oci.pagination.list_call_get_all_results(',
    '    client.list_instances, compartment_id=os.environ["MOSAIC_A1_INVENTORY_COMPARTMENT"]).data',
    'print(json.dumps({"data": [{"shape": item.shape} for item in instances]}))',
  ].join('\n');
  const result = spawn('python', ['-c', python], {
    encoding: 'utf8', timeout: 90000, maxBuffer: 2 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'], shell: false,
    env: { ...process.env, MOSAIC_A1_INVENTORY_COMPARTMENT: compartmentId },
  });
  // Do not log OCI stderr, instance identifiers or private signing information.
  if (result.error || result.status !== 0) {
    throw new Error('OCI inventory verification failed');
  }
  let inventory;
  try { inventory = JSON.parse(result.stdout); }
  catch { throw new Error('OCI inventory JSON unavailable'); }
  if (!Array.isArray(inventory?.data) ||
      !inventory.data.every(item => typeof item?.shape === 'string' && item.shape.length > 0)) {
    throw new Error('OCI inventory metadata invalid');
  }
  return inventory;
}

export function existingA1(instanceList) {
  if (!Array.isArray(instanceList?.data) ||
      !instanceList.data.every(x => typeof x?.shape === 'string' && x.shape.length > 0)) {
    throw new Error('Cannot verify existing VMs');
  }
  return instanceList.data.some(x => x.shape === SPEC.shape);
}

export function validateImageAndSubnet(image, compatibility, subnet, subnetId) {
  const data = image?.data;
  if (!data || !Array.isArray(compatibility?.data) || !subnet?.data) {
    throw new Error('Image or subnet metadata unavailable');
  }
  const os = data['operating-system'] ?? data.operatingSystem;
  const version = data['operating-system-version'] ?? data.operatingSystemVersion;
  const state = data['lifecycle-state'] ?? data.lifecycleState;
  if (!/ubuntu/i.test(String(os)) || !String(version).startsWith('24.04') ||
      state !== 'AVAILABLE' ||
      !compatibility.data.some(x => x.shape === SPEC.shape)) {
    throw new Error('Expected available Ubuntu 24.04 image compatible with A1');
  }
  const net = subnet.data;
  if (net.id !== subnetId || (net['lifecycle-state'] ?? net.lifecycleState) !== 'AVAILABLE') {
    throw new Error('Subnet not verified as AVAILABLE');
  }
  // Provision without public IPv4; network ingress is reviewed later.
}

export function buildLaunchArgs(config, ad) {
  if (typeof ad !== 'string' || !/(^|:)AP-SINGAPORE-1-AD-1$/i.test(ad)) {
    throw new Error('Unexpected Singapore availability domain');
  }
  return [
    '--compartment-id', config.compartmentId,
    '--availability-domain', ad,
    '--shape', SPEC.shape,
    '--shape-config', JSON.stringify({ ocpus: SPEC.ocpus, memoryInGBs: SPEC.memoryGB }),
    '--boot-volume-size-in-gbs', String(SPEC.bootGB),
    '--image-id', config.imageId,
    '--subnet-id', config.subnetId,
    '--ssh-authorized-keys-file', config.sshPublicKeyFile,
    '--assign-public-ip', 'false',
    '--display-name', SPEC.name,
    '--freeform-tags', JSON.stringify({ 'mosaic-purpose': 'a1-singapore-autoclaim' }),
  ];
}

function oci(parts, args, spawn) {
  const cmd = parts.join(' ');
  if (!COMMANDS.has(cmd)) throw new Error('Disallowed OCI command');
  const result = spawn('oci', [...parts, ...args,
    '--region', SPEC.region, '--no-retry', '--output', 'json'], {
    encoding: 'utf8', timeout: 90000, maxBuffer: 2 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'], shell: false,
  });
  // Never log raw stderr, stdout or OCIDs on error.
  if (result.error || result.status !== 0) {
    throw new Error(cmd === 'compute instance launch'
      ? 'OCI declined this one launch attempt (capacity/permission/quota); no fallback or retry.'
      : 'OCI safety check failed: ' + cmd);
  }
  try { return JSON.parse(result.stdout); }
  catch { throw new Error('Malformed OCI JSON for ' + cmd); }
}

export function claimA1({
  mode = 'observe', enabled = false, context = {}, config = {},
  spawn = spawnSync, capacity = capacityCheck,
} = {}) {
  if (!['observe', 'launch'].includes(mode)) throw new Error('Invalid claim mode');
  const report = capacity({ profile: null }, spawn);
  const matching = report.results?.filter(r =>
    r.availabilityDomain === 'AP-SINGAPORE-1-AD-1' &&
    r.status === 'AVAILABLE' && Number.isSafeInteger(r.availableCount) &&
    r.availableCount > 0) ?? [];
  const status = { ...SPEC, capacity: (report.results ?? []).map(
    r => ({ ad: r.availabilityDomain, status: r.status })),
    outcome: matching.length ? 'capacity_possible' : 'capacity_unavailable' };
  if (!matching.length || mode === 'observe' || !enabled) return status;
  if (!['carlers/mosaic-life-tracker', 'carlers/mosaic-oci-a1-scheduler'].includes(context.repository) ||
      context.ref !== 'refs/heads/main' || context.eventName !== 'schedule') {
    throw new Error('Launch only allowed for scheduled workflow on trusted default branch');
  }
  validateConfig(config);
  const inventory = readInstanceInventory(config.compartmentId, spawn);
  // Includes STOPPED and TERMINATED so no second VM is intentionally launched.
  if (existingA1(inventory)) return { ...status, outcome: 'already_present' };
  validateImageAndSubnet(
    oci(['compute', 'image', 'get'], ['--image-id', config.imageId], spawn),
    oci(['compute', 'image-shape-compatibility-entry', 'list'],
      ['--image-id', config.imageId, '--all'], spawn),
    oci(['network', 'subnet', 'get'], ['--subnet-id', config.subnetId], spawn),
    config.subnetId,
  );
  // Exactly one launch, no fallback to a billable shape, public IP or larger disk.
  const instance = oci(['compute', 'instance', 'launch'],
    buildLaunchArgs(config, matching[0].availabilityDomain), spawn);
  if (!instance?.data?.id || instance.data.shape !== SPEC.shape) {
    throw new Error('Launch returned unexpected metadata: inspect OCI Console, DO NOT retry');
  }
  return { ...status, outcome: 'instance_created' };
}

export function runFromEnv(env = process.env) {
  const enabled = env.MOSAIC_OCI_AUTOLAUNCH === 'true';
  const result = claimA1({
    mode: enabled ? 'launch' : 'observe', enabled,
    context: { repository: env.GITHUB_REPOSITORY, ref: env.GITHUB_REF,
      eventName: env.GITHUB_EVENT_NAME },
    config: {
      compartmentId: env.MOSAIC_OCI_COMPARTMENT_OCID,
      subnetId: env.MOSAIC_OCI_SUBNET_OCID,
      imageId: env.MOSAIC_OCI_IMAGE_OCID,
      sshPublicKeyFile: env.MOSAIC_OCI_SSH_PUBLIC_KEY_FILE,
      freeTierConfirmed: env.MOSAIC_OCI_FREE_TIER_CONFIRMED,
      quotaConfirmed: env.MOSAIC_OCI_QUOTA_CONFIRMED,
    },
  });
  console.log(JSON.stringify(result));
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { runFromEnv(); }
  catch (err) {
    console.error(err instanceof Error ? err.message : 'OCI claim failed');
    process.exitCode = 1;
  }
}
