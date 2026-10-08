import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildWebChatPacket, estimateTokens, parseWorkingSet, validateSessionState } from '../../scripts/lib/create-handoff.mjs';
import { resolve } from 'node:path';
import { checkContracts, localMarkdownTargets } from '../../scripts/check-project-contracts.mjs';

describe('documentation entrypoints and links', () => {
  it('resolves the migrated documentation and root agent entrypoint', () => {
    expect(checkContracts().errors).toEqual([]);
  });
  it('indexes every maintained docs Markdown file for agent discoverability', () => {
    const docs = fileURLToPath(new URL('../../docs/', import.meta.url));
    const index = readFileSync(resolve(docs, 'README.md'), 'utf8');
    const unindexed = readdirSync(docs)
      .filter((name) => name.endsWith('.md') && name !== 'README.md')
      .filter((name) => !index.includes(`](${name})`));
    expect(unindexed).toEqual([]);
  });

  it('ignores examples and external links while resolving encoded paths and IDE suffixes', () => {
    const source = resolve('/repo/docs/readme.md');
    const markdown = '[real](../file.md:12) [space](<a%20b.md>) [web](https://example.com) [anchor](#section)\n~~~~~text\n[example](missing.md)\n```\n~~~~~\n[another](other.md#section)';
    expect(localMarkdownTargets(markdown, source)).toEqual([
      '/repo/file.md', '/repo/docs/a b.md', '/repo/docs/other.md',
    ]);
  });
});

// Regression: AI_WORKFLOW.md (current checkpoint and legacy handoff structures both work).
it('validates the checked-in checkpoint and accepts missing optional working sets', () => {
  const state = readFileSync(new URL('../../docs/SESSION_STATE.md', import.meta.url), 'utf8');
  expect(() => validateSessionState(state)).not.toThrow();
  expect(parseWorkingSet('# Session checkpoint\n## Working references\n- PR #419\n')).toEqual([]);
  expect(() => validateSessionState('Updated: 2026-10-09\nCurrent task: missing action\n')).toThrow(/Next action/);
});

// Regression: AI_WORKFLOW.md (source-independent handoff context stays within its budget).
it('keeps the default fixed handoff below 3000 estimated tokens', () => {
  const root = new URL('../../', import.meta.url);
  const read = (path: string) => readFileSync(new URL(path, root), 'utf8');
  const packet = buildWebChatPacket({ target: 'chat-plan', projectRoot: root.pathname,
    agents: read('AGENTS.md'), sessionState: read('docs/SESSION_STATE.md'),
    workingSet: [], git: { branch: 'task', head: 'a'.repeat(40), status: '' } });
  expect(estimateTokens(packet)).toBeLessThanOrEqual(3000);
});
