import { afterAll, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  claimA1, SPEC, buildLaunchArgs, existingA1, readInstanceInventory,
  validateImageAndSubnet, validateConfig, classifyLaunchFailure,
} from '../../scripts/oci-a1-autoclaim.mjs';

const compartmentId = 'ocid1.compartment.oc1..synthetic';
const imageId = 'ocid1.image.oc1..synthetic';
const subnetId = 'ocid1.subnet.oc1..synthetic';
const ad = 'AP-SINGAPORE-1-AD-1';
const cap = (status = 'AVAILABLE', count = 1) => ({
  results: [{ availabilityDomain: ad, status, availableCount: count }],
});
const context = {
  repository: 'carlers/mosaic-life-tracker',
  ref: 'refs/heads/main', eventName: 'schedule',
};
const dir = mkdtempSync(join(tmpdir(), 'mosaic-a1-'));
const sshPublicKeyFile = join(dir, 'synthetic.pub');
writeFileSync(sshPublicKeyFile, 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIEpUb3JvcGVhY3RybG9uZw== testing@local\n');
const config = {
  compartmentId, imageId, subnetId, sshPublicKeyFile,
  freeTierConfirmed: 'CONFIRMED', quotaConfirmed: 'CONFIRMED',
};
const results = {
  'compute instance list': { data: [] },
  'compute image get': { data: {
    'operating-system': 'Canonical Ubuntu',
    'operating-system-version': '24.04',
    'lifecycle-state': 'AVAILABLE',
  } },
  'compute image-shape-compatibility-entry list': { data: [{ shape: SPEC.shape }] },
  'network subnet get': { data: { id: subnetId, 'lifecycle-state': 'AVAILABLE' } },
  'compute instance launch': { data: { id: 'ocid1.instance.oc1..synthetic', shape: SPEC.shape } },
};
function mockOci(overrides = {}) {
  return vi.fn((exe, args, opts) => {
    expect(opts.shell).toBe(false);
    if (exe === 'python') {
      expect(args[0]).toBe('-c');
      expect(args[1]).toContain('list_call_get_all_results');
      expect(opts.env.MOSAIC_A1_INVENTORY_COMPARTMENT).toBe(compartmentId);
      return { status: 0,
        stdout: JSON.stringify({ ...results, ...overrides }['compute instance list']), stderr: '' };
    }
    expect(exe).toBe('oci');
    expect(args).toContain('--no-retry');
    const key = args.slice(0, args.indexOf('--compartment-id') > 0
      ? args.indexOf('--compartment-id') : args.indexOf('--image-id') > 0
        ? args.indexOf('--image-id') : args.indexOf('--subnet-id') > 0
          ? args.indexOf('--subnet-id') : 3).join(' ');
    const name = [...Object.keys(results)].find(n => args.slice(0, n.split(' ').length).join(' ') === n);
    if (!name) throw new Error('Unexpected OCI command ' + key);
    const payload = { ...results, ...overrides }[name];
    return { status: 0, stdout: JSON.stringify(payload), stderr: '' };
  });
}

describe('OCI A1 GitHub staged single-VM claim safety (#975)', () => {
  it('uses only fixed Always Free candidate resources and private IP', () => {
    const args = buildLaunchArgs(config, ad);
    const field = name => args[args.indexOf(name) + 1];
    expect(field('--shape')).toBe('VM.Standard.A1.Flex');
    expect(JSON.parse(field('--shape-config'))).toEqual({ ocpus: 2, memoryInGBs: 12 });
    expect(field('--boot-volume-size-in-gbs')).toBe('50');
    expect(field('--assign-public-ip')).toBe('false');
    expect(field('--compartment-id')).toBe(compartmentId);
    expect(field('--image-id')).toBe(imageId);
    expect(field('--subnet-id')).toBe(subnetId);
    expect(() => buildLaunchArgs(config, 'PHX-AD-1')).toThrow();
  });
  it('does not call any provisioning command when capacity is absent or mode observe', () => {
    const spawn = vi.fn();
    expect(claimA1({ capacity: () => cap('OUT_OF_HOST_CAPACITY', 0), spawn })
      .outcome).toBe('capacity_unavailable');
    expect(claimA1({ capacity: () => cap(), spawn })
      .outcome).toBe('capacity_possible');
    expect(claimA1({ mode: 'launch', capacity: () => cap(), spawn })
      .outcome).toBe('capacity_possible');
    expect(spawn).not.toHaveBeenCalled();
  });
  it('blocks launch from PRs, arbitrary branches or other repositories', () => {
    const spawn = vi.fn();
    for (const contextOverride of [
      { ref: 'refs/heads/dev' },
      { eventName: 'workflow_dispatch' },
      { repository: 'attacker/fork' },
    ]) {
      expect(() => claimA1({ mode: 'launch', enabled: true,
        context: { ...context, ...contextOverride }, config,
        capacity: () => cap(), spawn })).toThrow(/scheduled workflow/);
    }
    expect(spawn).not.toHaveBeenCalled();
  });
  it('denies missing quota confirmations and unsafe SSH keys', () => {
    expect(() => validateConfig({ ...config, freeTierConfirmed: '' })).toThrow(/quota/);
    expect(() => validateConfig({ ...config, compartmentId: 'ocid1.tenancy.oc1..root' })).toThrow(/OCID/);
    writeFileSync(sshPublicKeyFile, 'PRIVATE KEY\n');
    expect(() => validateConfig(config)).toThrow(/public SSH/);
    writeFileSync(sshPublicKeyFile, 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIEpUb3JvcGVhY3RybG9uZw== testing@local\n');
  });
  it('blocks nonterminated A1 instances but ignores fully terminated history', () => {
    expect(existingA1({ data: [{ shape: SPEC.shape, lifecycleState: 'STOPPED' }] })).toBe(true);
    expect(existingA1({ data: [{ shape: SPEC.shape, lifecycleState: 'TERMINATED' }] })).toBe(false);
    expect(existingA1({ data: [] })).toBe(false);
    expect(() => existingA1({})).toThrow();
    const spawn = mockOci({ 'compute instance list': {
      data: [{ shape: SPEC.shape, lifecycleState: 'STOPPED' }],
    } });
    expect(claimA1({ mode: 'launch', enabled: true, context, config,
      capacity: () => cap(), spawn }).outcome).toBe('already_present');
    expect(spawn.mock.calls.some(([, args]) => args.includes('launch'))).toBe(false);
  });
  it('fails closed on empty SDK stdout, errors or incomplete instance metadata', () => {
    const normal = mockOci();
    for (const inventoryResult of [
      { status: 0, stdout: '' },
      { status: 0, stdout: '{}' },
      { status: 0, stdout: '{"data":[{"shape":null}]}' },
      { status: 0, stdout: '{"data":[{"shape":"VM.Standard.A1.Flex"}]}' },
      { status: 1, stdout: '', stderr: 'SECRET_SIGNING_KEY=no-log' },
    ]) {
      const spawn = vi.fn((exe, args, opts) =>
        exe === 'python' ? inventoryResult : normal(exe, args, opts));
      expect(() => claimA1({ mode: 'launch', enabled: true, context, config,
        capacity: () => cap(), spawn })).toThrow(/inventory/i);
      expect(spawn.mock.calls.some(([, args]) => args.includes('launch'))).toBe(false);
    }
    expect(() => existingA1({ data: [{ shape: null }] })).toThrow(/verify/);
    expect(() => existingA1({ data: [{ shape: SPEC.shape }] })).toThrow(/verify/);
    expect(readInstanceInventory(compartmentId, () =>
      ({ status: 0, stdout: '{"data":[]}' }))).toEqual({ data: [] });
  });
  it('refuses wrong image, incompatible architecture and missing subnet', () => {
    expect(() => validateImageAndSubnet(
      { data: { 'operating-system': 'Oracle Linux', 'operating-system-version': '9',
        'lifecycle-state': 'AVAILABLE' } },
      results['compute image-shape-compatibility-entry list'],
      results['network subnet get'], subnetId)).toThrow();
    expect(() => validateImageAndSubnet(results['compute image get'],
      { data: [] }, results['network subnet get'], subnetId)).toThrow();
    expect(() => validateImageAndSubnet(results['compute image get'],
      results['compute image-shape-compatibility-entry list'],
      results['network subnet get'], 'ocid1.subnet.oc1..different')).toThrow();
  });
  it('one trusted scheduled attempt launches even without positive capacity telemetry', () => {
    const spawn = mockOci();
    expect(claimA1({ mode: 'launch', enabled: true, context, config,
      capacity: () => cap('POSSIBLE', null), spawn }).outcome).toBe('instance_created');
    expect(spawn.mock.calls.filter(([, args]) => args.includes('launch'))).toHaveLength(1);
    expect(spawn.mock.calls).toHaveLength(5);
  });
  it('does not retry launch failure or output sensitive OCI CLI stderr', () => {
    const spawn = mockOci();
    spawn.mockImplementation((exe, args) => args.includes('launch')
      ? { status: 1, stdout: '', stderr: 'key_file=private-secret' }
      : { status: 0, stdout: JSON.stringify(results[
          exe === 'python' ? 'compute instance list' :
            [...Object.keys(results)].find(n => args.slice(0, n.split(' ').length).join(' ') === n)
        ]), stderr: '' });
    expect(() => claimA1({ mode: 'launch', enabled: true, context, config,
      capacity: () => cap(), spawn })).toThrow(/unclassified error/);
    expect(spawn.mock.calls.filter(([, args]) => args.includes('launch'))).toHaveLength(1);
  });
  it('ignores advisory capacity on a trusted launch and detects an existing VM first', () => {
    const capacity = vi.fn(() => cap('POSSIBLE', null));
    const spawn = mockOci({ 'compute instance list':
      { data: [{ shape: SPEC.shape, lifecycleState: 'PROVISIONING' }] } });
    expect(claimA1({ mode: 'launch', enabled: true, context, config,
      capacity, spawn }).outcome).toBe('already_present');
    expect(capacity).not.toHaveBeenCalled();
    expect(spawn.mock.calls.some(([, args]) => args.includes('launch'))).toBe(false);
  });
  it('allows replacing a fully terminated historical A1 but not a stopped instance', () => {
    const spawn = mockOci({ 'compute instance list':
      { data: [{ shape: SPEC.shape, lifecycleState: 'TERMINATED' }] } });
    expect(claimA1({ mode: 'launch', enabled: true, context, config,
      capacity: () => cap('OUT_OF_HOST_CAPACITY', 0), spawn }).outcome).toBe('instance_created');
    expect(spawn.mock.calls.filter(([, args]) => args.includes('launch'))).toHaveLength(1);
  });
  it('classifies OCI failures without leaking diagnostic secrets', () => {
    expect(classifyLaunchFailure({ status: 1, stderr: '500 InternalError: Out of host capacity' }))
      .toBe('capacity_unavailable');
    expect(classifyLaunchFailure({ status: 1, stderr: '429 TooManyRequests' }))
      .toBe('rate_limited');
    for (const [error, expected] of [
      ['LimitExceeded secret-key=private-value', /service limit or quota/],
      ['NotAuthorizedOrNotFound secret-key=private-value', /IAM or invalid/],
      ['unknown secret-key=private-value', /unclassified error/],
    ]) {
      expect(() => classifyLaunchFailure({ status: 1, stderr: error })).toThrow(expected);
      expect(() => classifyLaunchFailure({ status: 1, stderr: error })).not.toThrow(/private-value/);
    }
    expect(() => classifyLaunchFailure({ status: null, error: new Error('sensitive') }))
      .toThrow(/uncertain/);
  });
  it('returns actual capacity or throttling failure without retrying the OCI launch', () => {
    for (const [diagnostic, expected] of [
      ['500 InternalError: Out of host capacity', 'capacity_unavailable'],
      ['429 TooManyRequests', 'rate_limited'],
    ]) {
      const normal = mockOci();
      const spawn = vi.fn((exe, args, options) => args.includes('launch')
        ? { status: 1, stdout: '', stderr: diagnostic }
        : normal(exe, args, options));
      expect(claimA1({ mode: 'launch', enabled: true, context, config,
        capacity: () => cap('POSSIBLE', null), spawn }).outcome).toBe(expected);
      expect(spawn.mock.calls.filter(([, args]) => args.includes('launch'))).toHaveLength(1);
    }
  });
  it('never claims creation without an OCI instance ID and matching shape', () => {
    for (const data of [
      { shape: SPEC.shape },
      { id: '', shape: SPEC.shape },
      { id: 'ocid1.instance.oc1..synthetic', shape: 'VM.Standard.E2.1.Micro' },
    ]) {
      const spawn = mockOci({ 'compute instance launch': { data } });
      expect(() => claimA1({ mode: 'launch', enabled: true, context, config, spawn }))
        .toThrow(/unexpected metadata/);
      expect(spawn.mock.calls.filter(([, args]) => args.includes('launch'))).toHaveLength(1);
    }
  });
  it('keeps manual-dispatch/observe mode from launching even when enabled', () => {
    const capacity = vi.fn(() => cap());
    const spawn = vi.fn();
    expect(claimA1({ mode: 'observe', enabled: true, capacity, spawn,
      context: { ...context, eventName: 'workflow_dispatch' }, config })
      .outcome).toBe('capacity_possible');
    expect(capacity).toHaveBeenCalledTimes(1);
    expect(spawn).not.toHaveBeenCalled();
  });
  it('permits only the owner dedicated scheduler repository on its default branch schedule', () => {
    const spawn = mockOci();
    expect(claimA1({
      mode: 'launch', enabled: true,
      context: { ...context, repository: 'carlers/mosaic-oci-a1-scheduler' },
      config, capacity: () => cap(), spawn,
    }).outcome).toBe('instance_created');
    expect(spawn.mock.calls.filter(([, args]) => args.includes('launch'))).toHaveLength(1);
    for (const override of [
      { repository: 'carlers/mosaic-oci-a1-scheduler-fork' },
      { repository: 'different/mosaic-oci-a1-scheduler' },
      { repository: 'carlers/mosaic-oci-a1-scheduler', ref: 'refs/heads/preview' },
      { repository: 'carlers/mosaic-oci-a1-scheduler', eventName: 'workflow_dispatch' },
    ]) {
      const denied = mockOci();
      expect(() => claimA1({
        mode: 'launch', enabled: true, context: { ...context, ...override },
        config, capacity: () => cap(), spawn: denied,
      })).toThrow(/scheduled workflow/);
      expect(denied).not.toHaveBeenCalled();
    }
  });
  it('keeps the independent private scheduler opt-in and pinned to reviewed source', () => {
    const template = readFileSync(
      new URL('../../ops/oci-a1-scheduler/.github/workflows/oci-a1-autoclaim.yml', import.meta.url), 'utf8',
    );
    expect(template).toContain("github.repository == 'carlers/mosaic-oci-a1-scheduler'");
    expect(template).toContain('github.event.repository.private == true');
    expect(template).toContain("github.ref == 'refs/heads/main'");
    // The normal two checks per hour are always eligible; extra ten only
    // when the operator explicitly accepts 5-minute GitHub billing exposure.
    expect(template).toContain("cron: '17,47 * * * *'");
    expect(template).toContain("cron: '2,7,12,22,27,32,37,42,52,57 * * * *'");
    const crons = [...template.matchAll(/^ {4}- cron: '([^']+)'$/gm)].map(m => m[1]);
    expect(crons).toHaveLength(2);
    const minutes = crons.flatMap(cron => cron.split(' ')[0].split(',').map(Number))
      .sort((a, b) => a - b);
    expect(minutes).toEqual(Array.from({ length: 12 }, (_, i) => 2 + i * 5));
    expect(template).toContain("github.event.schedule == '17,47 * * * *'");
    expect(template).toContain("vars.MOSAIC_OCI_FAST_POLL == 'true'");
    expect(template).toContain("github.event_name == 'workflow_dispatch'");
    expect(template).toContain("MOSAIC_OCI_AUTOLAUNCH: ${{ vars.MOSAIC_OCI_AUTOLAUNCH || 'false' }}");
    expect(template).toContain('repository: carlers/mosaic-life-tracker');
    expect(template).toContain('MOSAIC_CONTROLLER_SHA: REPLACE_WITH_ACCEPTED_STABLE_SHA');
    expect(template).toContain('git -C mosaic-source rev-parse HEAD');
    expect(template).toContain('node mosaic-source/life-tracker/scripts/oci-a1-autoclaim.mjs');
    expect(template).not.toContain('cancel-in-progress: true');
    for (const [key, fallback] of [
      ['MOSAIC_OCI_AUTOLAUNCH', 'false'],
      ['MOSAIC_OCI_FREE_TIER_CONFIRMED', 'NO'],
      ['MOSAIC_OCI_QUOTA_CONFIRMED', 'NO'],
    ]) {
      expect(template).toContain("      " + key + ": ${{ vars." + key + " || '" + fallback + "' }}");
    }
  });
  it('wires the three operator opt-in variables to literal controller environment names', () => {
    const workflow = readFileSync(
      new URL('../../../.github/workflows/oci-a1-autoclaim.yml', import.meta.url), 'utf8',
    );
    for (const [key, fallback] of [
      ['MOSAIC_OCI_AUTOLAUNCH', 'false'],
      ['MOSAIC_OCI_FREE_TIER_CONFIRMED', 'NO'],
      ['MOSAIC_OCI_QUOTA_CONFIRMED', 'NO'],
    ]) {
      expect(workflow).toContain("      " + key + ": ${{ vars." + key + " || '" + fallback + "' }}");
    }
    expect(workflow).not.toContain('MOSAIC_OCI_${{');
  });
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));
