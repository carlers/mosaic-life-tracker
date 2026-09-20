import { isAbsolute, posix } from 'node:path';

export const RED_RESULTS = [
  'behavioral-red',
  'structural-red',
  'unrelated-red',
  'unexpected-pass',
];

export function normalizeOverlayPath(input) {
  const normalized = String(input || '').replaceAll('\\', '/').replace(/^\.\//, '');
  if (!normalized || isAbsolute(normalized) || /^[a-z]:\//i.test(normalized) || normalized.startsWith('../') || normalized.includes('/../')) {
    throw new Error(`Overlay path must be project-relative: ${input || '<empty>'}`);
  }
  if (!normalized.startsWith('tests/')) {
    throw new Error(`Overlay path must stay under tests/: ${input}`);
  }
  const result = posix.normalize(normalized);
  if (!/\.(?:test\.)?[cm]?[jt]sx?$/.test(result)) {
    throw new Error(`Overlay path must be a test or test fixture source file: ${input}`);
  }
  return result;
}

export function buildFocusedTestArgs(testPath, pattern) {
  const args = ['test', '--', normalizeTestPath(testPath)];
  if (pattern) args.push('-t', pattern);
  return args;
}

export function normalizeTestPath(input) {
  const normalized = normalizeOverlayPath(input);
  if (!/\.test\.[cm]?[jt]sx?$/.test(normalized)) {
    throw new Error(`Test path must name a *.test source file: ${input}`);
  }
  return normalized;
}

export function classifyRedResult({ exitCode, output }) {
  if (exitCode === 0) return 'unexpected-pass';
  if (exitCode == null) return 'unrelated-red';
  if (/cannot find (?:module|package)|failed to load url|does not provide an export|module not found|TS2307|SyntaxError|failed to parse|transform failed/i.test(output)) {
    return 'structural-red';
  }
  if (/ECONN(?:REFUSED|RESET)|ENETUNREACH|EAI_AGAIN|out of memory|ENOMEM|timed out|network error|worker exited unexpectedly/i.test(output)) {
    return 'unrelated-red';
  }
  return 'behavioral-red';
}
