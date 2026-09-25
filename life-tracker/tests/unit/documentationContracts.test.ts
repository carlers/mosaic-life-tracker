import { readFileSync } from 'node:fs';
import { buildWebChatPacket, estimateTokens } from '../../scripts/lib/create-handoff.mjs';
import { resolve } from 'node:path';
import { checkContracts, localMarkdownTargets } from '../../scripts/check-project-contracts.mjs';

describe('documentation entrypoints and links', () => {
  it('resolves the migrated documentation and root agent entrypoint', () => {
    expect(checkContracts().errors).toEqual([]);
  });
  it('ignores examples and external links while resolving encoded paths and IDE suffixes', () => {
    const source = resolve('/repo/docs/readme.md');
    const markdown = '[real](../file.md:12) [space](<a%20b.md>) [web](https://example.com) [anchor](#section)\n~~~~~text\n[example](missing.md)\n```\n~~~~~\n[another](other.md#section)';
    expect(localMarkdownTargets(markdown, source)).toEqual([
      '/repo/file.md', '/repo/docs/a b.md', '/repo/docs/other.md',
    ]);
  });
});

// Regression: task acceptance — source-independent context stays within the agreed budget.
it('keeps the default fixed handoff below 3000 estimated tokens', () => {
  const root = new URL('../../', import.meta.url);
  const read = (path: string) => readFileSync(new URL(path, root), 'utf8');
  const packet = buildWebChatPacket({ target: 'chat-plan', projectRoot: root.pathname,
    agents: read('AGENTS.md'), sessionState: read('docs/SESSION_STATE.md'),
    workingSet: [], git: { branch: 'task', head: 'a'.repeat(40), status: '' } });
  expect(estimateTokens(packet)).toBeLessThanOrEqual(3000);
});
