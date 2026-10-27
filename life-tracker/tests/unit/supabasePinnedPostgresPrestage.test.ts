import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const helper = fileURLToPath(new URL('../../supabase-poc/ci/prestage-pinned-postgres.sh', import.meta.url));
const digest = 'sha256:4c087262afbfbb47da86e2863a52d7e424eb21ab589f732d77eeaab51be8e521';
const workflows: readonly [string, string][] = [
  ['supabase-core-app.yml', 'Configure disposable Supabase with core authority'],
  ['supabase-real-gotrue-restore.yml', 'Exercise real local Auth account recovery'],
  ['supabase-eight-table-restore.yml', 'Prove age-encrypted nonempty personal Settings 8-table restore with signed GoTrue'],
  ['supabase-ten-table-restore.yml', 'Prove PG17 age-encrypted ten-table exact-copy restore and signed two-owner RLS'],
];

describe('digest-pinned official Supabase PG17 CI prestage (#1027)', () => {
  it.each(workflows)('%s prestages PG before unchanged real disposable tests', (name, realStep) => {
    const workflow = readFileSync(new URL('../../../.github/workflows/' + name, import.meta.url), 'utf8');
    expect(workflow).toContain('uses: docker/login-action@v4');
    const step = workflow.indexOf('run: bash supabase-poc/ci/prestage-pinned-postgres.sh');
    expect(step).toBeGreaterThan(workflow.indexOf('uses: docker/login-action@v4'));
    expect(workflow.indexOf('- name: ' + realStep)).toBeGreaterThan(step);
    expect(workflow).toMatch(/permissions:\s*\n\s*contents: read\s*\n\s*packages: read/);
    expect(workflow).not.toMatch(/packages:\s*write/);
    expect(workflow).not.toContain('continue-on-error: true');
  });

  it('uses only the trusted, pinned official amd64 manifest and unchanged local CLI tag', () => {
    const content = readFileSync(helper, 'utf8');
    expect(content).toContain('docker.io/supabase/postgres@' + digest);
    expect(content).toContain('ghcr.io/supabase/postgres:17.6.1.095');
    expect(content).toContain('docker pull --platform linux/amd64');
    expect(content).toContain('docker image inspect');
    expect(content).toContain('docker tag "$source_image" "$target_image"');
    expect(content).not.toMatch(/\b(?:docker build|curl|wget|eval|sudo|--insecure)\b/);
    expect(spawnSync('bash', ['-n', helper], { encoding: 'utf8' }).status).toBe(0);
  });

  it('tags only a verified digest and platform; never silently substitutes another image', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mosaic-pinned-pg-'));
    const log = join(dir, 'calls');
    const docker = join(dir, 'docker');
    const fakeDocker = `#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$1" >> "$MOCK_DOCKER_LOG"
case "$1" in
  pull)
    [[ "$*" == *'docker.io/supabase/postgres@'$MOCK_PINNED_DIGEST* ]]
    ;;
  image)
    [[ "$2" == inspect ]]
    case "$4" in
      '{{.Id}}')
        echo "sha256:synthetic-image-id"
        ;;
      '{{.Os}}/{{.Architecture}}')
        echo "$MOCK_PLATFORM"
        ;;
      '{{json .RepoDigests}}')
        echo "[\\\"docker.io/supabase/postgres@$MOCK_REPO_DIGEST\\\"]"
        ;;
      *) exit 1 ;;
    esac
    ;;
  tag)
    [[ "$2" == *'docker.io/supabase/postgres@'* ]]
    [[ "$3" == 'ghcr.io/supabase/postgres:17.6.1.095' ]]
    ;;
  *) exit 1 ;;
esac
`;
    try {
      writeFileSync(docker, fakeDocker);
      chmodSync(docker, 0o700);
      const call = (platform: string, actualDigest: string) => {
        writeFileSync(log, '');
        const result = spawnSync('bash', [helper], {
          encoding: 'utf8',
          env: {
            ...process.env,
            PATH: dir + ':' + process.env.PATH,
            MOCK_DOCKER_LOG: log,
            MOCK_PINNED_DIGEST: digest,
            MOCK_PLATFORM: platform,
            MOCK_REPO_DIGEST: actualDigest,
          },
        });
        return { ...result, calls: readFileSync(log, 'utf8').trim().split('\\n') };
      };
      const good = call('linux/amd64', digest);
      expect(good.status, good.stderr).toBe(0);
      expect(good.stdout).toContain('MOSAIC_SUPABASE_POSTGRES_PIN_PASS');
      expect(good.calls).toContain('tag');
      for (const [platform, checked] of [['linux/arm64', digest], ['linux/amd64', 'sha256:wrong-digest']]) {
        const bad = call(platform, checked);
        expect(bad.status).not.toBe(0);
        expect(bad.calls).not.toContain('tag');
        expect(bad.stderr).toContain('MOSAIC_SUPABASE_POSTGRES_PIN_VERIFICATION_FAILED');
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
