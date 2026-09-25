#!/usr/bin/env node
import { appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const ZERO_SHA = /^0+$/;

export function isDocsOnlyPath(file) {
  return (
    file === 'AGENTS.md' ||
    /^life-tracker\/[^/]+\.md$/.test(file) ||
    file.startsWith('life-tracker/docs/')
  );
}

export function classifyVerifyMode({
  eventName,
  ref,
  headRef = '',
  commitMessage = '',
  changedFiles = [],
}) {
  const branch = headRef || ref.replace(/^refs\/heads\//, '');

  if (eventName === 'workflow_dispatch') {
    return { mode: 'full', browser: true };
  }

  if (commitMessage.includes('[verify:full]')) {
    return { mode: 'full', browser: true };
  }

  const browserRequested = commitMessage.includes('[verify:browser]');
  const isCanonicalBranch =
    branch === 'main' ||
    branch === 'dev' ||
    branch.startsWith('feature/');
  const isAiBranch =
    branch.startsWith('chatgpt/') ||
    branch.startsWith('codex/');

  if (isCanonicalBranch) {
    return { mode: 'full', browser: true };
  }

  const docsOnly =
    changedFiles.length > 0 && changedFiles.every((file) => isDocsOnlyPath(file));

  if (docsOnly) {
    return { mode: 'docs', browser: browserRequested };
  }

  if (isAiBranch) {
    return { mode: 'focused', browser: browserRequested };
  }

  return { mode: 'full', browser: true };
}

function git(args, capture = true) {
  return execFileSync('git', args, {
    encoding: capture ? 'utf8' : undefined,
    stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
  });
}

function hasCommit(ref) {
  try {
    git(['cat-file', '-e', `${ref}^{commit}`]);
    return true;
  } catch {
    return false;
  }
}

function ensureCommit(sha) {
  if (!sha || ZERO_SHA.test(sha) || hasCommit(sha)) return;
  git(['fetch', '--no-tags', '--depth=1', 'origin', sha], false);
}

function resolveDiffBase({ eventName, beforeSha, prBaseSha }) {
  if (eventName === 'pull_request') {
    if (hasCommit('HEAD^1')) return 'HEAD^1';
    ensureCommit(prBaseSha);
    return prBaseSha;
  }

  if (eventName === 'push' && beforeSha && !ZERO_SHA.test(beforeSha)) {
    ensureCommit(beforeSha);
    return beforeSha;
  }

  return 'HEAD^';
}

function changedFilesFrom(base) {
  return git(['diff', '--name-only', base, 'HEAD'])
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function writeOutputs({ mode, browser, base = '', changedCount = 0 }) {
  const output = process.env.GITHUB_OUTPUT;
  if (!output) {
    throw new Error('GITHUB_OUTPUT is required when ci-classify.mjs runs as a workflow step.');
  }

  appendFileSync(
    output,
    [
      `mode=${mode}`,
      `browser=${browser ? 'true' : 'false'}`,
      `base=${base}`,
      `changed_count=${changedCount}`,
      '',
    ].join('\n')
  );
}

function main() {
  const eventName = process.env.CI_EVENT_NAME ?? '';
  const ref = process.env.CI_REF ?? '';
  const commitMessage = process.env.CI_COMMIT_MESSAGE ?? '';

  const immediate = classifyVerifyMode({
    eventName,
    ref,
    headRef: process.env.CI_HEAD_REF ?? '',
    commitMessage,
    changedFiles: [],
  });

  if (
    eventName === 'workflow_dispatch' ||
    commitMessage.includes('[verify:full]')
  ) {
    writeOutputs(immediate);
    console.log(`Verification mode: ${immediate.mode}`);
    return;
  }

  const base = resolveDiffBase({
    eventName,
    beforeSha: process.env.CI_BEFORE_SHA ?? '',
    prBaseSha: process.env.CI_PR_BASE_SHA ?? '',
  });
  const changedFiles = changedFilesFrom(base);
  const result = classifyVerifyMode({
    eventName,
    ref,
    headRef: process.env.CI_HEAD_REF ?? '',
    commitMessage,
    changedFiles,
  });

  writeOutputs({
    ...result,
    base,
    changedCount: changedFiles.length,
  });

  console.log(
    `Verification mode: ${result.mode}; changed files: ${changedFiles.length}; base: ${base}`
  );
}

if (process.argv[1]?.endsWith('ci-classify.mjs')) {
  main();
}
