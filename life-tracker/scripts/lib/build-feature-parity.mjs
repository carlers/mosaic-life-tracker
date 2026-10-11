// Compare the presence/scope of material Vite feature variables, never their values.
// Endpoint and Function IDs are intentionally excluded: Scratch vs Production differs.
export const MATERIAL_VITE_FEATURES = Object.freeze([
  { key: 'VITE_GIPHY_API_KEY', feature: 'GIPHY stickers' },
]);

function activeFor(row, branch, target) {
  return Array.isArray(row?.target) &&
    row.target.includes(target) &&
    (!row.gitBranch || row.gitBranch === branch);
}

export function featurePresence(rows, branch, target = 'preview') {
  if (!Array.isArray(rows)) throw new Error('Expected Vercel environment metadata array');
  if (typeof branch !== 'string' || !branch.trim()) throw new Error('Branch is required');
  return Object.fromEntries(MATERIAL_VITE_FEATURES.map(({ key, feature }) => [
    feature, rows.some(row => row.key === key && activeFor(row, branch, target)),
  ]));
}

export function compareFeaturePresence(rows, sourceBranch, targetBranch = 'dev') {
  const source = featurePresence(rows, sourceBranch);
  const target = featurePresence(rows, targetBranch);
  const mismatches = Object.keys(source).filter(feature => source[feature] !== target[feature])
    .map(feature => ({ feature, sourceEnabled: source[feature], targetEnabled: target[feature] }));
  return { sourceBranch, targetBranch, source, target, mismatches, passed: mismatches.length === 0 };
}

export function formatFeatureParity(result) {
  const lines = [result.passed ? 'Build-feature scope parity passed.' : 'Build-feature scope parity failed.'];
  for (const feature of Object.keys(result.source)) {
    lines.push(`${feature}: ${result.sourceBranch}=${result.source[feature] ? 'configured' : 'absent'}, ${result.targetBranch}=${result.target[feature] ? 'configured' : 'absent'}`);
  }
  lines.push('Metadata checks presence/scope only; verify effective nonempty values in sanitized build logs.');
  return lines.join('\n');
}
