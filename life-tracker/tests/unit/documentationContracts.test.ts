import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { buildWebChatPacket, estimateTokens, parseWorkingSet, validateSessionState } from '../../scripts/lib/create-handoff.mjs';
import { relative, resolve } from 'node:path';
import { ACCOUNT_ERASURE_POLICY } from '../../infrastructure/account-erasure-policy.mjs';
import { checkContracts, localMarkdownTargets, markdownFiles, markdownHeadingAnchors, missingLocalMarkdownFragments } from '../../scripts/check-project-contracts.mjs';

describe('documentation entrypoints and links', () => {
  it('resolves the migrated documentation and root agent entrypoint', () => {
    expect(checkContracts().errors).toEqual([]);
  });
  it('audits maintained Markdown outside docs/ as well as canonical guides', () => {
    const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
    const checked = markdownFiles(projectRoot).map((path) => relative(projectRoot, path));

    expect(checked).toEqual(expect.arrayContaining([
      'mcp-server/README.md',
      'scripts/project-intake/README.md',
      'tests/manual/category-reorder-mobile.md',
    ]));
    // The repository-root AGENTS.md is checked in addition to all project Markdown.
    expect(checkContracts().count).toBe(checked.length + 1);
  });

  it('enumerates every active erasure-policy resource in the account-erasure runbook', () => {
    const runbook = readFileSync(new URL('../../docs/ACCOUNT_ERASURE.md', import.meta.url), 'utf8');
    const section = runbook.split('## Erasure coverage\n')[1]?.split('\n## ')[0] ?? '';
    const listed = [...section.matchAll(/^\|\s*([a-z][a-z0-9_]*)\s*\|/gm)]
      .map((match) => match[1]);
    const declared = [
      ...Object.keys(ACCOUNT_ERASURE_POLICY.tables),
      ...Object.keys(ACCOUNT_ERASURE_POLICY.buckets),
    ];
    expect(listed.sort()).toEqual(declared.sort());
  });

  it('matches documented owner, peer and structured-scrub fields to the active erasure policy', () => {
    const runbook = readFileSync(new URL('../../docs/ACCOUNT_ERASURE.md', import.meta.url), 'utf8');
    const section = runbook.split('## Erasure coverage\n')[1]?.split('\n## ')[0] ?? '';
    const ruleRows = new Map(
      [...section.matchAll(/^\|\s*([a-z][a-z0-9_]*)\s*\|\s*([^|\r\n]+)\|/gm)]
        .map(([, resource, rule]) => [resource, rule])
    );
    for (const [resource, policy] of Object.entries(ACCOUNT_ERASURE_POLICY.tables)) {
      const fields = policy as { ownerField?: string; fields?: string[]; structuredScrubs?: string[] };
      const required = [
        ...(fields.ownerField ? [fields.ownerField] : []),
        ...(fields.fields ?? []),
        ...(fields.structuredScrubs ?? []),
      ].sort();
      const documented = [...(ruleRows.get(resource) ?? '').matchAll(/\x60([a-z][a-z0-9_]*)\x60/g)]
        .map((match) => match[1]).sort();
      expect(documented, 'Account erasure ' + resource + ' documented field names').toEqual(required);
    }
  });

  it('documents every actual scheduled tombstone-GC table in the operator checklist', async () => {
    const doc = readFileSync(new URL('../../docs/TOMBSTONE_RETENTION.md', import.meta.url), 'utf8');
    const checklist = doc.split('### Production rollout checklist\n')[1]?.split('\n## ')[0] ?? '';
    const item = checklist.split('\n4. ')[1]?.split('\n5. ')[0] ?? '';
    const start = item.indexOf('one result line for each of');
    const end = item.indexOf('and finish with');
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const documented = [...item.slice(start, end).matchAll(/\x60([a-z][a-z0-9_]*)\x60/g)]
      .map((match) => match[1]).sort();
    const { runGc } = createRequire(import.meta.url)(
      '../../appwrite-functions/message-action/tombstone-gc.js'
    ) as {
      runGc: (db: unknown, cutoff: string, log: () => void) => Promise<Record<string, unknown>>;
    };
    const results = await runGc(
      { listRows: async () => ({ rows: [] }) },
      '2026-08-01T00:00:00.000Z',
      () => {}
    );
    expect(documented).toEqual(Object.keys(results).sort());
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

  it('ignores literal links in inline code without hiding real links or heading slugs', () => {
    const source = resolve('/repo/docs/guide.md');
    const markdown = [
      'Use `[example](not-a-real-file.md)` or ``[example with `tick](also-not-real.md)`` as literal snippets.',
      'Escaped \\`[another real](ESCAPED.md)\\` delimiters must not hide links.',
      'Follow the actual [workflow](WORKFLOW.md).',
      '## Run `source` Checks',
    ].join('\n');
    expect(localMarkdownTargets(markdown, source)).toEqual(['/repo/docs/ESCAPED.md', '/repo/docs/WORKFLOW.md']);
    expect([...markdownHeadingAnchors(markdown)]).toContain('run-source-checks');
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
