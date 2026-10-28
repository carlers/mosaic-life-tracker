"""No-network local-contract rehearsal for the exact post-identity R2 one-pass path."""
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

SOURCE = Path(__file__).parents[1] / 'operator-fourteen-offsite.py'
spec = importlib.util.spec_from_file_location('fourteen_r2_onepass', SOURCE)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

WRITER = 'W' * 32
READER = 'R' * 32
SECRETS = {
    'pg_password': 'p-secret-123', 'storage': 'sb_secret_'+'s'*32,
    'account': 'a'*32, 'writer': WRITER, 'writer_secret': 'w'*40,
    'reader': READER, 'reader_secret': 'r'*40,
}


class FourteenOffsiteTests(unittest.TestCase):
    def test_offline_plan_six_stages_no_cloud_or_prompts(self):
        out = io.StringIO()
        with patch.object(sys,'argv',['fourteen','--plan']),patch('sys.stdout',out), \
             patch.object(m,'cmd',side_effect=AssertionError('network forbidden')), \
             patch.object(m.getpass,'getpass',side_effect=AssertionError('prompt forbidden')):
            m.main()
        self.assertEqual(out.getvalue().count('MOSAIC_FOURTEEN_R2_PLAN: '),6)
        self.assertIn('MOSAIC_FOURTEEN_R2_PLAN_NO_CLOUD_OR_SECRETS_PASS',out.getvalue())

    def test_bad_sha_and_override_rejected_pre_credentials(self):
        for arguments in (['--run','--source-sha','something'],['--run'],['--plan','--source-sha','a'*40]):
            with self.subTest(arguments=arguments),patch.object(sys,'argv',['fourteen',*arguments]):
                with self.assertRaises(m.SafeFailure): m.main()
        with self.assertRaises(m.SafeFailure): m.source_preflight('bad',Path('/missing'))

    def test_age_key_comments_are_accepted_only_with_one_private_identity(self):
        with tempfile.TemporaryDirectory() as root:
            home = Path(root)
            keydir = home / ".config/mosaic"
            keydir.mkdir(parents=True, mode=0o700)
            key = keydir / "supabase-backup.agekey"
            key.write_text("# created: synthetic\n# public key: age1fixture\nAGE-SECRET-KEY-" + "A" * 32 + "\n")
            key.chmod(0o600)
            archive = home / "mosaic-secure-backups"
            archive.mkdir(mode=0o700)
            module = types.SimpleNamespace(
                DrillFailure=type("DrillFailure",(Exception,),{}),
                assert_private=lambda *args,**kw: None,
                pooler_config=lambda *args: {"PGHOST":"good"},
            )
            with patch.object(m,"import_source",return_value=module):
                self.assertEqual(m.private_config(home / "src",home)[1],"AGE-SECRET-KEY-" + "A"*32)
                key.write_text(key.read_text()+"AGE-SECRET-KEY-" + "B"*32 + "\n")
                with self.assertRaisesRegex(m.SafeFailure,"PRIVATE_AGE_IDENTITY_INVALID"):
                    m.private_config(home / "src",home)

    def test_reader_writer_must_be_separate_and_secrets_validated(self):
        items=['p-secret','sb_secret_'+'s'*35,'a'*32,WRITER,'w'*40,WRITER,'r'*40]
        with patch.object(m.getpass,'getpass',side_effect=items):
            with self.assertRaisesRegex(m.SafeFailure,'SEPARATE_R2_READ_ONLY_IDENTITY_REQUIRED'):
                m.operator_credentials()
        items=['p-secret','sb_publishable_'+'x'*40,'a'*32,WRITER,'w'*40,READER,'r'*40]
        with patch.object(m.getpass,'getpass',side_effect=items):
            with self.assertRaisesRegex(m.SafeFailure,'SOURCE_STORAGE_BACKEND_SECRET_INVALID'):
                m.operator_credentials()
        items=['p-secret','sb_secret_'+'s'*32,'a'*32,WRITER,'w'*40,READER,'r'*40]
        with patch.object(m.getpass,'getpass',side_effect=items):
            self.assertEqual(m.operator_credentials()['reader'],READER)

    def test_minimal_environment_does_not_inherit_hosted_or_cloud_secrets(self):
        with patch.dict(os.environ,{
            'PGPASSWORD':'exposed','PGHOST':'production',
            'AWS_SECRET_ACCESS_KEY':'secret','DATABASE_URL':'postgres://unknown',
            'DOCKER_HOST':'tcp://remote-host:2375',
            'SUPABASE_DR_R2_SECRET_ACCESS_KEY':'secret',
            'SUPABASE_SERVICE_ROLE_KEY':'service',
        }):
            result=m.minimal_env(Path('/home/operator'))
        for key in ('PGPASSWORD','PGHOST','AWS_SECRET_ACCESS_KEY','DATABASE_URL',
                    'DOCKER_HOST','SUPABASE_DR_R2_SECRET_ACCESS_KEY','SUPABASE_SERVICE_ROLE_KEY'):
            self.assertNotIn(key,result)
        self.assertEqual(result['HOME'],'/home/operator')

    def test_exact_publisher_requires_verified_completed_marker_and_pinned_profile(self):
        with tempfile.TemporaryDirectory() as root:
            scripts=Path(root)/'supabase-poc'
            scripts.mkdir()
            captured={}
            def fake_command(argv,**kwargs):
                captured.update(kwargs)
                self.assertEqual(argv, ['node',str(scripts/'unified-offsite.mjs'),'--backup'])
                return 'MOSAIC_SUPABASE_FULL_OFFSITE_COMMITTED_PASS: 20261028T081234567Z\n'
            with patch.object(m,'cmd',side_effect=fake_command):
                snap=m.guarded_publish(scripts,Path(root),{
                    'PGHOST':'aws-0-test.pooler.supabase.com',
                    'PGPORT':'5432','PGUSER':'postgres.'+m.PROJECT,'PGDATABASE':'postgres',
                },'AGE-SECRET-KEY-'+'A'*32,SECRETS)
            self.assertEqual(snap,'20261028T081234567Z')
            e=captured['env']
            self.assertEqual(e['SUPABASE_DR_RECOVERY_PROFILE'],m.PROFILE)
            self.assertEqual(e['SUPABASE_DR_R2_ACCESS_KEY_ID'],WRITER)
            self.assertEqual(e['SUPABASE_DR_R2_SECRET_ACCESS_KEY'],'w'*40)
            self.assertEqual(e['SUPABASE_DR_PRUNE_ENABLED'],'false')
            self.assertEqual(e['SUPABASE_DR_SOURCE_PROJECT'],m.PROJECT)
            self.assertEqual(e['SUPABASE_DR_AGE_IDENTITY'],'AGE-SECRET-KEY-'+'A'*32)
            with patch.object(m,'cmd',return_value='unverified'):
                with self.assertRaisesRegex(m.SafeFailure,'FOURTEEN_R2_COMPLETE_MARKER_NOT_CONFIRMED'):
                    m.guarded_publish(scripts,Path(root),{
                        'PGHOST':'p','PGPORT':'5432','PGUSER':'p','PGDATABASE':'postgres'
                    },'AGE-SECRET-KEY-'+'A'*32,SECRETS)

    def test_watcher_never_inherits_source_or_writer_credentials(self):
        with tempfile.TemporaryDirectory() as root:
            scripts=Path(root)/'supabase-poc'
            scripts.mkdir()
            snapshot='20261028T081234567Z'
            def fake_command(argv,**kwargs):
                self.assertEqual(argv,['node',str(scripts/'unified-offsite.mjs'),'--watch'])
                env=kwargs['env']
                self.assertEqual(env['SUPABASE_DR_R2_ACCESS_KEY_ID'],READER)
                self.assertEqual(env['SUPABASE_DR_RECOVERY_PROFILE'],m.PROFILE)
                for key in ('SUPABASE_DR_PGPASSWORD','SUPABASE_DR_SOURCE_STORAGE_KEY',
                            'SUPABASE_DR_AGE_IDENTITY','SUPABASE_DR_PRUNE_ENABLED','PGPASSWORD'):
                    self.assertNotIn(key,env)
                return 'MOSAIC_SUPABASE_FULL_OFFSITE_FRESH_PASS: '+snapshot+'\n'
            with patch.object(m,'cmd',side_effect=fake_command):
                m.guarded_watch(scripts,Path(root),SECRETS,snapshot)
            with patch.object(m,'cmd',return_value='MOSAIC_SUPABASE_FULL_OFFSITE_FRESH_PASS: 20261028T081234568Z'):
                with self.assertRaisesRegex(m.SafeFailure,'INDEPENDENT_R2_PROFILE_OR_COMPLETED_ID_MISMATCH'):
                    m.guarded_watch(scripts,Path(root),SECRETS,snapshot)

    def test_accepted_restore_runs_exact_existing_checks_and_uses_secret_in_memory(self):
        with tempfile.TemporaryDirectory() as root:
            scripts=Path(root)/'supabase-poc'
            scripts.mkdir()
            restored=[]
            fake=types.SimpleNamespace(
                PROFILES={m.PROFILE: ('--fresh-personal-identity-sha256',14)},
                Refused=type('Refused',(Exception,),{}),
            )
            def run(sha,snapshot,profile):
                self.assertEqual(sha,'a'*40)
                self.assertEqual(snapshot,'20261028T081234567Z')
                self.assertEqual(profile,m.PROFILE)
                restored.append(fake.read_credentials())
            fake.run=run
            with patch.object(m,'import_source',return_value=fake):
                m.guarded_restore(scripts,Path(root),'a'*40,SECRETS,'20261028T081234567Z')
            self.assertEqual(restored,[('a'*32,READER,'r'*40)])


    def test_fixed_backup_stage_can_be_passed_without_exposing_child_stderr(self):
        secret = 'do-not-echo-private-password-or-object-row'
        response = types.SimpleNamespace(
            returncode=1,
            stdout='no completed marker',
            stderr='MOSAIC_SUPABASE_FULL_OFFSITE_SAFE_STAGE: PG_DATABASE_CAPTURE\n'
                   + 'private stderr ' + secret,
        )
        previous = m.COMMITTED_SNAPSHOT
        with patch.object(m.subprocess, 'run', return_value=response):
            with self.assertRaises(m.SafeFailure) as caught:
                m.cmd(['node','trusted-unified-offsite.mjs','--backup'],backup_diagnostic=True)
        self.assertEqual(str(caught.exception),'FOURTEEN_R2_PG_DATABASE_CAPTURE_FAILED')
        self.assertNotIn(secret,str(caught.exception))
        self.assertEqual(m.COMMITTED_SNAPSHOT,previous)

    def test_published_remote_marker_survives_failed_independent_verify(self):
        before = m.COMMITTED_SNAPSHOT
        try:
            m.COMMITTED_SNAPSHOT = None
            id = '20261028T081234567Z'
            result = types.SimpleNamespace(
                returncode=1,
                stdout='MOSAIC_SUPABASE_FULL_OFFSITE_REMOTE_COMMITTED_PASS: '+id+'\n',
                stderr='MOSAIC_SUPABASE_FULL_OFFSITE_SAFE_STAGE: R2_FULL_READBACK\n',
            )
            with patch.object(m.subprocess, 'run', return_value=result):
                with self.assertRaisesRegex(m.SafeFailure,'FOURTEEN_R2_R2_FULL_READBACK_FAILED'):
                    m.cmd(['node','trusted-unified-offsite.mjs','--backup'],backup_diagnostic=True)
            self.assertEqual(m.COMMITTED_SNAPSHOT,id)
        finally:
            m.COMMITTED_SNAPSHOT = before

    def test_unrecognized_or_duplicate_stage_is_rejected_without_raw_output(self):
        before = m.COMMITTED_SNAPSHOT
        try:
            m.COMMITTED_SNAPSHOT = None
            for raw in (
                'MOSAIC_SUPABASE_FULL_OFFSITE_SAFE_STAGE: PROVIDER_KEY_BROKEN\n',
                'MOSAIC_SUPABASE_FULL_OFFSITE_SAFE_STAGE: STORAGE_CAPTURE\n'
                'MOSAIC_SUPABASE_FULL_OFFSITE_SAFE_STAGE: PG_DATABASE_CAPTURE\n',
                'Sensitive PGHOST and password on stderr\n',
            ):
                with self.subTest(raw=raw), patch.object(m.subprocess,'run',
                    return_value=types.SimpleNamespace(returncode=2,stdout='',stderr=raw)):
                    with self.assertRaises(m.SafeFailure) as caught:
                        m.cmd(['node','trusted-unified-offsite.mjs','--backup'],
                              backup_diagnostic=True)
                    self.assertEqual(str(caught.exception),'GUARDED_CHILD_FAILED')
                    self.assertEqual(m.COMMITTED_SNAPSHOT,None)
                with patch.object(m.subprocess,'run',
                    return_value=types.SimpleNamespace(returncode=2,stdout='',stderr=raw)):
                    with self.assertRaisesRegex(m.SafeFailure,'GUARDED_CHILD_FAILED'):
                        m.cmd(['git','safe-preflight'])  # no backup diagnostic permitted
        finally:
            m.COMMITTED_SNAPSHOT = before

    def exercise(self,failed_stage=None):
        with tempfile.TemporaryDirectory(prefix='mosaic-fourteen-unit-') as temp:
            home=Path(temp)
            stages=[]
            def command(argv,**kw):
                if argv[0]=='git' and 'worktree' in argv:
                    if 'add' in argv:
                        scripts=Path(argv[-2])/'life-tracker/supabase-poc'
                        scripts.mkdir(parents=True)
                        for name in ('unified-offsite.mjs','full-recovery-drill.py',
                                     'restore-unified-r2.py','check-private-docker-network.sh'):
                            (scripts/name).write_text('safe-test-placeholder')
                        stages.append('worktree-add')
                    elif 'remove' in argv:
                        shutil.rmtree(argv[-1],ignore_errors=True)
                        stages.append('worktree-remove')
                elif argv[0]=='bash':
                    stages.append('docker-probe')
                    self.assertTrue(argv[1].endswith('check-private-docker-network.sh'))
                    if failed_stage=='docker-probe': raise m.SafeFailure('LOCAL_DISPOSABLE_DOCKER_PREFLIGHT_FAILED')
                    return 'MOSAIC_LOCAL_NETWORK_PREFLIGHT_PASS\n'
                else: raise AssertionError(argv)
                return ''
            def publisher(*args):
                stages.append('publish')
                if failed_stage=='publish': raise m.SafeFailure('source backup failed')
                return '20261028T081234567Z'
            def watcher(*args):
                stages.append('watch')
                if failed_stage=='watch': raise m.SafeFailure('watch failed')
            def restorer(*args):
                stages.append('restore')
                if failed_stage=='restore': raise m.SafeFailure('restore failed')
            stream=io.StringIO()
            with patch.object(m.Path,'home',return_value=home),\
                 patch.object(m,'source_preflight',return_value=None),\
                 patch.object(m,'private_config',return_value=({'PGHOST':'s'},'AGE-SECRET-KEY-XYZ')),\
                 patch.object(m,'operator_credentials',return_value=SECRETS),\
                 patch.object(m,'guarded_publish',side_effect=publisher),\
                 patch.object(m,'guarded_watch',side_effect=watcher),\
                 patch.object(m,'guarded_restore',side_effect=restorer),\
                 patch.object(m,'cmd',side_effect=command),\
                 patch('sys.stdout',stream):
                if failed_stage:
                    with self.assertRaises(m.SafeFailure): m.run('a'*40)
                else: m.run('a'*40)
            self.assertIn('worktree-remove',stages)
            self.assertFalse(any(home.glob('.mosaic-fourteen-offsite-*')))
            if failed_stage=='docker-probe':
                self.assertNotIn('publish',stages)
            elif failed_stage=='publish':
                self.assertNotIn('watch',stages)
            elif failed_stage=='watch':
                self.assertNotIn('restore',stages)
            elif not failed_stage:
                self.assertEqual(stages,['worktree-add','docker-probe','publish','watch','restore','worktree-remove'])
                self.assertIn('MOSAIC_FOURTEEN_R2_COMPLETE_OFFSITE_DISPOSABLE_RESTORE_PASS: 20261028T081234567Z',stream.getvalue())
            else:
                self.assertNotIn('MOSAIC_FOURTEEN_R2_COMPLETE_OFFSITE_DISPOSABLE_RESTORE_PASS:',stream.getvalue())

    def test_durable_stage_order_and_isolated_cleanup_on_success(self): self.exercise()
    def test_docker_bridge_fails_before_prompts_or_cloud(self): self.exercise('docker-probe')
    def test_publisher_failure_stops_independent_watch(self): self.exercise('publish')
    def test_watcher_failure_stops_restore_and_preserves_completed_id(self): self.exercise('watch')
    def test_restore_failure_cannot_claim_complete_pass(self): self.exercise('restore')


if __name__=='__main__': unittest.main()
