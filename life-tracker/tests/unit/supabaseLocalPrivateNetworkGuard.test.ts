import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../../supabase-poc/check-private-docker-network.sh', import.meta.url));

function withFakeDocker<T>(
  fn: (run: (args: string[], opts?: { error?: string; context?: string }) => {
    status: number | null; stdout: string; stderr: string; calls: string[];
  }) => T,
): T {
  const home = mkdtempSync(join(tmpdir(), 'mosaic-docker-net-safe-'));
  try {
    const bin = join(home, 'bin');
    mkdirSync(bin);
    const calls = join(home, 'docker-commands.log');
    const docker = join(bin, 'docker');
    writeFileSync(docker, String.raw`#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$1 $2" >> "$MOSAIC_MOCK_DOCKER_CALLS"
case "$1:$2" in
  context:show) printf 'default\n' ;;
  context:inspect) printf '%s\n' "$MOSAIC_MOCK_CONTEXT_HOST" ;;
  network:create)
    if [[ -n "$MOSAIC_MOCK_DOCKER_ERROR" ]]; then
      printf '%s\n' "$MOSAIC_MOCK_DOCKER_ERROR" >&2
      exit 1
    fi
    printf 'fake-generated-network-id\n'
    ;;
  network:rm) ;;
  *) exit 88 ;;
esac
`);
    chmodSync(docker, 0o700);
    return fn((args, opts = {}) => {
      writeFileSync(calls, '');
      const env = {
        ...process.env,
        PATH: bin + ':' + (process.env.PATH || '/usr/bin:/bin'),
        HOME: home,
        MOSAIC_MOCK_DOCKER_CALLS: calls,
        MOSAIC_MOCK_DOCKER_ERROR: opts.error || '',
        MOSAIC_MOCK_CONTEXT_HOST: opts.context || 'unix:///var/run/docker.sock',
      };
      const done = spawnSync('bash', [script, ...args], { encoding: 'utf8', env, timeout: 15_000 });
      if (done.error) throw done.error;
      return {
        status: done.status,
        stdout: done.stdout,
        stderr: done.stderr,
        calls: readFileSync(calls, 'utf8').trim().split('\n').filter(Boolean),
      };
    });
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
}

describe('private disposable restore Docker network guard (#1027)', () => {
  it.each([
    ['Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?', 'NETWORK_DAEMON_UNAVAILABLE'],
    ['could not find an available, non-overlapping IPv4 address pool among the defaults', 'NETWORK_POOL_EXHAUSTED'],
    ['permission denied while trying to connect to the Docker daemon socket', 'NETWORK_PERMISSION_DENIED'],
    ['iptables failed: nonsecret unsupported rule', 'NETWORK_CREATE_FAILED'],
  ])('classifies failed network allocation privately (%s)', (error, stage) => {
    withFakeDocker(run => {
      const result = run(['--probe'], { error });
      expect(result.status).not.toBe(0);
      expect(result.stdout).toContain('MOSAIC_LOCAL_DR_SAFE_STAGE: ' + stage);
      expect(result.stdout + result.stderr).not.toContain(error);
      expect(result.calls).toContain('network create');
      expect(result.calls).not.toContain('network rm');
      expect(result.calls).not.toContain('network prune');
    });
  });

  it('creates and destroys only its own randomized loopback bridge when probing', () => {
    withFakeDocker(run => {
      const result = run(['--probe']);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain('MOSAIC_LOCAL_NETWORK_PREFLIGHT_PASS');
      expect(result.calls).toContain('network create');
      expect(result.calls).toContain('network rm');
      expect(result.calls).not.toContain('network prune');
    });
  });

  it('allows only an exact generated disposable name when creating the actual bridge', () => {
    withFakeDocker(run => {
      const accepted = run(['--create', 'mosaic_dr_net_0123456789ab']);
      expect(accepted.status).toBe(0);
      expect(accepted.calls).toContain('network create');
      expect(accepted.calls).not.toContain('network rm');
      const denied = run(['--create', 'bridge']);
      expect(denied.status).not.toBe(0);
      expect(denied.stdout).toContain('NETWORK_UNRECOGNIZED_REQUEST');
      expect(denied.calls).not.toContain('network create');
    });
  });

  it('never creates a bridge when the Docker context is remote', () => {
    withFakeDocker(run => {
      const denied = run(['--probe'], { context: 'tcp://10.0.0.2:2375' });
      expect(denied.status).not.toBe(0);
      expect(denied.stdout).toContain('NETWORK_REMOTE_DOCKER_DENIED');
      expect(denied.calls).not.toContain('network create');
    });
  });
});
