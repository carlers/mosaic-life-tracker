import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { buildWebChatPacket, estimateTokens, parseWorkingSet, validateSessionState } from '../../scripts/lib/create-handoff.mjs';
import { resolve } from 'node:path';
import { checkContracts, localMarkdownTargets, markdownHeadingAnchors, missingLocalMarkdownFragments } from '../../scripts/check-project-contracts.mjs';

describe('documentation entrypoints and links', () => {
  it('resolves the migrated documentation and root agent entrypoint', () => {
    expect(checkContracts().errors).toEqual([]);
  });
  it('validates local GitHub headings, duplicates, custom anchors and code-fence exclusions', () => {
    const text = [
      '## 23.8 Permanent Account Erasure',
      '## Repeated Heading',
      '## Repeated Heading',
      '## Marked *Text*',
      '<a name="old-stable-anchor"></a>',
      '~~~md',
      '## This Is Only An Example',
      '~~~',
    ].join('\n');
    expect([...markdownHeadingAnchors(text)]).toEqual([
      '238-permanent-account-erasure',
      'repeated-heading',
      'repeated-heading-1',
      'marked-text',
      'old-stable-anchor',
    ]);
  });

  it('reports broken local heading fragments, but not valid § anchors or fenced examples', () => {
    const source = fileURLToPath(new URL('../../docs/TOMBSTONE_RETENTION.md', import.meta.url));
    const valid = '[erasure](PROJECT_REFERENCE.md#238-permanent-account-erasure)';
    const broken = '[old anchor](PROJECT_REFERENCE.md#no-such-section)';
    const fenced = '~~~md\n[example](PROJECT_REFERENCE.md#not-a-real-anchor)\n~~~';
    expect(missingLocalMarkdownFragments(valid + '\n' + fenced, source)).toEqual([]);
    expect(missingLocalMarkdownFragments(broken, source)).toEqual([
      { target: resolve(dirname(source), 'PROJECT_REFERENCE.md'), fragment: 'no-such-section' },
    ]);
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
  expect(validateSessionState('Updated: 2026-10-09\nCurrent task: missing action\n').warnings)
    .toContain('Prefer a clear next-action section or line for cross-chat recovery.');
  expect(() => validateSessionState('Current task: missing date\n## Next action\n- Continue'))
    .toThrow(/Updated/);
});

// A 3,000-token fixed handoff remains a writing target, not a CI release gate.
// An approximate character/4 estimator cannot justify blocking unrelated work.
it('advises when the default fixed handoff exceeds 3000 estimated tokens', () => {
  const root = new URL('../../', import.meta.url);
  const read = (path: string) => readFileSync(new URL(path, root), 'utf8');
  const agents = read('AGENTS.md');
  const state = read('docs/SESSION_STATE.md');
  const packet = buildWebChatPacket({ target: 'chat-plan', projectRoot: root.pathname,
    agents, sessionState: state,
    workingSet: [], git: { branch: 'task', head: 'a'.repeat(40), status: '' } });
  expect(packet).toContain(agents.trimEnd());
  expect(packet).toContain(state.trimEnd());
  const tokens = estimateTokens(packet);
  expect(tokens).toBeGreaterThan(0);
  if (tokens > 3000) {
    console.warn(`Handoff size advisory: ~${tokens} estimated tokens (target 3000). Keep checkpoints concise.`);
  }
});
