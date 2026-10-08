export const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export function parseVersion(value) {
  const match = typeof value === 'string' ? SEMVER_PATTERN.exec(value) : null;
  if (!match) throw new Error(`Invalid stable version: ${String(value)}`);
  const numbers = match.slice(1).map(Number);
  if (!numbers.every(Number.isSafeInteger)) throw new Error('Version component exceeds safe integer range');
  return numbers;
}

export function compareVersions(a, b) {
  const left = parseVersion(a);
  const right = parseVersion(b);
  for (let index = 0; index < left.length; index++) {
    if (left[index] !== right[index]) return Math.sign(left[index] - right[index]);
  }
  return 0;
}

export function nextVersion(current, kind) {
  const [major, minor, patch] = parseVersion(current);
  let next;
  switch (kind) {
    case 'major':
      next = [major + 1, 0, 0];
      break;
    case 'minor':
      next = [major, minor + 1, 0];
      break;
    case 'patch':
      next = [major, minor, patch + 1];
      break;
    default:
      throw new Error(`Unknown version increment: ${kind}`);
  }
  if (!next.every(Number.isSafeInteger)) throw new Error('Version component overflow');
  return next.join('.');
}

export function extractAppVersion(source) {
  const matches = [...source.matchAll(/export const APP_VERSION = '([^']+)';/g)];
  if (matches.length !== 1) throw new Error('Expected exactly one APP_VERSION declaration');
  parseVersion(matches[0][1]);
  return matches[0][1];
}

export function validateVersionFiles(packageJson, lockJson, appVersionSource) {
  const version = packageJson.version;
  parseVersion(version);
  if (lockJson.version !== version || lockJson.packages?.['']?.version !== version) {
    throw new Error('package.json and package-lock.json version fields differ');
  }
  if (extractAppVersion(appVersionSource) !== version) {
    throw new Error('appVersion.ts does not match package.json');
  }
  return version;
}

export function updatedAppVersion(source, next) {
  parseVersion(next);
  extractAppVersion(source);
  return source.replace(/export const APP_VERSION = '[^']+';/, `export const APP_VERSION = '${next}';`);
}
