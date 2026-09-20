import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';

export const HANDOFF_TOKEN_WARNING = 20_000;
export const HANDOFF_TARGETS = ['agent', 'chat-plan', 'chat-implement'];

const TARGET_ALIASES = {
  codex: 'agent',
  chat: 'chat-plan',
  'deepseek-chat1': 'chat-plan',
  'deepseek-chat2': 'chat-implement',
  'chatgpt-planner': 'chat-plan',
  'chatgpt-implementer': 'chat-implement',
  'deepseek-planner': 'chat-plan',
  'deepseek-implementer': 'chat-implement',
};

const PROMPTS = {
  agent:
    'Use the Mosaic workspace-agent workflow. Inspect AGENTS.md, SESSION_STATE.md, PLAN.md, Git, and the current files; verify the checkpoint, then continue from Next action.',
  'chat-plan':
    'You are the Mosaic web-chat Planner/Reviewer. Use the attached handoff packet as exact repository context, produce a decision-complete plan or review, and do not emit runtime changes.',
  'chat-implement':
    'You are the Mosaic web-chat Implementer. Use the attached handoff packet as exact repository context, request missing files together, and return only a complete installer-compatible mosaic bundle plus the prescribed apply guidance.',
};

const RESERVED_GENERATED_PATHS = new Set([
  '.mosaic-handoff.md',
  'repomix-output.xml',
]);

export function normalizeHandoffTarget(target) {
  const canonical = TARGET_ALIASES[target] || target;
  if (!HANDOFF_TARGETS.includes(canonical)) {
    throw new Error(
      `Unknown handoff target "${target}". Expected one of: ${HANDOFF_TARGETS.join(', ')}.`
    );
  }
  return {
    target: canonical,
    alias: canonical === target ? null : target,
  };
}

export function promptForTarget(target) {
  return PROMPTS[normalizeHandoffTarget(target).target];
}

export function validateSessionState(content) {
  const requiredLines = [
    'Updated:',
    'Current task:',
    'Status:',
    'Roadmap pointer:',
    'Checkpoint:',
    'Next action:',
    'Blockers:',
  ];
  const requiredSections = [
    'Working set',
    'Completed substeps',
    'Remaining substeps',
    'Temporary decisions',
    'Verification',
  ];
  const missing = [
    ...requiredLines.filter((label) =>
      !new RegExp(`^${label.replace(':', '\\:')}\\s*\\S`, 'm').test(content)
    ),
    ...requiredSections
      .filter((heading) => !content.includes(`## ${heading}`))
      .map((heading) => `## ${heading}`),
  ];
  if (missing.length > 0) {
    throw new Error(`SESSION_STATE.md is missing required fields: ${missing.join(', ')}`);
  }
}

export function parseWorkingSet(content) {
  const heading = content.match(/^## Working set\s*$/m);
  if (!heading?.index && heading?.index !== 0) {
    throw new Error('SESSION_STATE.md has no Working set section.');
  }
  const rest = content.slice(heading.index + heading[0].length).replace(/^\r?\n/, '');
  const nextHeading = rest.search(/^## /m);
  const body = nextHeading === -1 ? rest : rest.slice(0, nextHeading);

  return body
    .split('\n')
    .map((line) => line.match(/^\s*-\s+(.+?)\s*$/)?.[1])
    .filter(Boolean)
    .map((entry) => entry.replace(/^`|`$/g, '').trim())
    .filter((entry) => entry.toLowerCase() !== 'none');
}

function normalizeProjectPath(projectRoot, input) {
  if (!input || isAbsolute(input)) {
    throw new Error(`Handoff paths must be relative to the project: ${input || '<empty>'}`);
  }
  const normalized = input.replaceAll('\\', '/').replace(/^\.\//, '');
  if (RESERVED_GENERATED_PATHS.has(normalized)) {
    throw new Error(`Generated repository exports cannot be included: ${normalized}`);
  }
  const fullPath = resolve(projectRoot, normalized);
  const projectPrefix = `${resolve(projectRoot)}${sep}`;
  if (!fullPath.startsWith(projectPrefix)) {
    throw new Error(`Handoff path escapes the project: ${input}`);
  }
  if (!existsSync(fullPath) || !statSync(fullPath).isFile()) {
    throw new Error(`Handoff path is not a file: ${input}`);
  }
  const realPath = realpathSync(fullPath);
  const realRoot = `${realpathSync(projectRoot)}${sep}`;
  if (!realPath.startsWith(realRoot)) {
    throw new Error(`Handoff path resolves outside the project: ${input}`);
  }
  return relative(projectRoot, realPath).replaceAll('\\', '/');
}

export function resolveWorkingSet(projectRoot, statePaths, extraPaths = []) {
  const seen = new Set();
  const paths = [];
  for (const input of [...statePaths, ...extraPaths]) {
    const normalized = normalizeProjectPath(projectRoot, input);
    if (!seen.has(normalized)) {
      seen.add(normalized);
      paths.push(normalized);
    }
  }
  return paths;
}

function escapeAttribute(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function exactFileBlocks(projectRoot, paths) {
  return paths
    .map((filePath) => {
      const content = readFileSync(resolve(projectRoot, filePath), 'utf8');
      const body = content.endsWith('\n') ? content : `${content}\n`;
      return `<file path="${escapeAttribute(filePath)}">\n${body}</file>`;
    })
    .join('\n\n');
}

export function estimateTokens(content) {
  return Math.ceil(content.length / 4);
}

export function buildWebChatPacket({
  target,
  projectRoot,
  sessionState,
  plan,
  agents,
  webChatWorkflow,
  git,
  workingSet,
  metricsSummary = null,
}) {
  const canonical = normalizeHandoffTarget(target).target;
  if (canonical === 'agent') {
    throw new Error(`Web-chat packet requested for invalid target: ${target}`);
  }
  const dirtyParts = [
    git.unstagedDiff && `### Unstaged diff\n\n\`\`\`diff\n${git.unstagedDiff.trimEnd()}\n\`\`\``,
    git.stagedDiff && `### Staged diff\n\n\`\`\`diff\n${git.stagedDiff.trimEnd()}\n\`\`\``,
  ].filter(Boolean);
  const selectedFiles = exactFileBlocks(projectRoot, workingSet);
  const emptyInstruction = canonical === 'chat-plan'
    ? 'No implementation files are selected. Plan from the checkpoint and request exact files only when needed.'
    : 'No implementation files are selected. Request the exact files needed before emitting changes.';

  return `# Mosaic handoff packet

${PROMPTS[canonical]}

This packet is the complete starting context for this handoff. Follow the declared role,
request targeted \`npm run dump -- <paths>\` content only when required, and treat Git
and current files as authoritative over stale prose.

## Git checkpoint

- Branch: ${git.branch || '(detached HEAD)'}
- HEAD: ${git.head}

\`\`\`text
${git.status || '(clean worktree)'}
\`\`\`

## Workflow telemetry

${metricsSummary || '**Run:** telemetry=off'}

${dirtyParts.length > 0 ? `${dirtyParts.join('\n\n')}\n\n` : ''}## Project instructions

<file path="AGENTS.md">
${agents.trimEnd()}
</file>

## Web-chat workflow

<file path="docs/WEB_CHAT_WORKFLOW.md">
${webChatWorkflow.trimEnd()}
</file>

## Session state

<file path="SESSION_STATE.md">
${sessionState.trimEnd()}
</file>

## Roadmap

<file path="PLAN.md">
${plan.trimEnd()}
</file>

## Working files

${selectedFiles || `(${emptyInstruction})`}
`;
}
