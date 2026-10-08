import { describe, expect, it } from 'vitest';
import {
  compareVersions,
  nextVersion,
  extractAppVersion,
  updatedAppVersion,
  validateVersionFiles,
} from '../../scripts/lib/versioning.mjs';

describe('Preview version progression', () => {
  it('bumps minor for a feature and patch for each accepted refinement', () => {
    expect(nextVersion('0.3.8', 'minor')).toBe('0.4.0');
    expect(nextVersion('0.4.0', 'patch')).toBe('0.4.1');
    expect(nextVersion('0.4.1', 'patch')).toBe('0.4.2');
    expect(nextVersion('0.4.2', 'major')).toBe('1.0.0');
    expect(compareVersions('0.4.2', '0.4.1')).toBe(1);
    expect(compareVersions('0.4.2', '0.4.2')).toBe(0);
    expect(compareVersions('0.4.1', '0.4.2')).toBe(-1);
  });

  it('rejects malformed, unsafe, or ambiguous versions', () => {
    for (const value of ['0.4', '01.2.3', '0.4.2-rc.1', '0.4.2+build', '-1.2.3', '0.9007199254740992.0']) {
      expect(() => nextVersion(value, 'patch')).toThrow();
    }
    expect(() => nextVersion('0.4.2', 'foo')).toThrow();
  });

  it('checks both lockfile version fields and the UI version source', () => {
    const pkg = { version: '0.4.1' };
    const lock = { version: '0.4.1', packages: { '': { version: '0.4.1' } } };
    const source = "export const APP_VERSION = '0.4.1';\n";
    expect(validateVersionFiles(pkg, lock, source)).toBe('0.4.1');
    expect(updatedAppVersion(source, '0.4.2')).toBe("export const APP_VERSION = '0.4.2';\n");
    expect(extractAppVersion(source)).toBe('0.4.1');
    expect(() => validateVersionFiles(pkg, { ...lock, version: '0.4.0' }, source)).toThrow();
    expect(() => validateVersionFiles(pkg, { ...lock, packages: { '': { version: '0.4.0' } } }, source)).toThrow();
    expect(() => validateVersionFiles(pkg, lock, "export const APP_VERSION = '0.4.0';")).toThrow();
    expect(() => updatedAppVersion(source + source, '0.4.2')).toThrow();
  });
});
