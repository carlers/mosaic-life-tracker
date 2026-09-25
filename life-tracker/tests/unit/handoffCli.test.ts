import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { createEvent } from '../../scripts/lib/workflow-metrics.mjs';

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach((path) => rmSync(path, { recursive: true, force: true })));
function fixture() {
  const base = mkdtempSync(join(tmpdir(), 'mosaic-cli-'));
  roots.push(base);
  const root = join(base, 'project');
  mkdirSync(join(root, 'scripts/lib'), { recursive: true });
  for (const file of ['scripts/create-handoff.mjs', 'scripts/clipboard.mjs', 'scripts/lib/create-handoff.mjs', 'scripts/lib/workflow-metrics.mjs', 'apply-changes.mjs']) {
    cpSync(new URL(`../../${file}`, import.meta.url), join(root, file));
  }
  mkdirSync(join(root, 'docs'));
  writeFileSync(join(root, 'AGENTS.md'), '# Essential rules\n');
  const state = 'Updated: today\nCurrent task: CLI regression\nStatus: active\nNext action: verify\nBlockers: none\n\n## Working set\n- AGENTS.md\n\n## Completed substeps\n- setup\n\n## Remaining substeps\n- checks\n\n## Constraints\n- preserve behavior\n\n## Verification\n- pending\n';
  writeFileSync(join(root, 'docs/SESSION_STATE.md'), state);
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '-b', 'task');
  git('config', 'user.email', 'fixture@example.test');
  git('config', 'user.name', 'Fixture');
  git('add', '.');
  git('commit', '-m', 'fixture');
  const remote = join(base, 'remote.git');
  execFileSync('git', ['init', '--bare', remote], { stdio: 'ignore' });
  git('remote', 'add', 'origin', remote);
  git('push', '-u', 'origin', 'task');
  const run = (...args: string[]) => spawnSync(process.execPath, ['scripts/create-handoff.mjs', ...args, '--stdout'], { cwd: root, encoding: 'utf8', timeout: 10000, env: { ...process.env, DISPLAY: '', WAYLAND_DISPLAY: '' } });
  return { root, state, git, run };
}

describe('handoff command migration', () => {
  it('loads docs state, verifies the remote SHA, and rejects dirty or unpublished references', () => {
    const { root, git, run } = fixture();
    const clean = run('chat-plan', '--transport', 'github');
    expect(clean.status, clean.stderr).toBe(0);
    expect(clean.stdout).toContain(git('rev-parse', 'HEAD'));
    expect(clean.stdout).not.toContain('Wrote .mosaic-handoff');
    rmSync(join(root, '.mosaic-handoff.md'));
    git('mv', 'AGENTS.md', 'RENAMED.md');
    const dirty = run('chat-plan', '--transport', 'github');
    expect(dirty.status).toBe(1);
    git('reset', '--hard', 'HEAD');
    writeFileSync(join(root, 'AGENTS.md'), '# Changed rules\n');
    git('add', 'AGENTS.md');
    git('commit', '-m', 'unpublished');
    expect(run('chat-plan', '--transport', 'github').stderr).toContain('file packet');
    expect(run('chat-plan').status).toBe(0);
  });
  it('does not touch an existing ledger unless telemetry is explicitly requested', () => {
    const { root, run } = fixture();
    mkdirSync(join(root, '.mosaic/metrics'), { recursive: true });
    const ledger = join(root, '.mosaic/metrics/events.jsonl');
    const before = JSON.stringify(createEvent('task_started', { taskId: 'fixture', profile: 'routine', surface: 'workspace-agent' })) + '\n';
    writeFileSync(ledger, before);
    expect(run('chat-plan').status).toBe(0);
    expect(readFileSync(ledger, 'utf8')).toBe(before);
    expect(run('chat-plan', '--telemetry').status).toBe(0);
    expect(readFileSync(ledger, 'utf8')).toContain('handoff_recorded');
  });
  it('accepts the moved checkpoint in installer dry-run without changing it', () => {
    const { root, state } = fixture();
    writeFileSync(join(root, 'pending-changes.txt'), `~~~~~mosaic\n===FILE:docs/SESSION_STATE.md===\n${state}\n===DELETE:obsolete.md===\n===COMMIT:docs: checkpoint===\n~~~~~`);
    const result = spawnSync(process.execPath, ['apply-changes.mjs', '--dry-run'], { cwd: root, encoding: 'utf8', timeout: 10000, env: { ...process.env, DISPLAY: '', WAYLAND_DISPLAY: '' } });
    expect(result.status, result.stderr).toBe(0);
    expect(readFileSync(join(root, 'docs/SESSION_STATE.md'), 'utf8')).toBe(state);
  });
});
