import { BUILD_SIZE_METRICS } from './build-size-guard.mjs';

const ANSI = /\x1b\[[0-9;]*m/g;
const FULL_SHA = /^[0-9a-f]{40}$/i;

function lastMatch(text, expression) {
  const values = [...text.matchAll(expression)];
  return values.at(-1) ?? null;
}

// Consume existing GitHub/Vercel build logs locally; do not persist or echo
// credentials, full logs, environment values, or emitted JS from a Vite build.
export function parseBuildEvidence(rawLog) {
  if (typeof rawLog !== 'string') throw new Error('Build log must be text');
  const log = rawLog.replace(ANSI, '');
  const metrics = {};
  for (const name of BUILD_SIZE_METRICS) {
    const row = lastMatch(log, new RegExp(
      `\\b(?:PASS|FAIL\\s*\\(\\+[^)]*\\))\\s+${name}\\s+([\\d,]+)\\s+B\\s*\\/\\s*([\\d,]+)\\s+B`, 'g',
    ));
    if (row) metrics[name] = {
      bytes: Number(row[1].replaceAll(',', '')),
      limitBytes: Number(row[2].replaceAll(',', '')),
    };
  }
  const feature = lastMatch(log, /\[Mosaic\] Build features: GIPHY stickers (enabled|disabled)/g);
  const runtime = lastMatch(log, /\[Mosaic\] Build runtime: Node\.js v?(\d+)\.(\d+)\.(\d+)/g);
  const vite = lastMatch(log, /\bvite v(\d+\.\d+\.\d+)\b/g);
  return {
    metrics,
    giphyEnabled: feature ? feature[1] === 'enabled' : null,
    nodeMajor: runtime ? Number(runtime[1]) : null,
    viteVersion: vite?.[1] ?? null,
  };
}

export function compareBuildEvidence({ ci, hosted, ciSha, hostedSha }) {
  if (!ci || !hosted || typeof ci !== 'object' || typeof hosted !== 'object') {
    throw new Error('Both CI and hosted evidence are required');
  }
  if (!FULL_SHA.test(ciSha ?? '') || !FULL_SHA.test(hostedSha ?? '')) {
    throw new Error('Both exact 40-character commit SHAs are required');
  }
  const deltas = BUILD_SIZE_METRICS.map(metric => {
    const local = ci.metrics?.[metric];
    const remote = hosted.metrics?.[metric];
    if (!local || !remote || !Number.isSafeInteger(local.bytes) || !Number.isSafeInteger(remote.bytes)) {
      return { metric, delta: null };
    }
    return { metric, delta: remote.bytes - local.bytes };
  });
  const issues = [];
  const unknown = [];
  if (ciSha !== hostedSha) issues.push('different Git commit SHAs');
  for (const { metric, delta } of deltas) {
    if (delta === null) unknown.push(`missing ${metric} measurements`);
    else if (delta !== 0) issues.push(`${metric} differs`);
  }
  for (const [name, field] of [['GIPHY feature', 'giphyEnabled'], ['Node major', 'nodeMajor'], ['Vite version', 'viteVersion']]) {
    if (ci[field] == null || hosted[field] == null) unknown.push(`missing ${name} build context`);
    else if (ci[field] !== hosted[field]) issues.push(`${name} differs`);
  }
  return {
    status: issues.length ? 'mismatch' : unknown.length ? 'unverified' : 'matching-measurements',
    ciSha,
    hostedSha,
    deltas,
    issues,
    unknown,
  };
}

export function formatBuildParityReport(result) {
  const lines = [`CI ↔ hosted build: ${result.status}`, `CI SHA: ${result.ciSha}`, `Hosted SHA: ${result.hostedSha}`];
  for (const { metric, delta } of result.deltas) {
    lines.push(`${metric}: ${delta == null ? 'unknown' : (delta >= 0 ? '+' : '') + delta + ' B'} (hosted minus CI)`);
  }
  for (const issue of result.issues) lines.push(`MISMATCH: ${issue}`);
  for (const item of result.unknown) lines.push(`UNVERIFIED: ${item}`);
  lines.push('Matching measurements do not prove identical emitted assets; compare artifact hashes before accepting byte-for-byte parity.');
  return lines.join('\n');
}
