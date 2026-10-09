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
    'Use the Mosaic workspace-agent workflow. Inspect AGENTS.md, docs/SESSION_STATE.md, Git, and relevant files; verify the checkpoint, then continue from Next action.',
  'chat-plan':
    'You are the Mosaic web-chat Planner/Reviewer. Use the attached handoff packet as exact repository context, produce a decision-complete plan or review, and do not emit runtime changes.',
  'chat-implement':
    'You are the Mosaic web-chat Implementer. Use the attached handoff packet as exact repository context, request missing files together, and return only a complete installer-compatible mosaic bundle plus concise apply guidance.',
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
  // Both the older structured handoff template and the current concise
  // task checkpoint are valid. Do not require one exact heading layout.
  const missing = [];
  if (!/^Updated:\s*\S/m.test(content)) missing.push('Updated:');
  if (!/(?:^|[ \t])(?:Current task|Current work):[ \t]*\S/m.test(content)) {
    missing.push('Current task: or Current work:');
  }
  if (!/^Next action:\s*\S/m.test(content) &&
      !/^## Next action(?:\s|$)/m.test(content)) {
    missing.push('Next action: or ## Next action');
  }
  if (missing.length > 0) {
    throw new Error(`SESSION_STATE.md is missing checkpoint context: ${missing.join(', ')}`);
  }
}

export function parseWorkingSet(content) {
  const heading = content.match(/^## Working set\s*$/m);
  // A compact checkpoint may identify work in prose. Require explicit
  // file paths only when emitting an actual file packet.
  if (!heading) return [];
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

export function assertGithubCheckpoint(git, remoteHead) {
  if (git.status || !git.branch || !git.repository || remoteHead !== git.head) {
    throw new Error('GitHub transport requires a clean, named branch published at the exact SHA. Use the default file packet for local-only work.');
  }
}

export function buildWebChatPacket({
  target, projectRoot, sessionState, agents, workingSet, git,
  transport = 'files', metricsSummary = null,
}) {
  const canonical = normalizeHandoffTarget(target).target;
  if (canonical === 'agent') throw new Error('Web-chat packet requested for invalid target: agent');
  if (!['files', 'github'].includes(transport)) throw new Error(`Unknown transport: ${transport}`);
  if (transport === 'github') assertGithubCheckpoint(git, git.remoteHead);
  const embedded = new Set(['AGENTS.md', 'docs/SESSION_STATE.md']);
  const selected = [...new Set(workingSet)].filter((path) => !embedded.has(path));
  const files = transport === 'github'
    ? `Retrieve these project-relative paths at the exact SHA above: AGENTS.md, docs/SESSION_STATE.md${selected.length ? ', ' + selected.join(', ') : ''}. Read docs/AI_WORKFLOW.md if transport guidance is needed.`
    : exactFileBlocks(projectRoot, selected) || 'No implementation files are selected. Request exact files before making changes.';
  return `# Mosaic handoff packet

${PROMPTS[canonical]}

## Git checkpoint

- Repository: ${git.repository || '(local checkout)'}
- Branch: ${git.branch || '(detached HEAD)'}
- HEAD: ${git.head}
- Transport: ${transport === 'github' ? 'verified GitHub reference' : 'exact files; local-only changes included when selected'}

${git.status || '(clean worktree)'}
${metricsSummary ? '\n' + metricsSummary + '\n' : ''}
## Essential instructions

<file path="AGENTS.md">
${agents.trimEnd()}
</file>

## Checkpoint

<file path="docs/SESSION_STATE.md">
${sessionState.trimEnd()}
</file>

## Working files

${files}

${canonical === 'chat-implement' ? `For offline implementation, return changed complete files in one five-tilde mosaic block.
Use ===FILE:project/relative/path===, optional ===DELETE:path===, then the complete
===FILE:docs/SESSION_STATE.md=== last and ===COMMIT:type: subject===.
Never invent missing source or return truncated files. Apply with npm run apply:dry,
then npm run apply -- --commit. A connected writer may edit the task branch directly
and follow docs/DELIVERY.md using the tools actually available.` : 'Review/plan only; request missing exact files together.'}
`;
}
