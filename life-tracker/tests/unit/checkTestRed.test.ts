import {
  buildFocusedTestArgs,
  classifyRedResult,
  normalizeOverlayPath,
} from '../../scripts/lib/check-test-red.mjs';

describe('isolated red-test helper', () => {
  // Regression: AGENTS.md — Definition of done
  it('classifies expected assertion, structural, unrelated, and unexpected-pass results', () => {
    expect(classifyRedResult({ exitCode: 1, output: 'AssertionError: expected false to be true' }))
      .toBe('behavioral-red');
    expect(classifyRedResult({ exitCode: 1, output: "Cannot find module './new-helper'" }))
      .toBe('structural-red');
    expect(classifyRedResult({ exitCode: 1, output: 'Error: connect ECONNREFUSED 127.0.0.1' }))
      .toBe('unrelated-red');
    expect(classifyRedResult({ exitCode: null, output: 'spawn npm failed' })).toBe('unrelated-red');
    expect(classifyRedResult({ exitCode: 0, output: '1 passed' })).toBe('unexpected-pass');
  });

  it('does not treat an unclassified execution error as proof of behavioral red', () => {
    expect(classifyRedResult({ exitCode: 1, output: 'Error: fixture setup failed before the assertion' }))
      .toBe('unrelated-red');
    expect(classifyRedResult({ exitCode: 1, output: 'TypeError: Cannot read properties of undefined' }))
      .toBe('unrelated-red');
  });

  it('accepts behavioral red only from the requested failed test file and name', () => {
    const otherFailure = [
      ' FAIL  unit  tests/unit/other.test.ts > rejects cross-owner edits',
      'AssertionError: expected false to be true',
    ].join('\n');
    expect(classifyRedResult({
      exitCode: 1, output: otherFailure, testPath: 'tests/unit/target.test.ts',
    })).toBe('unrelated-red');

    const wrongTest = [
      ' FAIL  unit  tests/unit/target.test.ts > allows public reads',
      'AssertionError: expected false to be true',
    ].join('\n');
    expect(classifyRedResult({
      exitCode: 1, output: wrongTest, testPath: 'tests/unit/target.test.ts',
      pattern: 'rejects cross-owner edits',
    })).toBe('unrelated-red');

    const intendedFailure = [
      ' FAIL  unit  tests/unit/target.test.ts > denies cross-owner edits',
      'AssertionError: expected false to be true',
    ].join('\n');
    expect(classifyRedResult({
      exitCode: 1, output: intendedFailure, testPath: 'tests/unit/target.test.ts',
      pattern: 'denies cross-owner',
    })).toBe('behavioral-red');
    expect(classifyRedResult({
      exitCode: 1,
      output: ' FAIL  unit  tests/unit/target.test.ts > denies cross-owner edits\nError: fixture setup failed',
      testPath: 'tests/unit/target.test.ts',
    })).toBe('unrelated-red');
  });

  it('builds one narrow Vitest command and rejects escaping overlay paths', () => {
    expect(buildFocusedTestArgs('tests/unit/example.test.ts', 'rejects invalid input')).toEqual([
      'test', '--', 'tests/unit/example.test.ts', '-t', 'rejects invalid input',
    ]);
    expect(normalizeOverlayPath('tests/unit/example.test.ts')).toBe('tests/unit/example.test.ts');
    expect(() => normalizeOverlayPath('../secret.test.ts')).toThrow(/project-relative/);
    expect(() => normalizeOverlayPath('/tmp/secret.test.ts')).toThrow(/project-relative/);
    expect(() => normalizeOverlayPath('C:\\tmp\\secret.test.ts')).toThrow(/project-relative/);
    expect(() => normalizeOverlayPath('src/example.ts')).toThrow(/tests\//);
    expect(() => normalizeOverlayPath('tests/fixture.json')).toThrow(/source file/);
    expect(() => buildFocusedTestArgs('tests/helpers/fixture.ts')).toThrow(/\*\.test/);
  });
});
