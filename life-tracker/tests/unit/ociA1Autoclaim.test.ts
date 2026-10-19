import { afterAll, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  claimA1, SPEC, buildLaunchArgs, existingA1,
  validateImageAndSubnet, validateConfig,
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
    expect(exe).toBe('oci');
    expect(opts.shell).toBe(false);
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
  it('blocks any other A1 instance in dedicated compartment, even stopped or terminated', () => {
    expect(existingA1({ data: [{ shape: SPEC.shape, 'lifecycle-state': 'STOPPED' }] })).toBe(true);
    expect(existingA1({ data: [{ shape: SPEC.shape, 'lifecycle-state': 'TERMINATED' }] })).toBe(true);
    expect(existingA1({ data: [] })).toBe(false);
    expect(() => existingA1({})).toThrow();
    const spawn = mockOci({ 'compute instance list': {
      data: [{ shape: SPEC.shape, 'lifecycle-state': 'STOPPED' }],
    } });
    expect(claimA1({ mode: 'launch', enabled: true, context, config,
      capacity: () => cap(), spawn }).outcome).toBe('already_present');
    expect(spawn.mock.calls.some(([, args]) => args.includes('launch'))).toBe(false);
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
  it('one positive capacity report permits exactly one fixed launch and no retry', () => {
    const spawn = mockOci();
    expect(claimA1({ mode: 'launch', enabled: true, context, config,
      capacity: () => cap(), spawn }).outcome).toBe('instance_created');
    expect(spawn.mock.calls.filter(([, args]) => args.includes('launch'))).toHaveLength(1);
    expect(spawn.mock.calls).toHaveLength(5);
  });
  it('does not retry launch failure or output sensitive OCI CLI stderr', () => {
    const spawn = mockOci();
    spawn.mockImplementation((exe, args) => args.includes('launch')
      ? { status: 1, stdout: '', stderr: 'key_file=private-secret' }
      : { status: 0, stdout: JSON.stringify(results[
          [...Object.keys(results)].find(n => args.slice(0, n.split(' ').length).join(' ') === n)
        ]), stderr: '' });
    expect(() => claimA1({ mode: 'launch', enabled: true, context, config,
      capacity: () => cap(), spawn })).toThrow(/no fallback or retry/);
    expect(spawn.mock.calls.filter(([, args]) => args.includes('launch'))).toHaveLength(1);
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
