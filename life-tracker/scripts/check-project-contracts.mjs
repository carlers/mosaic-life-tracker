#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
export const entrypoints = [
  '../AGENTS.md', 'AGENTS.md', 'README.md', 'docs/README.md',
  'docs/PLAN.md', 'docs/SESSION_STATE.md', 'docs/AI_WORKFLOW.md',
  'docs/DELIVERY.md', 'docs/PROJECT_REFERENCE.md', 'docs/TEST_WORKFLOW.md',
];

export function localMarkdownTargets(markdown, sourcePath) {
  // Examples are not links. Match fence length/type so embedded fences remain content.
  let fence = null;
  const prose = markdown.split('\n').filter((line) => {
    const match = line.match(/^\s{0,3}(`{3,}|~{3,})(.*)$/);
    if (match) {
      if (!fence) fence = match[1];
      else if (match[1][0] === fence[0] && match[1].length >= fence.length && !match[2].trim()) fence = null;
      return false;
    }
    return !fence;
  }).join('\n');
  const targets = [];
  for (const match of prose.matchAll(/\[[^\]]*\]\((<[^>]+>|[^)]+)\)/g)) {
    const raw = match[1].trim().replace(/\s+["'][^"']*["']$/, '').replace(/^<|>$/g, '');
    if (!raw || raw.startsWith('#') || /^[a-z][a-z0-9+.-]*:/i.test(raw)) continue;
    const path = decodeURIComponent(raw.split('#')[0]).replace(/:\d+(?::\d+)?$/, '');
    if (path) targets.push(resolve(dirname(sourcePath), path));
  }
  return targets;
}

function markdownFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? markdownFiles(path) : entry.name.endsWith('.md') ? [path] : [];
  });
}

export function checkContracts(projectRoot = root) {
  const errors = [];
  for (const path of [...entrypoints, '../.github/workflows/verify.yml']) {
    if (!existsSync(resolve(projectRoot, path))) errors.push(`Missing project entrypoint: ${path}`);
  }
  const docsRoot = resolve(projectRoot, 'docs');
  const files = new Set([
    ...entrypoints.filter((path) => !path.startsWith('docs/')).map((path) => resolve(projectRoot, path)),
    ...(existsSync(docsRoot) ? markdownFiles(docsRoot) : []),
  ]);
  // The index must expose the maintained guides; archive documents link through its index.
  const index = resolve(projectRoot, 'docs/README.md');
  if (existsSync(index)) {
    const links = new Set(localMarkdownTargets(readFileSync(index, 'utf8'), index));
    for (const path of markdownFiles(docsRoot).filter((p) => dirname(p) === docsRoot && p !== index)) {
      if (!links.has(path)) errors.push(`Documentation index does not link ${relative(projectRoot, path)}`);
    }
  }
  for (const file of files) {
    if (!existsSync(file)) continue;
    for (const target of localMarkdownTargets(readFileSync(file, 'utf8'), file)) {
      if (!existsSync(target)) errors.push(`${relative(projectRoot, file)}: missing local link ${relative(projectRoot, target)}`);
    }
  }
  for (const [source, target] of [['../AGENTS.md', 'AGENTS.md'], ['AGENTS.md', 'docs/SESSION_STATE.md'], ['README.md', 'docs/README.md']]) {
    const path = resolve(projectRoot, source);
    if (existsSync(path) && !localMarkdownTargets(readFileSync(path, 'utf8'), path).includes(resolve(projectRoot, target))) {
      errors.push(`${source}: missing entrypoint link to ${target}`);
    }
  }
  return { errors, count: files.size };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { errors, count } = checkContracts();
  if (errors.length) {
    errors.forEach((error) => console.error(error));
    process.exitCode = 1;
  } else console.log(`Project contracts passed: ${count} Markdown files and entrypoint links checked.`);
}
