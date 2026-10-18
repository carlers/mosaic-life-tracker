import { describe, expect, it } from 'vitest';
import {
  APPWRITE_HOST_MINIMUM,
  assessSelfHostPrerequisites,
  parseSwapTotalBytes,
} from '../../scripts/selfhost-preflight.mjs';

const eligibleHost = {
  platform: 'linux',
  arch: 'arm64',
  logicalCpus: 2,
  memoryBytes: 12 * 1024 ** 3,
  swapBytes: 2 * 1024 ** 3,
  dockerCli: true,
  dockerComposeV2: true,
  dockerDaemon: true,
};

describe('read-only Appwrite self-host prerequisite gate (#975)', () => {
  it('accepts an ARM64 candidate host with verified Docker prerequisites', () => {
    const result = assessSelfHostPrerequisites(eligibleHost);
    expect(result.meetsPrerequisites).toBe(true);
    expect(result.checks.every(({ ok }) => ok)).toBe(true);
  });

  it('accepts x64 hosts to support future VPS/NAS/laptop recovery', () => {
    expect(
      assessSelfHostPrerequisites({ ...eligibleHost, arch: 'x64' })
        .meetsPrerequisites
    ).toBe(true);
  });

  it('rejects missing CPU, RAM and swap independently', () => {
    const cases = [
      { logicalCpus: 1, failed: 'cpu' },
      { memoryBytes: APPWRITE_HOST_MINIMUM.memoryBytes - 1, failed: 'memory' },
      { swapBytes: APPWRITE_HOST_MINIMUM.swapBytes - 1, failed: 'swap' },
    ];
    for (const { failed, ...overrides } of cases) {
      const result = assessSelfHostPrerequisites({
        ...eligibleHost,
        ...overrides,
      });
      expect(result.meetsPrerequisites).toBe(false);
      expect(result.checks.find(({ id }) => id === failed)?.ok).toBe(false);
    }
  });

  it('fails closed if Docker or the daemon is missing', () => {
    for (const failed of ['dockerCli', 'dockerComposeV2', 'dockerDaemon']) {
      expect(
        assessSelfHostPrerequisites({ ...eligibleHost, [failed]: false })
          .meetsPrerequisites
      ).toBe(false);
    }
  });

  it('rejects unsupported operating systems and processor architectures', () => {
    expect(
      assessSelfHostPrerequisites({ ...eligibleHost, platform: 'darwin' })
        .meetsPrerequisites
    ).toBe(false);
    expect(
      assessSelfHostPrerequisites({ ...eligibleHost, arch: 'arm' })
        .meetsPrerequisites
    ).toBe(false);
  });

  it('reads Linux swap without assuming KiB output is GiB', () => {
    expect(parseSwapTotalBytes('MemTotal: 12000000 kB\nSwapTotal: 2097152 kB\n'))
      .toBe(2 * 1024 ** 3);
    expect(() => parseSwapTotalBytes('MemTotal: 12000000 kB\n'))
      .toThrow(/SwapTotal/);
  });
});
