#!/usr/bin/env node
import { globSync } from 'node:fs';
import { TEST_PROJECTS } from './lib/test-projects.mjs';

const normalize = (value) => value.replaceAll('\\', '/');
const allTests = [
  ...globSync('tests/**/*.test.ts'),
  ...globSync('tests/**/*.test.tsx'),
].map(normalize).sort();

const matchesByFile = new Map(allTests.map((file) => [file, []]));
for (const project of TEST_PROJECTS) {
  for (const pattern of project.include) {
    for (const file of globSync(pattern).map(normalize)) {
      const matches = matchesByFile.get(file);
      if (matches) matches.push(project.name);
    }
  }
}

const invalid = [...matchesByFile].filter(([, projects]) => projects.length !== 1);
if (invalid.length > 0) {
  for (const [file, projects] of invalid) {
    const detail = projects.length === 0 ? 'not matched' : `matched by ${projects.join(', ')}`;
    console.error(`${file}: ${detail}`);
  }
  process.exit(1);
}

const counts = TEST_PROJECTS.map((project) => {
  const count = [...matchesByFile.values()].filter((matches) => matches[0] === project.name).length;
  return `${project.name}=${count}`;
});
console.log(`Test discovery passed: ${allTests.length} files (${counts.join(', ')}).`);
