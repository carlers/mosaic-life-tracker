// A test-like file that no configured runner owns is worse than a failing
// test: CI can stay green without executing the intended regression.
const BROWSER_SPEC = /^tests\/e2e\/.+\.spec\.mjs$/;

export function evaluateTestDiscovery(testFiles, matchedProjectFiles) {
  const projectNames = Object.keys(matchedProjectFiles);
  const projectSets = new Map(
    projectNames.map((name) => [name, new Set(matchedProjectFiles[name])])
  );
  const counts = Object.fromEntries([...projectNames, 'browser'].map((name) => [name, 0]));
  const invalid = [];
  const files = [...new Set(testFiles)].sort();

  for (const file of files) {
    const owners = projectNames.filter((name) => projectSets.get(name).has(file));
    if (BROWSER_SPEC.test(file)) owners.push('browser');

    if (owners.length !== 1) {
      invalid.push({ file, owners });
    } else {
      counts[owners[0]] += 1;
    }
  }

  return { total: files.length, counts, invalid };
}
