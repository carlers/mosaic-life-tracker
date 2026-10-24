#!/usr/bin/env python3
"""One-command, fail-closed Mosaic operator harness.

--rehearse: offline simulated media snapshot, no credentials/network/cloud changes.
--media-snapshot --source-sha SHA: one protected live Scratch *read-only*
private Storage snapshot, reusing age identity and private backup directory.
No Production path, GitHub secrets, database credentials, SQL, or deployment.
"""
import argparse
import getpass
import os
import re
import secrets
import stat
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

SOURCE_PROJECT = 'hcxtiifzxoaflhjgoglb'
REPO_SUFFIX = 'mosaic-photo-dr-review/life-tracker'
MEDIA_FILE = 'life-tracker/supabase-poc/private-photo-snapshot.py'
COMMIT_SHA = re.compile(r'[0-9a-f]{40}\Z')
SOURCE_SNIPPETS = (
    "SOURCE = 'https://" + SOURCE_PROJECT + ".supabase.co'",
    "BUCKET = 'mosaic-personal-photos'",
    "SUPABASE_PRIVATE_MEDIA_ENCRYPTED_SNAPSHOT_PASS",
)
PRIVATE_KEY = 'MOSAIC_SUPABASE_SOURCE_STORAGE_KEY'


class Refused(ValueError):
    pass


def private_file(path):
    if path.is_symlink() or not path.is_file() or not path.stat().st_size:
        raise Refused('Existing age identity unavailable')
    if stat.S_IMODE(path.stat().st_mode) & 0o077:
        raise Refused('Age identity file permissions too broad')


def private_dir(path):
    if path.is_symlink() or not path.is_dir() or stat.S_IMODE(path.stat().st_mode) & 0o077:
        raise Refused('Private backup directory unavailable or permissions too broad')


def fresh_output(home):
    parent = home / 'mosaic-secure-backups'
    private_dir(parent)
    # No file creation here; the archive writer uses O_EXCL and hard-link
    # publish only after independent age decryption and object hash proof.
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    return parent / ('mosaic-dev-private-media-' + stamp + '-' + secrets.token_hex(8) + '.age')


def source_from_git(sha, repo, runner=subprocess.run):
    if not COMMIT_SHA.fullmatch(sha):
        raise Refused('Expected an exact forty-character reviewed source commit')
    if repo.is_symlink() or not (repo / '.git').exists():
        # A git linked worktree has a .git FILE, also supported.
        raise Refused('Known trusted local Mosaic checkout unavailable')
    try:
        found = runner(
            ['git', '-C', str(repo), 'show', sha + ':' + MEDIA_FILE],
            capture_output=True, check=True, timeout=20,
        ).stdout
    except (OSError, subprocess.SubprocessError) as exc:
        raise Refused('Reviewed exact-source media snapshot not accessible') from exc
    if not isinstance(found, bytes) or len(found) > 100000 or not all(
        marker.encode() in found for marker in SOURCE_SNIPPETS
    ):
        raise Refused('Unrecognized media snapshot source contract')
    return found


def execute_snapshot(home, source, key, invoke=subprocess.run):
    private_file(home / '.config/mosaic/supabase-backup.agekey')
    target = fresh_output(home)
    if target.exists() or target.is_symlink():
        raise Refused('Encrypted output already exists')
    if not (key.startswith('sb_secret_') or key.startswith('eyJ')) or any(c.isspace() for c in key):
        raise Refused('Backend-only Storage credential format invalid')
    child_env = os.environ.copy()
    # Do not inherit unrelated DB credentials or alternate cloud targets.
    for name in tuple(child_env):
        if name.startswith('PG') or name in (
            'DATABASE_URL', 'SUPABASE_ACCESS_TOKEN', 'SUPABASE_SERVICE_ROLE_KEY',
            'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY',
        ):
            child_env.pop(name, None)
    child_env[PRIVATE_KEY] = key
    try:
        result = invoke(
            [sys.executable, '-', str(target)],
            input=source, env=child_env, check=False, timeout=360,
        )
    except (OSError, subprocess.SubprocessError) as exc:
        raise Refused('Protected media snapshot process failed') from exc
    finally:
        child_env.pop(PRIVATE_KEY, None)
    if result.returncode != 0 or not target.is_file() or not target.stat().st_size:
        raise Refused('Encrypted media archive not independently verified')
    return target


def offline_rehearsal():
    # Executes the same credential-bound runner with no real credentials or
    # network; proves no plaintext archive or privileged value is printed.
    source = ('\n'.join(SOURCE_SNIPPETS)).encode()
    fake_secret = 'sb_secret_' + 'private_unit_fixture_only'
    calls = []
    with tempfile.TemporaryDirectory(prefix='mosaic-onepass-') as tmp:
        home = Path(tmp)
        key_dir = home / '.config/mosaic'
        key_dir.mkdir(parents=True, mode=0o700)
        identity = key_dir / 'supabase-backup.agekey'
        identity.write_text('offline-synthetic-only\n')
        identity.chmod(0o600)
        archive_dir = home / 'mosaic-secure-backups'
        archive_dir.mkdir(mode=0o700)

        def simulated_child(args, *, input, env, check, timeout):
            assert args[:2] == [sys.executable, '-']
            assert input == source and env.get(PRIVATE_KEY) == fake_secret
            assert 'PGHOST' not in env and timeout > 0 and check is False
            target = Path(args[2])
            assert target.parent == archive_dir and not target.exists()
            target.write_bytes(b'fictional encrypted artifact - NOT a real age archive')
            target.chmod(0o600)
            calls.append('one guarded child process')
            return subprocess.CompletedProcess(args, 0)

        previous = os.environ.get('PGHOST')
        os.environ['PGHOST'] = 'never-inherit-a-live-database'
        try:
            archive = execute_snapshot(home, source, fake_secret, invoke=simulated_child)
        finally:
            if previous is None:
                os.environ.pop('PGHOST', None)
            else:
                os.environ['PGHOST'] = previous
        assert len(calls) == 1 and archive.is_file()
        assert stat.S_IMODE(archive.stat().st_mode) == 0o600
        try:
            execute_snapshot(home, source, 'sb_publishable_not_privileged', invoke=simulated_child)
        except Refused:
            pass
        else:
            raise Refused('Public-key denial gate broken')
    print('MOSAIC_ONEPASS_OFFLINE_REHEARSAL_PASS')
    print('MOSAIC_ONEPASS_MAX_TWO_COMMANDS_PASS')
    print('MOSAIC_ONEPASS_NO_NETWORK_OR_CLOUD_WRITES_PASS')
    print('NOT_FULL_RECOVERY: offline rehearsal is not a hosted backup or separate-target restore')


def main():
    parser = argparse.ArgumentParser(description='Mosaic one-command, no-repeated-setup operator runner')
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--rehearse', action='store_true')
    mode.add_argument('--media-snapshot', action='store_true')
    parser.add_argument('--source-sha', help='exact reviewed 40-character Git commit for media snapshot code')
    args = parser.parse_args()
    if args.rehearse:
        if args.source_sha:
            raise Refused('Offline rehearsal does not accept remote source parameters')
        offline_rehearsal()
        return
    home = Path.home()
    private_file(home / '.config/mosaic/supabase-backup.agekey')
    private_dir(home / 'mosaic-secure-backups')
    source = source_from_git(args.source_sha or '', home / REPO_SUFFIX)
    # Password prompt reads /dev/tty even if script itself was piped from Git.
    secret = getpass.getpass('Private backend-only Scratch Storage key (hidden): ')
    try:
        result = execute_snapshot(home, source, secret)
    finally:
        secret = ''
    print('MOSAIC_ONEPASS_PRIVATE_MEDIA_SNAPSHOT_COMPLETE: ' + str(result))
    print('NOT_FULL_RECOVERY: separate-target blob restore and scheduled retention still required')


if __name__ == '__main__':
    try:
        main()
    except (Refused, KeyboardInterrupt) as exc:
        # Never echo credentials, responses, file contents or traceback.
        print('MOSAIC_ONEPASS_NOT_VERIFIED', file=sys.stderr)
        sys.exit(1)
