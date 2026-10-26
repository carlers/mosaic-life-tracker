"""No-network rehearsal: exact R2 snapshot -> age -> local PG/Auth/Storage -> teardown."""
import importlib.util
import io
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import types
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).parents[1] / 'restore-unified-r2.py'
spec = importlib.util.spec_from_file_location('r2_restore', SCRIPT)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class OffsiteRestoreTests(unittest.TestCase):
    def test_plan_has_no_network_or_secrets_and_names_all_stages(self):
        out = io.StringIO()
        with patch.object(sys, 'argv', ['restore-unified-r2.py', '--plan']), patch('sys.stdout', out):
            m.main()
        self.assertIn('MOSAIC_R2_RESTORE_PLAN_NO_CLOUD_OR_SECRETS_PASS', out.getvalue())
        self.assertEqual(out.getvalue().count('MOSAIC_R2_RESTORE_PLAN:'), 7)
        self.assertNotIn('Access Key ID', out.getvalue())

    def test_source_pin_requires_exact_sha(self):
        for args in (['--run', '--source-sha', 'bad'], ['--run'], ['--plan', '--source-sha', 'a'*40]):
            with self.subTest(args=args), patch.object(sys, 'argv', ['restore', *args]):
                with self.assertRaises(m.Refused):
                    m.main()

    def test_environment_cannot_inherit_cloud_source_or_r2_credentials(self):
        with patch.dict(os.environ, {
            'PGHOST': 'production-source', 'SUPABASE_DR_R2_SECRET_ACCESS_KEY': 'secret',
            'AWS_SECRET_ACCESS_KEY': 'other', 'DATABASE_URL': 'production',
            'SUPABASE_SERVICE_ROLE_KEY': 'other',
            'MOSAIC_FRESH_SNAPSHOT_SHA256': 'stale',
            'MOSAIC_PERSONAL_SETTINGS_RESTORE': '1',
            'MOSAIC_BUCKET_LINKS_RESTORE': '1',
            'MOSAIC_SYNTHETIC_ARCHIVE_SHA256': 'synthetic',
            'SAFE_VAR': 'kept'
        }):
            env = m.clean_env()
        self.assertEqual(env['SAFE_VAR'], 'kept')
        for name in ('PGHOST', 'SUPABASE_DR_R2_SECRET_ACCESS_KEY', 'AWS_SECRET_ACCESS_KEY',
                     'DATABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY',
                     'MOSAIC_FRESH_SNAPSHOT_SHA256',
                     'MOSAIC_PERSONAL_SETTINGS_RESTORE', 'MOSAIC_BUCKET_LINKS_RESTORE',
                     'MOSAIC_SYNTHETIC_ARCHIVE_SHA256'):
            self.assertNotIn(name, env)

    def test_private_file_refuses_exposed_paths_and_symlinks(self):
        with tempfile.TemporaryDirectory() as root:
            k = Path(root)/'key'
            k.write_text('dummy')
            k.chmod(0o644)
            with self.assertRaises(m.Refused):
                m.private_file(k)
            k.chmod(0o600)
            m.private_file(k)
            link = Path(root)/'link'
            link.symlink_to(k)
            with self.assertRaises(m.Refused):
                m.private_file(link)

    def exercise(self, fail=None, snapshot=m.SNAPSHOT, profile="seven"):
        with tempfile.TemporaryDirectory(prefix='mosaic-offsite-mock-') as root:
            home = Path(root)
            key = home/'.config/mosaic/supabase-backup.agekey'
            key.parent.mkdir(parents=True)
            key.parent.chmod(0o700)
            key.write_text('age-secret-fixture')
            key.chmod(0o600)
            backup = home/'mosaic-secure-backups'
            backup.mkdir(mode=0o700)
            repo = home/'mosaic-photo-dr-review/life-tracker'
            repo.mkdir(parents=True)
            local = home/'.mosaic-private-recovery-AbCd1234'
            local.mkdir(mode=0o700)
            stages = []
            capture = {
                'snapshot': snapshot,
                'profile': 'seven' if fail == 'profile' else profile,
                'restore_flag': m.PROFILES[profile][0],
                'tables': m.PROFILES[profile][1],
            }

            def fake_command(argv, *, cwd=None, env=None, timeout=120, stdin=None, visible=False):
                cmd = argv[0]
                if cmd == 'git' and 'worktree' in argv:
                    if 'add' in argv:
                        scripts = Path(argv[-2])/'life-tracker/supabase-poc'
                        scripts.mkdir(parents=True)
                        for name in ('unified-offsite.mjs', 'full-recovery-drill.py'):
                            (scripts/name).write_text('')
                        (scripts/'full-recovery-drill.py').write_text('''
import re
from pathlib import Path
DIR = re.compile(r"\\.mosaic-private-recovery-[A-Za-z0-9]{8}\\Z")
NET = re.compile(r"mosaic_dr_net_[a-f0-9]{12}\\Z")
def parse_metadata(out):
    if 'VALID_TOC' not in out: raise ValueError('bad TOC')
def parse_local(out, home):
    return Path(home) / '.mosaic-private-recovery-AbCd1234', 'mosaic_dr_net_123456abcdef'
''')
                    else:
                        shutil.rmtree(argv[-1])
                    return ''
                if cmd == 'node':
                    self.assertEqual(argv[2:4], ['--download', capture.get('snapshot', m.SNAPSHOT)])
                    self.assertEqual(env.get('SUPABASE_DR_R2_BUCKET'), m.BUCKET)
                    self.assertEqual(env.get('SUPABASE_DR_R2_ACCESS_KEY_ID'), 'A'*32)
                    self.assertEqual(env.get('SUPABASE_DR_R2_SECRET_ACCESS_KEY'), 'b'*40)
                    self.assertNotIn('PGHOST', env)
                    directory = Path(argv[4])
                    directory.mkdir(mode=0o700)
                    (directory/'database.age').write_bytes(b'ciphertext-db')
                    (directory/'media.age').write_bytes(b'ciphertext-media')
                    (directory/'database.age').chmod(0o600)
                    (directory/'media.age').chmod(0o600)
                    stages.append('read-R2')
                    if fail == 'remote-mismatch':
                        raise m.Refused('R2 digest mismatch')
                    return 'MOSAIC_SUPABASE_FULL_OFFSITE_RECOVERY_PROFILE_PASS: ' + capture.get('profile', 'seven') + '\nMOSAIC_SUPABASE_FULL_OFFSITE_CIPHERTEXT_DOWNLOAD_PASS'
                if cmd == 'bash':
                    if argv[1].endswith('inspect-encrypted-backup-toc.sh'):
                        stages.append('TOC')
                        return 'VALID_TOC'
                    if argv[1].endswith('run-private-core-recovery.sh'):
                        self.assertEqual(argv[-2], capture.get('restore_flag', '--fresh-snapshot-sha256'))
                        self.assertTrue(re.fullmatch('[a-f0-9]{64}', argv[-1]))
                        self.assertEqual(Path(argv[2]).name, 'database.age')
                        self.assertNotIn('PGHOST', env or {})
                        stages.append('postgres-restore')
                        return 'DISPOSABLE_CORE_RESTORE_PASS: ' + str(capture.get('tables', 7)) + ' data tables; exact source/target rows verified'
                if cmd == 'python3':
                    if argv[1].endswith('verify-private-core-signin.py'):
                        self.assertTrue(visible)
                        stages.append('signed-auth')
                        if fail == 'signin':
                            raise m.Refused('Local original-password sign-in failed')
                        return ''
                    if argv[1].endswith('restore-private-photo-snapshot.py'):
                        self.assertEqual(Path(argv[2]).name, 'media.age')
                        self.assertEqual(Path(argv[3]), local)
                        stages.append('media-restore')
                        if fail == 'media':
                            raise m.Refused('Storage round trip mismatch')
                        return 'SUPABASE_PRIVATE_MEDIA_ALL_BUCKET_ISOLATED_RESTORE_PASS: objects=0 bytes=0\nSUPABASE_PRIVATE_MEDIA_NONEMPTY_ENCRYPTED_RESTORE_PASS'
                if cmd == 'supabase':
                    self.assertEqual(cwd, local)
                    stages.append('stop')
                    return ''
                if cmd == 'docker':
                    self.assertEqual(argv[-1], 'mosaic_dr_net_123456abcdef')
                    stages.append('network-cleanup')
                    return ''
                raise AssertionError(argv)

            import builtins
            native_open = builtins.open
            def safe_open(path, *args, **kw):
                if path == '/dev/tty':
                    return io.StringIO('local-private-signin-input')
                return native_open(path, *args, **kw)
            def age_auth(argv, **kwargs):
                self.assertEqual(argv[0], 'age')
                self.assertIn('--decrypt', argv)
                stages.append('age-auth')
                if fail == 'age':
                    return types.SimpleNamespace(returncode=1)
                return types.SimpleNamespace(returncode=0)
            out = io.StringIO()
            with patch.object(m.Path, 'home', return_value=home), \
                 patch.object(m, 'REPO', repo), \
                 patch.object(m, 'valid_source'), \
                 patch.object(m.shutil, 'which', return_value='/usr/bin/test'), \
                 patch.object(m, 'read_credentials', return_value=('a'*32, 'A'*32, 'b'*40)), \
                 patch.object(m, 'command', side_effect=fake_command), \
                 patch.object(m.subprocess, 'run', side_effect=age_auth), \
                 patch.object(builtins, 'open', side_effect=safe_open), \
                 patch('sys.stdout', out):
                if fail is None:
                    m.run('c'*40, snapshot, profile)
                else:
                    with self.assertRaises(m.Refused):
                        m.run('c'*40, snapshot, profile)
            self.assertIn('read-R2', stages)
            self.assertIn('stop', stages) if 'postgres-restore' in stages else None
            self.assertIn('network-cleanup', stages) if 'postgres-restore' in stages else None
            self.assertEqual(local.exists(), 'postgres-restore' not in stages,
                             'Disposable local state must be deleted after a started restore')
            if fail is None:
                self.assertEqual(stages[:5], ['read-R2', 'age-auth', 'age-auth', 'TOC', 'postgres-restore'])
                self.assertIn('signed-auth', stages)
                self.assertIn('media-restore', stages)
                self.assertIn('MOSAIC_R2_EXACT_SNAPSHOT_DISPOSABLE_RESTORE_PASS', out.getvalue())
            else:
                self.assertNotIn('MOSAIC_R2_EXACT_SNAPSHOT_DISPOSABLE_RESTORE_PASS', out.getvalue())
            self.assertTrue(any(backup.glob('mosaic-r2-*')))

    def test_every_stage_and_exact_remote_snapshot(self):
        self.exercise()

    def test_r2_integrity_failure_refuses_local_recovery(self):
        self.exercise('remote-mismatch')

    def test_wrong_age_key_aborts_before_pg_restore(self):
        self.exercise('age')

    def test_local_owner_signin_failure_cleans_private_stack(self):
        self.exercise('signin')

    def test_local_media_failure_cleans_private_stack(self):
        self.exercise('media')


    def test_new_completed_eight_table_source_restores_owner_history(self):
        self.exercise(snapshot='20261026T081234567Z', profile='eight-personal-settings')

    def test_new_completed_ten_table_source_restores_all_original_private_domains(self):
        self.exercise(snapshot='20261026T081235567Z', profile='ten-personal-bucket-links')

    def test_incorrect_remote_profile_fails_before_any_age_decrypt_or_postgres_restore(self):
        self.exercise(fail='profile', snapshot='20261026T081235567Z',
                      profile='ten-personal-bucket-links')

    def test_exact_generation_and_explicit_profile_are_both_required(self):
        for snapshot, profile in [
            ('20261026T081234567Z', 'ten-personal-bucket-links'),
            ('20261026T081234567Z', 'eight-personal-settings'),
            ('20261026T081234567Z', 'seven'),
        ]:
            self.assertEqual(m.checked_selection(snapshot, profile), m.PROFILES[profile])
        for snapshot, profile in [
            ('../escape', 'seven'), ('20260230T081235567Z', 'seven'),
            ('20261026T081235000Z/wrong', 'seven'),
            (m.SNAPSHOT, 'ten-personal-bucket-links'),
            ('20261026T081235000Z', 'unreviewed'),
        ]:
            with self.subTest(snapshot=snapshot, profile=profile):
                with self.assertRaises(m.Refused):
                    m.checked_selection(snapshot, profile)
        for args in [
            ['--run','--source-sha','a'*40,'--snapshot-id','20261026T081235567Z'],
            ['--run','--source-sha','a'*40,'--recovery-profile','ten-personal-bucket-links'],
            ['--plan','--recovery-profile','seven'],
        ]:
            with self.subTest(args=args), patch.object(sys,'argv',['restore',*args]):
                with self.assertRaises(m.Refused):
                    m.main()


    def test_local_restore_failure_reports_only_a_fixed_safe_checkpoint(self):
        class Failed:
            returncode = 1
            stdout = "MOSAIC_LOCAL_DR_SAFE_STAGE: STACK_START\n"
            stderr = "SECRET_PASSWORD_DO_NOT_EMIT user@email.com /etc/private\n"
        with patch.object(m.subprocess, 'run', return_value=Failed()):
            with self.assertRaisesRegex(m.Refused,
                                        r"safe checkpoint: STACK_START") as ctx:
                m.command(['bash', '/trusted/local-runner.sh'], private_restore=True)
            self.assertNotIn('SECRET_PASSWORD_DO_NOT_EMIT', str(ctx.exception))
            self.assertNotIn('user@email.com', str(ctx.exception))

    def test_unknown_or_forged_diagnostics_never_surface_original_logs(self):
        class Failed:
            returncode = 1
            stdout = ("MOSAIC_LOCAL_DR_SAFE_STAGE: FAKE_USER_EMAIL\n"
                      "MOSAIC_LOCAL_DR_SAFE_STAGE: ROW_TARGET_GUARD\n"
                      "raw private SQL source row\n")
            stderr = "another private account identifier\n"
        with patch.object(m.subprocess, 'run', return_value=Failed()):
            with self.assertRaisesRegex(m.Refused,
                                        r"safe checkpoint: ROW_TARGET_GUARD") as ctx:
                m.command(['bash', '/trusted/local-runner.sh'], private_restore=True)
            self.assertNotIn('FAKE_USER_EMAIL', str(ctx.exception))
            self.assertNotIn('private SQL', str(ctx.exception))

    def test_unreported_failure_refuses_without_printing_hidden_child_output(self):
        class Failed:
            returncode = 13
            stdout = "untrusted payload with tokens\n"
            stderr = "confidential owner data\n"
        with patch.object(m.subprocess, 'run', return_value=Failed()):
            with self.assertRaisesRegex(m.Refused,
                                        r"safe checkpoint: UNREPORTED") as ctx:
                m.command(['bash', '/trusted/local-runner.sh'], private_restore=True)
            self.assertNotIn('confidential owner', str(ctx.exception))

if __name__ == '__main__':
    unittest.main()
