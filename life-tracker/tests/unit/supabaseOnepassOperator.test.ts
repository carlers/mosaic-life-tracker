import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../../supabase-poc/operator-onepass.py', import.meta.url));
const run = (...args: string[]) => spawnSync('python3', [script, ...args], {
  encoding: 'utf8', timeout: 12_000,
  env: { PATH: process.env.PATH ?? '', HOME: '/nonexistent', PGHOST: 'should_not_leak' },
});

describe('one-command Supabase operator rehearsal', () => {
  it('runs the actual snapshot orchestration offline without network, secrets, or cloud writes', () => {
    const result = run('--rehearse');
    expect(result.status, result.stderr || result.error?.message).toBe(0);
    expect(result.stdout).toContain('MOSAIC_ONEPASS_OFFLINE_REHEARSAL_PASS');
    expect(result.stdout).toContain('MOSAIC_ONEPASS_MAX_TWO_COMMANDS_PASS');
    expect(result.stdout).toContain('MOSAIC_ONEPASS_NO_NETWORK_OR_CLOUD_WRITES_PASS');
    expect(result.stdout).toContain('NOT_FULL_RECOVERY');
    expect(result.stdout).not.toContain('sb_secret_');
  });

  it('refuses a fake source SHA, unconfigured sensitive machine or unsafe argument combinations', () => {
    for (const args of [
      ['--media-snapshot', '--source-sha', 'a'.repeat(40)],
      ['--media-snapshot'],
      ['--rehearse', '--source-sha', 'b'.repeat(40)],
      ['--rehearse', '--media-snapshot'],
    ]) {
      const result = run(...args);
      expect(result.status).not.toBe(0);
      expect(result.stdout).not.toContain('MOSAIC_ONEPASS_PRIVATE_MEDIA_SNAPSHOT_COMPLETE');
      expect(result.stderr).not.toContain('sb_secret_');
    }
  });

  it('pins a legitimate Git SHA and denies missing, tampered or non-Scratch source without network', () => {
    const python = [
      'import sys,importlib.util,tempfile,subprocess',
      'from pathlib import Path',
      'spec=importlib.util.spec_from_file_location("onepass",sys.argv[1])',
      'p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)',
      'with tempfile.TemporaryDirectory() as tmp:',
      '  repo=Path(tmp);(repo/".git").touch()',
      '  def correct(cmd,**kwargs):',
      '    assert cmd[0]=="git" and cmd[-1]==("a"*40+":"+p.MEDIA_FILE)',
      '    return subprocess.CompletedProcess(cmd,0,("\\n".join(p.SOURCE_SNIPPETS)).encode())',
      '  assert p.source_from_git("a"*40,repo,runner=correct)',
      '  try:p.source_from_git("refs/heads/main",repo,runner=correct);assert False',
      '  except p.Refused:pass',
      '  def tampered(cmd,**kwargs):',
      '    return subprocess.CompletedProcess(cmd,0,b"untrusted script")',
      '  try:p.source_from_git("a"*40,repo,runner=tampered);assert False',
      '  except p.Refused:pass',
      'print("PINNED_SOURCE_REHEARSAL_PASS")',
    ].join('\n');
    const result = spawnSync('python3', ['-c', python, script], {
      encoding: 'utf8', timeout: 12_000,
      env: { PATH: process.env.PATH ?? '', HOME: '/nonexistent' },
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('PINNED_SOURCE_REHEARSAL_PASS');
  });
});
