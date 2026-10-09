#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateVersionFiles } from './lib/versioning.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
export const entrypoints = [
  '../AGENTS.md', 'AGENTS.md', 'README.md', 'docs/README.md',
  'docs/PLAN.md', 'docs/SESSION_STATE.md', 'docs/AI_WORKFLOW.md',
  'docs/DELIVERY.md', 'docs/PROJECT_REFERENCE.md', 'docs/TEST_WORKFLOW.md',
];

function markdownProse(markdown) {
  // Fence contents may demonstrate intentionally invalid links or headings.
  let fence = null;
  return markdown.split('\n').filter((line) => {
    const match = line.match(/^\s{0,3}((?:\x60){3,}|~{3,})(.*)$/);
    if (match) {
      if (!fence) fence = match[1];
      else if (match[1][0] === fence[0] && match[1].length >= fence.length && !match[2].trim()) fence = null;
      return false;
    }
    return !fence;
  }).join('\n');
}

export function localMarkdownLinks(markdown, sourcePath) {
  const links = [];
  for (const match of markdownProse(markdown).matchAll(/\[[^\]]*\]\((<[^>]+>|[^)]+)\)/g)) {
    const raw = match[1].trim().replace(/\s+["'][^"']*["']$/, '').replace(/^<|>$/g, '');
    if (!raw || /^[a-z][a-z0-9+.-]*:/i.test(raw)) continue;
    const hashIndex = raw.indexOf('#');
    const pathText = hashIndex < 0 ? raw : raw.slice(0, hashIndex);
    const fragmentText = hashIndex < 0 ? '' : raw.slice(hashIndex + 1);
    const filePath = decodeURIComponent(pathText).replace(/:\d+(?::\d+)?$/, '');
    links.push({
      target: filePath ? resolve(dirname(sourcePath), filePath) : sourcePath,
      hasPath: Boolean(filePath),
      fragment: fragmentText ? decodeURIComponent(fragmentText) : null,
    });
  }
  return links;
}

export function localMarkdownTargets(markdown, sourcePath) {
  return localMarkdownLinks(markdown, sourcePath).filter((link) => link.hasPath).map((link) => link.target);
}

export function markdownHeadingAnchors(markdown) {
  // GitHub heading slugs lowercase text, discard formatting/punctuation, and
  // suffix repeated headings with -1, -2, etc. Preserve numbered § anchors.
  const anchors = new Set();
  const repeats = new Map();
  for (const line of markdownProse(markdown).split('\n')) {
    const match = line.match(/^ {0,3}#{1,6}[ \t]+(.+?)[ \t]*$/);
    if (!match) continue;
    const heading = match[1].replace(/[ \t]+#+[ \t]*$/, '')
      .replace(/!?\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/<[^>]*>/g, '')
      .replace(/\x60/g, '')
      .replace(/[*~]/g, '')
      .replace(/(^|[^\w])_([^_]+)_(?=$|[^\w])/g, '$1$2');
    const slug = heading.trim().toLowerCase().replace(/[^\p{L}\p{N}\p{M}_\- ]/gu, '').replace(/ /g, '-');
    if (!slug) continue;
    const count = repeats.get(slug) ?? 0;
    anchors.add(count ? slug + '-' + count : slug);
    repeats.set(slug, count + 1);
  }
  // GitHub also supports explicit <a name="..."></a> and id anchors.
  for (const match of markdownProse(markdown).matchAll(/<a\s+[^>]*(?:name|id)=["']([^"']+)["'][^>]*>/gi)) {
    anchors.add(match[1]);
  }
  return anchors;
}

export function missingLocalMarkdownFragments(markdown, sourcePath, anchorCache = new Map()) {
  const errors = [];
  for (const { target, fragment } of localMarkdownLinks(markdown, sourcePath)) {
    if (!fragment || !target.endsWith('.md') || !existsSync(target)) continue;
    if (!anchorCache.has(target)) {
      anchorCache.set(target, markdownHeadingAnchors(readFileSync(target, 'utf8')));
    }
    if (!anchorCache.get(target).has(fragment)) errors.push({ target, fragment });
  }
  return errors;
}

function markdownFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? markdownFiles(path) : entry.name.endsWith('.md') ? [path] : [];
  });
}

export function checkContracts(projectRoot = root) {
  const errors = [];
  for (const path of [...entrypoints, '../.github/workflows/quality-gate.yml']) {
    if (!existsSync(resolve(projectRoot, path))) errors.push(`Missing project entrypoint: ${path}`);
  }
  try {
    const packageJson = JSON.parse(readFileSync(resolve(projectRoot, 'package.json'), 'utf8'));
    const lockJson = JSON.parse(readFileSync(resolve(projectRoot, 'package-lock.json'), 'utf8'));
    const appSource = readFileSync(resolve(projectRoot, 'src/lib/appVersion.ts'), 'utf8');
    validateVersionFiles(packageJson, lockJson, appSource);
  } catch (error) {
    errors.push(`Version contract: ${error instanceof Error ? error.message : String(error)}`);
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
  const anchorCache = new Map();
  for (const file of files) {
    if (!existsSync(file)) continue;
    const markdown = readFileSync(file, 'utf8');
    for (const target of localMarkdownTargets(markdown, file)) {
      if (!existsSync(target)) errors.push(relative(projectRoot, file) + ': missing local link ' + relative(projectRoot, target));
    }
    for (const { target, fragment } of missingLocalMarkdownFragments(markdown, file, anchorCache)) {
      errors.push(relative(projectRoot, file) + ': missing heading #' + fragment + ' in ' + relative(projectRoot, target));
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
