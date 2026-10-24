"""Offline contract for the actual one-invocation encrypted database/media drill.

Fake subprocesses prove stages, path identity, source credentials, teardown,
and failure handling without Docker, network, Auth users or cloud access.
"""
import importlib.util
import io
import os
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

SCRIPT = pathlib.Path(__file__).parents[1] / "full-recovery-drill.py"
spec = importlib.util.spec_from_file_location("full_drill", SCRIPT)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class FullRecoveryTests(unittest.TestCase):
    def test_plan_requires_no_network_or_credentials(self):
        captured = io.StringIO()
        with patch.object(sys, "argv", ["rehearse", "--plan"]), patch("sys.stdout", captured):
            m.main()
        self.assertEqual(captured.getvalue().count("MOSAIC_FULL_DR_PLAN: "), 6)
        self.assertIn("MOSAIC_FULL_DR_PLAN_NO_CLOUD_OR_SECRETS_PASS", captured.getvalue())

    def test_nested_life_tracker_checkout_git_root_and_real_worktree(self):
        # Reproduce the exact layout used by the operator: <worktree>/.git
        # holds metadata and <worktree>/life-tracker does not.
        with tempfile.TemporaryDirectory(prefix="mosaic-real-git-") as tmp:
            root = pathlib.Path(tmp) / "mosaic-photo-dr-review"
            root.mkdir()
            inner = root / "life-tracker"
            inner.mkdir()
            (inner / "fixture.txt").write_text("reviewed")
            def git(*args):
                output = subprocess.run(
                    ["git", "-C", str(inner), *args],
                    check=True, capture_output=True, text=True, timeout=25,
                )
                return output.stdout.strip()
            subprocess.run(["git", "init", "-q", str(root)], check=True,
                           capture_output=True, timeout=25)
            git("config", "user.name", "Mosaic Test")
            git("config", "user.email", "mosaic-test@example.invalid")
            git("add", ".")
            git("commit", "-qm", "fixture root")
            sha = git("rev-parse", "HEAD")
            git("fetch", "-q", ".", "HEAD")
            self.assertFalse((inner / ".git").exists())
            self.assertTrue((root / ".git").exists())
            m.exact_source(inner, sha)
            target = pathlib.Path(tmp) / "disposable"
            target.mkdir()
            try:
                git("worktree", "add", "--detach", str(target), sha)
                self.assertTrue((target / "life-tracker/fixture.txt").exists())
            finally:
                git("worktree", "remove", "--force", str(target))
            self.assertFalse(target.exists())

    def test_preflight_failure_prints_safe_stage_without_backend_output(self):
        output = io.StringIO()
        error = io.StringIO()
        old_stage = m.ACTIVE_STAGE
        m.ACTIVE_STAGE = m.STAGES[0]
        try:
            with patch.object(sys, "argv", ["drill", "--run", "--source-sha", "a" * 40]), \
                 patch.object(m, "run", side_effect=m.DrillFailure("Trusted Mosaic Git root missing above life-tracker")), \
                 patch("sys.stderr", error), patch("sys.stdout", output):
                with self.assertRaises(SystemExit) as raised:
                    m.cli()
                self.assertEqual(raised.exception.code, 1)
        finally:
            m.ACTIVE_STAGE = old_stage
        self.assertIn("MOSAIC_FULL_DR_FAILED_STAGE: 01", error.getvalue())
        self.assertIn("MOSAIC_FULL_DR_SAFE_REASON: Trusted Mosaic Git root", error.getvalue())
        self.assertNotIn("password", error.getvalue().lower())

    def test_invalid_project_and_pooler_are_blocked(self):
        with tempfile.TemporaryDirectory() as folder:
            p = pathlib.Path(folder) / "pooler.env"
            p.write_text(
                "export PGHOST=evil.pooler.supabase.com\nexport PGPORT=5432\n"
                "export PGUSER=postgres.wrong-project\nexport PGDATABASE=postgres\n"
            )
            p.chmod(0o600)
            with self.assertRaises(m.DrillFailure):
                m.pooler_config(p)
            p.write_text("$(some command)")
            with self.assertRaises(m.DrillFailure):
                m.pooler_config(p)

    def exercise(self, fail_on=None):
        with tempfile.TemporaryDirectory(prefix="mosaic-drill-sim-") as tmp:
            home = pathlib.Path(tmp)
            key = home / ".config/mosaic/supabase-backup.agekey"
            key.parent.mkdir(parents=True, mode=0o700)
            key.write_text("fake-identity-only-for-unit-test")
            key.chmod(0o600)
            pooler = key.parent / "supabase-pooler.env"
            pooler.write_text(
                "export PGHOST=aws-0-test.pooler.supabase.com\n"
                "export PGPORT=5432\nexport PGUSER=postgres.hcxtiifzxoaflhjgoglb\n"
                "export PGDATABASE=postgres\n"
            )
            pooler.chmod(0o600)
            archive_dir = home / "mosaic-secure-backups"
            archive_dir.mkdir(mode=0o700)
            repo = home / "mosaic-photo-dr-review/life-tracker"
            repo.mkdir(parents=True)
            (repo / ".git").touch()
            local = home / ".mosaic-private-recovery-AbCd1234"
            stages = []
            def pretend(args, *, cwd=None, env=None, stdin=None, output=True, timeout=120):
                cmd = args[0]
                if cmd == "git" and "worktree" in args:
                    if "add" in args:
                        pathlib.Path(args[-2]).joinpath("life-tracker/supabase-poc").mkdir(
                            parents=True
                        )
                    if "remove" in args:
                        shutil.rmtree(args[-1], ignore_errors=True)
                elif cmd == "age-keygen":
                    return "age1" + "q" * 58
                elif cmd == "bash":
                    name = pathlib.Path(args[1]).name
                    if name == "hosted-encrypted-backup.sh":
                        self.assertEqual(env["PGHOST"], "aws-0-test.pooler.supabase.com")
                        self.assertEqual(env["PGPASSWORD"], "fixture-password")
                        pathlib.Path(args[2]).write_bytes(b"fake-binary-ciphertext")
                        stages.append("snapshot")
                        return "Encrypted snapshot created (archive SHA-256): fake"
                    if name == "inspect-encrypted-backup-toc.sh":
                        self.assertNotIn("PGHOST", env)
                        stages.append("inspect")
                        return ('{"status":"METADATA_ONLY_NOT_RESTORED",'
                                '"missingRequiredEntries":[],"criticalDataEntriesExpected":6,'
                                '"criticalDataEntriesPresent":6}')
                    if name == "run-private-core-recovery.sh":
                        self.assertNotIn("PGHOST", env)
                        self.assertNotIn("PGPASSWORD", env)
                        self.assertEqual(args[-2], "--fresh-snapshot-sha256")
                        self.assertTrue(re.fullmatch(r"[a-f0-9]{64}", args[-1]))
                        local.mkdir(mode=0o700)
                        (local / "supabase").mkdir()
                        (local / "supabase/config.toml").write_text(
                            'project_id = "mosaic_dr_123456abcdef"'
                        )
                        stages.append("restore")
                        return (
                            "DISPOSABLE_CORE_RESTORE_PASS: 7 data tables, "
                            "410 exact source/target rows verified\n"
                            "ISOLATED_LOCAL_STACK_READY: mosaic_dr_123456abcdef\n"
                            "PRIVATE_DOCKER_NETWORK: mosaic_dr_net_123456abcdef\n"
                            "PRIVATE_LOCAL_DIRECTORY: " + str(local)
                        )
                elif cmd == "python3":
                    self.assertNotIn("PGUSER", env)
                    self.assertFalse(output)
                    if "verify-private-core-signin.py" in args[1]:
                        stages.append("signed-owner")
                    elif "verify-hosted-private-photo.py" in args[1]:
                        stages.append("signed-photo")
                        if fail_on == "signed-photo":
                            raise m.DrillFailure("Synthetic hosted photo lab failure")
                    else:
                        raise AssertionError(args)
                elif cmd == "supabase" and args[1] == "stop":
                    self.assertEqual(cwd, local)
                    stages.append("stop")
                elif cmd == "docker" and args[1] == "network":
                    self.assertEqual(args[-1], "mosaic_dr_net_123456abcdef")
                    stages.append("network")
                else:
                    raise AssertionError(args)
                return ""
            import builtins
            original_open = builtins.open
            def open_tty(path, *args, **kwargs):
                if path == "/dev/tty":
                    return io.StringIO("synthetic-input-not-used")
                return original_open(path, *args, **kwargs)
            output = io.StringIO()
            args = type("Args", (), {"source_sha": "a" * 40})()
            with patch.object(m.Path, "home", return_value=home), \
                 patch.object(m, "REPO", repo), \
                 patch.object(m, "exact_source", return_value=None), \
                 patch.object(m.shutil, "which", return_value="/usr/bin/synthetic"), \
                 patch.object(m, "guarded_run", side_effect=pretend), \
                 patch.object(m.getpass, "getpass", return_value="fixture-password"), \
                 patch.object(builtins, "open", side_effect=open_tty), \
                 patch("sys.stdout", output):
                if fail_on:
                    with self.assertRaises(m.DrillFailure):
                        m.run(args)
                else:
                    m.run(args)
            self.assertEqual(stages[:3], ["snapshot", "inspect", "restore"])
            self.assertIn("signed-owner", stages)
            self.assertIn("signed-photo", stages)
            self.assertIn("stop", stages)
            self.assertIn("network", stages)
            self.assertTrue(any(archive_dir.glob("mosaic-dr-*.age")))
            self.assertFalse(local.exists(), 'disposable recovered real-user data directory must be removed')
            if not fail_on:
                self.assertIn("MOSAIC_FULL_DR_COMBINED_EXISTING_GATES_PASS", output.getvalue())
            else:
                self.assertNotIn("MOSAIC_FULL_DR_COMBINED_EXISTING_GATES_PASS", output.getvalue())

    def test_one_run_through_all_stages_with_private_stack_teardown(self):
        self.exercise()

    def test_failure_after_restore_does_not_fake_pass_or_skip_cleanup(self):
        self.exercise(fail_on="signed-photo")

    def test_unsafe_metadata_or_private_directory_refuses(self):
        with self.assertRaises(m.DrillFailure):
            m.parse_metadata('{"status":"METADATA_ONLY_NOT_RESTORED","missingRequiredEntries":["auth.users"]}')
        with self.assertRaises(m.DrillFailure):
            m.parse_local(
                "ISOLATED_LOCAL_STACK_READY: mosaic_dr_123456abcdef\n"
                "PRIVATE_DOCKER_NETWORK: mosaic_dr_net_123456abcdef\n"
                "PRIVATE_LOCAL_DIRECTORY: /tmp/untrusted-recovery",
                pathlib.Path.home(),
            )


if __name__ == "__main__":
    unittest.main()
