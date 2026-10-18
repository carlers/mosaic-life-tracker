import { describe, expect, it } from 'vitest';
import {
  auditComposeServices,
  normalizeArchitecture,
  parseAuditArgs,
  parseManifestPlatforms,
} from '../../scripts/selfhost-image-audit.mjs';

const compose = {
  api: { image: 'appwrite/appwrite:2.5.0' },
  db: { image: 'postgres:17', platform: 'linux/arm64' },
};
const images = {
  'appwrite/appwrite:2.5.0': ['linux/amd64', 'linux/arm64'],
  'postgres:17': ['linux/arm64'],
};

describe('isolated self-host image platform audit (#975)', () => {
  it('recognizes OCI indexes and Docker verbose descriptor shapes', () => {
    expect(parseManifestPlatforms({
      manifests: [
        { platform: { os: 'linux', architecture: 'arm64' } },
        { platform: { os: 'linux', architecture: 'amd64' } },
        { platform: { os: 'unknown', architecture: 'unknown' } },
      ],
    })).toEqual(['linux/amd64', 'linux/arm64', 'unknown/unknown']);
    expect(parseManifestPlatforms([
      { Platform: { OS: 'linux', Architecture: 'arm64' } },
      { Platform: { os: 'linux', architecture: 'x86_64' } },
    ])).toEqual(['linux/amd64', 'linux/arm64']);
  });

  it('does not pretend a single-platform manifest proves ARM64 compatibility', () => {
    expect(parseManifestPlatforms({
      schemaVersion: 2, config: { digest: 'sha256:0000' },
    })).toEqual([]);
    expect(auditComposeServices(compose, {
      ...images, 'appwrite/appwrite:2.5.0': [],
    }).services[0].status).toBe('unverified');
  });

  it('accepts an explicitly compatible ARM64 Compose configuration', () => {
    const report = auditComposeServices(compose, images, 'arm64');
    expect(report.outcome).toBe('pass');
    expect(report.services.map(item => item.status)).toEqual(['supported', 'supported']);
    expect(normalizeArchitecture('x64')).toBe('amd64');
  });

  it('rejects explicit platform mismatches even with a multi-platform image', () => {
    const report = auditComposeServices({
      api: { image: 'appwrite/appwrite:2.5.0', platform: 'linux/amd64' },
    }, images, 'arm64');
    expect(report.outcome).toBe('blocked');
    expect(report.services[0].reason).toMatch(/incompatible platform/);
  });

  it('rejects images lacking the requested architecture and incomplete services', () => {
    const report = auditComposeServices({
      api: { image: 'appwrite/appwrite:2.5.0' },
      local: { build: '.' },
    }, { 'appwrite/appwrite:2.5.0': ['linux/amd64'] });
    expect(report.services.map(item => item.status)).toEqual(['unsupported', 'unverified']);
    expect(report.outcome).toBe('blocked');
  });

  it('accepts x86 recovery hosts but does not silently rename unknown architectures', () => {
    const report = auditComposeServices({ api: compose.api }, images, 'x64');
    expect(report.target).toBe('linux/amd64');
    expect(report.outcome).toBe('pass');
    expect(() => auditComposeServices(compose, images, 'arm')).toThrow(/architecture/);
    expect(() => auditComposeServices({}, images)).toThrow(/services/);
  });

  it('requires explicit image input and refuses unexpected CLI arguments', () => {
    expect(parseAuditArgs([
      '--compose', 'appwrite/docker-compose.yml', '--arch', 'aarch64',
      '--image', 'openruntimes/node:v5-22.0', '--json',
    ])).toEqual({
      compose: 'appwrite/docker-compose.yml',
      architecture: 'arm64',
      images: ['openruntimes/node:v5-22.0'],
      json: true,
    });
    expect(() => parseAuditArgs([])).toThrow(/--compose/);
    expect(() => parseAuditArgs(['--image'])).toThrow(/requires a value/);
    expect(() => parseAuditArgs(['--evil'])).toThrow(/Unknown argument/);
    expect(() => parseAuditArgs(['--arch', 'win64', '--image', 'x'])).toThrow(/architecture/);
  });
});
