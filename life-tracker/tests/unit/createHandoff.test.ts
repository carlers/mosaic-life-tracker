import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  assertGithubCheckpoint,
  buildWebChatPacket,
  estimateTokens,
  HANDOFF_TOKEN_WARNING,
  normalizeHandoffTarget,
  parseWorkingSet,
  promptForTarget,
  resolveWorkingSet,
  validateSessionState,
} from '../../scripts/lib/create-handoff.mjs';

const validState = `# Session state

Updated: 2026-09-19
Current task: workflow migration
Status: in_progress
Roadmap pointer: PLAN.md
Checkpoint: generator tests
Next action: run verification
Blockers: none

## Working set

- \`src/a.ts\`
- src/b.ts

## Completed substeps

- state schema

## Remaining substeps

- verification

## Constraints

- none

## Verification

- pending
`;

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'mosaic-handoff-'));
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'src/a.ts'), 'export const a = 1;\n');
  writeFileSync(join(root, 'src/b.ts'), 'export const b = 2;\n');
  writeFileSync(join(root, 'extra.ts'), 'export const extra = true;\n');
  return root;
}

describe('handoff state', () => {
  it('validates the neutral schema and parses its working set', () => {
    expect(() => validateSessionState(validState)).not.toThrow();
    expect(parseWorkingSet(validState)).toEqual(['src/a.ts', 'src/b.ts']);
  });

  it('rejects an incomplete state document', () => {
    expect(() => validateSessionState('# Session state\nUpdated: today\n')).toThrow(
      /missing required fields/
    );
  });
});

describe('handoff targets and paths', () => {
  it('validates canonical targets and normalizes compatibility aliases', () => {
    expect(promptForTarget('agent')).toContain('workspace-agent workflow');
    expect(promptForTarget('chat-plan')).toContain('Planner/Reviewer');
    expect(promptForTarget('chat-implement')).toContain('Implementer');
    expect(normalizeHandoffTarget('codex')).toEqual({ target: 'agent', alias: 'codex' });
    expect(normalizeHandoffTarget('chat')).toEqual({ target: 'chat-plan', alias: 'chat' });
    expect(normalizeHandoffTarget('deepseek-chat1')).toEqual({
      target: 'chat-plan',
      alias: 'deepseek-chat1',
    });
    expect(normalizeHandoffTarget('chatgpt-implementer')).toEqual({
      target: 'chat-implement',
      alias: 'chatgpt-implementer',
    });
    expect(() => promptForTarget('unknown')).toThrow(/Unknown handoff target/);
  });

  it('merges state paths and overrides without duplicates', () => {
    const root = fixture();
    expect(resolveWorkingSet(root, ['src/a.ts', 'src/b.ts'], ['./src/a.ts', 'extra.ts']))
      .toEqual(['src/a.ts', 'src/b.ts', 'extra.ts']);
  });

  it('rejects missing, escaping, generated, and external symlink paths', () => {
    const root = fixture();
    const outside = mkdtempSync(join(tmpdir(), 'mosaic-outside-'));
    writeFileSync(join(outside, 'secret.txt'), 'secret\n');
    symlinkSync(join(outside, 'secret.txt'), join(root, 'linked.txt'));

    expect(() => resolveWorkingSet(root, ['missing.ts'])).toThrow(/not a file/);
    expect(() => resolveWorkingSet(root, ['../outside.ts'])).toThrow(/escapes/);
    expect(() => resolveWorkingSet(root, ['repomix-output.xml'])).toThrow(/exports/);
    expect(() => resolveWorkingSet(root, ['linked.txt'])).toThrow(/outside/);
  });
});

describe('web-chat packet', () => {
  it('includes checkpoint data, dirty Git data, and exact selected files', () => {
    const root = fixture();
    const packet = buildWebChatPacket({
      target: 'chat-implement',
      projectRoot: root,
      sessionState: validState,
      plan: '# Plan\n',
      agents: '# Rules\n',
      webChatWorkflow: '# Web chat\n',
      workingSet: ['src/a.ts'],
      metricsSummary: '**Run:** task=test · gate=green@1',
      git: {
        branch: 'test-branch',
        head: 'abc1234',
        status: ' M src/a.ts',
        unstagedDiff: 'diff --git a/src/a.ts b/src/a.ts\n',
        stagedDiff: '',
      },
    });

    expect(packet).toContain('Mosaic web-chat Implementer');
    expect(packet).toContain('<file path="docs/SESSION_STATE.md">');
    expect(packet).not.toMatch(/ChatGPT|DeepSeek/);
    expect(packet).toContain('Branch: test-branch');
    expect(packet).not.toContain('### Unstaged diff');
    expect(packet).toContain('**Run:** task=test · gate=green@1');
    expect(packet).toContain('<file path="src/a.ts">');
    expect(packet).toContain('export const a = 1;');
    expect(packet).not.toContain('repomix-output.xml');
  });

  it('represents a clean checkpoint without diff sections or selected files', () => {
    const root = fixture();
    const packet = buildWebChatPacket({
      target: 'chat-plan',
      projectRoot: root,
      sessionState: validState,
      plan: '# Plan\n',
      agents: '# Rules\n',
      webChatWorkflow: '# Web chat\n',
      workingSet: [],
      git: {
        branch: '',
        head: 'def5678',
        status: '',
        unstagedDiff: '',
        stagedDiff: '',
      },
    });

    expect(packet).toContain('Branch: (detached HEAD)');
    expect(packet).toContain('(clean worktree)');
    expect(packet).toContain('No implementation files are selected');
    expect(packet).not.toContain('**Run:**');
    expect(packet).not.toContain('### Unstaged diff');
    expect(packet).not.toContain('### Staged diff');
  });

  it('normalizes provider aliases to identical provider-neutral packets', () => {
    const root = fixture();
    const input = {
      projectRoot: root,
      sessionState: validState,
      plan: '# Plan\n',
      agents: '# Rules\n',
      webChatWorkflow: '# Web chat\n',
      workingSet: [],
      git: {
        branch: 'work',
        head: 'abc1234',
        status: '',
        unstagedDiff: '',
        stagedDiff: '',
      },
    };

    expect(buildWebChatPacket({ ...input, target: 'chat-plan' })).toBe(
      buildWebChatPacket({ ...input, target: 'deepseek-chat1' })
    );
    expect(buildWebChatPacket({ ...input, target: 'chat-implement' })).toBe(
      buildWebChatPacket({ ...input, target: 'chatgpt-implementer' })
    );
    expect(() => buildWebChatPacket({ ...input, target: 'agent' })).toThrow(
      /invalid target/
    );
  });

  it('reports estimates above the warning threshold without enforcing a hard limit', () => {
    const content = 'x'.repeat(HANDOFF_TOKEN_WARNING * 4 + 1);
    expect(estimateTokens(content)).toBe(HANDOFF_TOKEN_WARNING + 1);
  });
});

// Regression: task acceptance — portable references must identify exact retrievable content.
describe('GitHub handoff transport', () => {
  const git = { branch: 'task', repository: 'https://github.com/example/project.git', head: 'a'.repeat(40), status: '', remoteHead: 'a'.repeat(40) };
  it('rejects dirty, detached, unpublished, and unavailable checkpoints', () => {
    for (const patch of [{ status: ' M src/a.ts' }, { status: ' D src/a.ts' }, { status: 'R  src/a.ts -> src/b.ts' }, { branch: '' }, { repository: '' }, { head: 'b'.repeat(40) }]) {
      expect(() => assertGithubCheckpoint({ ...git, ...patch }, git.remoteHead)).toThrow(/file packet/);
    }
    expect(() => assertGithubCheckpoint(git, '')).toThrow(/file packet/);
  });
  it('references exact files without duplicating source, instructions, or state', () => {
    const root = fixture();
    const common = { target: 'chat-plan', projectRoot: root, agents: '# Rules', sessionState: validState, git, workingSet: ['AGENTS.md', 'docs/SESSION_STATE.md', 'src/a.ts', 'src/a.ts'] };
    const reference = buildWebChatPacket({ ...common, transport: 'github' });
    expect(reference).toContain(git.head);
    expect(reference).toContain(git.repository);
    expect(reference).toContain('src/a.ts');
    expect(reference).not.toContain('export const a');
    const packet = buildWebChatPacket(common);
    expect(packet.match(/<file path="AGENTS.md">/g)).toHaveLength(1);
    expect(packet.match(/<file path="docs\/SESSION_STATE.md">/g)).toHaveLength(1);
    expect(packet.match(/export const a/g)).toHaveLength(1);
  });
});
