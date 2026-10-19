import { describe, expect, it, vi } from 'vitest';
import {
  parseCapacityWatchArgs, extractRootAndADs, summarizeCapacityReport,
  capacityCheck, runCapacityWatch,
} from '../../scripts/oci-capacity-watch.mjs';

const root = 'ocid1.tenancy.oc1..synthetic';
const domains = { data: [{ name: 'Test:AP-SINGAPORE-1-AD-1', 'compartment-id': root }] };
const row = (status, count) => ({ 'instance-shape': 'VM.Standard.A1.Flex',
  'availability-status': status, 'available-count': count });
const report = (status, count) => ({ data: { 'shape-availabilities': [row(status, count)] } });

describe('OCI A1 capacity watcher (#975) is local, read-only and fail-closed', () => {
  it('permits only the fixed Singapore A1 shape and safe intervals', () => {
    expect(parseCapacityWatchArgs([])).toEqual({
      watch: false, intervalMinutes: 60, profile: null, json: false,
    });
    expect(parseCapacityWatchArgs(['--watch', '--interval-minutes', '30', '--profile', 'HOME'])).toMatchObject({
      watch: true, intervalMinutes: 30, profile: 'HOME',
    });
    for (const input of [
      ['--interval-minutes', '1'], ['--watch', '--interval-minutes', '0'],
      ['--watch', '--interval-minutes', '1441'], ['--profile', 'x;rm -rf'],
      ['--auto-launch'], ['--region', 'us-phoenix-1'], ['--watch', '--interval-minutes', 'NaN'],
    ]) expect(() => parseCapacityWatchArgs(input)).toThrow();
  });

  it('accepts only a root tenancy and Singapore availability domains', () => {
    expect(extractRootAndADs(domains)).toEqual({ root, ads: ['Test:AP-SINGAPORE-1-AD-1'] });
    expect(() => extractRootAndADs({ data: [{ name: 'X:AP-SINGAPORE-1-AD-1',
      'compartment-id': 'ocid1.compartment.oc1..x' }] })).toThrow(/root tenancy/);
    expect(() => extractRootAndADs({ data: [] })).toThrow();
    expect(() => extractRootAndADs({ data: [{ name: 'X:PHX-AD-1', 'compartment-id': root }] }))
      .toThrow(/Singapore/);
  });

  it('only treats a positive matching shape availability count as available', () => {
    expect(summarizeCapacityReport(report('AVAILABLE', 1))).toEqual({
      status: 'AVAILABLE', availableCount: 1,
    });
    expect(summarizeCapacityReport(report('AVAILABLE', 0)).status).toBe('POSSIBLE');
    expect(summarizeCapacityReport(report('AVAILABLE', null)).status).toBe('POSSIBLE');
    expect(summarizeCapacityReport(report('OUT_OF_HOST_CAPACITY', 0)).status)
      .toBe('OUT_OF_HOST_CAPACITY');
    expect(summarizeCapacityReport(report('HARDWARE_NOT_SUPPORTED', null)).status)
      .toBe('HARDWARE_NOT_SUPPORTED');
    expect(summarizeCapacityReport({ data: { 'shape-availabilities': [] } }).status).toBe('UNKNOWN');
    expect(summarizeCapacityReport({ data: { 'shape-availabilities': [row('AVAILABLE', -1)] } }).status).toBe('UNKNOWN');
    expect(summarizeCapacityReport({ data: { shapeAvailabilities: [{
      instanceShape: 'VM.Standard.A1.Flex', availabilityStatus: 'AVAILABLE', availableCount: 2,
    }] } }).status).toBe('AVAILABLE');
  });

  it('runs ONLY IAM list and capacity report; never launch, reserve or modify anything', () => {
    const spawn = vi.fn((cmd, args, options) => {
      expect(cmd).toBe('oci');
      expect(options.shell).toBe(false);
      expect(args).toContain('ap-singapore-1');
      if (args[0] === 'iam') return { status: 0, stdout: JSON.stringify(domains) };
      expect(args.slice(0, 3)).toEqual(['compute', 'compute-capacity-report', 'create']);
      const request = JSON.parse(args[args.indexOf('--shape-availabilities') + 1]);
      expect(request).toEqual([{ instanceShape: 'VM.Standard.A1.Flex',
        instanceShapeConfig: { ocpus: 2, memoryInGBs: 12 } }]);
      expect(args[args.indexOf('--compartment-id') + 1]).toBe(root);
      return { status: 0, stdout: JSON.stringify(report('AVAILABLE', 1)) };
    });
    const result = capacityCheck({ profile: 'DEFAULT' }, spawn);
    expect(result.likelyAvailable).toBe(true);
    expect(spawn).toHaveBeenCalledTimes(2);
    for (const [, args] of spawn.mock.calls) {
      expect(args.join(' ')).not.toMatch(/instance launch|capacity-reservation/);
      expect(args).toContain('--no-retry');
    }
  });

  it('does not log raw sensitive OCI CLI errors or interpret failure as capacity', () => {
    const spawn = vi.fn(() => ({
      status: 1, stdout: '', stderr: 'SECRET_API_KEY=do-not-emit',
    }));
    expect(() => capacityCheck({ profile: null }, spawn)).toThrow(/read-only CLI query failed/);
  });

  it('reports a checked result without leaking tenancy OCIDs', async () => {
    const spawn = vi.fn((cmd, args) => ({ status: 0,
      stdout: JSON.stringify(args[0] === 'iam' ? domains : report('OUT_OF_HOST_CAPACITY', 0)) }));
    const log = vi.fn();
    const result = await runCapacityWatch(['--once', '--json'], { spawn, log });
    expect(result.likelyAvailable).toBe(false);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).not.toContain(root);
    expect(log.mock.calls[0][0]).toContain('OUT_OF_HOST_CAPACITY');
  });
});
