#!/usr/bin/env python3
"""One invocation: encrypted Scratch DB backup -> TOC -> disposable restore ->
signed original-password owner/privacy -> signed hosted private photo/age restore.

Not full managed Auth/SMTP or scheduled all-owner Storage disaster recovery.
No Production or dev/main writes. Requires the pre-existing private Fedora setup.
"""
import argparse
import getpass
import hashlib
import json
import os
import re
import secrets
import shlex
import shutil
import stat
import subprocess
import sys
import tempfile
from pathlib import Path

BRANCH = "feature/1027-supabase-recovery-20261020"
PROJECT = "hcxtiifzxoaflhjgoglb"
REPO = Path.home() / "mosaic-photo-dr-review/life-tracker"
SCRIPTS = "life-tracker/supabase-poc"
SHA = re.compile(r"[0-9a-f]{40}\Z")
DIR = re.compile(r"\.mosaic-private-recovery-[A-Za-z0-9]{8}\Z")
STACK = re.compile(r"mosaic_dr_[0-9a-f]{12}\Z")
NET = re.compile(r"mosaic_dr_net_[0-9a-f]{12}\Z")
STAGES = (
    "01 exact-source and saved-private-configuration preflight",
    "02 fresh PostgreSQL encrypted snapshot and authenticated full-byte TOC",
    "03 SHA-pinned isolated PostgreSQL 17 restore and exact COPY parity",
    "04 original-password local GoTrue owner and foreign-owner isolation",
    "05 hosted signed two-account private photo and encrypted byte restore",
    "06 dispose only this run's private recovery stack and temporary worktree",
)


class DrillFailure(Exception):
    pass


ACTIVE_STAGE = "01 exact-source and saved-private-configuration preflight"


def assert_private(path, directory=False):
    if path.is_symlink() or not (path.is_dir() if directory else path.is_file()):
        raise DrillFailure("Previously configured private backup resource missing")
    if not directory and not path.stat().st_size:
        raise DrillFailure("Empty private identity file")
    if stat.S_IMODE(path.stat().st_mode) & 0o077:
        raise DrillFailure("Private backup resource permissions too broad")


def pooler_config(path):
    """Read only four literal existing export assignments, never execute shell."""
    assert_private(path)
    parsed = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line or line.startswith("#"):
            continue
        if not line.startswith("export "):
            raise DrillFailure("Unexpected saved pooler configuration format")
        parts = shlex.split(line[len("export "):])
        if len(parts) != 1 or "=" not in parts[0]:
            raise DrillFailure("Malformed saved pooler configuration")
        key, value = parts[0].split("=", 1)
        if key not in ("PGHOST", "PGPORT", "PGUSER", "PGDATABASE") or key in parsed:
            raise DrillFailure("Unexpected or duplicate pooler parameter")
        parsed[key] = value
    host = parsed.get("PGHOST", "")
    if (not re.fullmatch(r"[a-z0-9-]+(?:[.][a-z0-9-]+)*[.]pooler[.]supabase[.]com", host)
        or parsed.get("PGPORT") != "5432"
        or parsed.get("PGUSER") != "postgres." + PROJECT
        or parsed.get("PGDATABASE") != "postgres"):
        raise DrillFailure("Saved IPv4 session pooler does not match approved Scratch")
    return parsed


def guarded_run(args, *, cwd=None, env=None, stdin=None, output=True, timeout=120):
    try:
        result = subprocess.run(
            args, cwd=cwd, env=env, stdin=stdin,
            stdout=subprocess.PIPE if output else None,
            stderr=subprocess.PIPE if output else None,
            text=True, check=False, timeout=timeout,
        )
    except (OSError, subprocess.SubprocessError) as exc:
        raise DrillFailure("One protected subprocess did not complete") from exc
    if result.returncode != 0:
        raise DrillFailure("One protected subprocess returned failure")
    return result.stdout or ""


def exact_source(repo, sha):
    # The operator works from <worktree>/life-tracker, but Git metadata is
    # correctly at its PARENT (either a .git file for a linked worktree or a
    # directory in a normal clone). Checking repo/.git rejected the valid
    # Fedora checkout before any backup stage could start.
    if (not SHA.fullmatch(sha) or repo.is_symlink() or not repo.is_dir()
        or repo.name != "life-tracker"
        or not (repo.parent / ".git").exists()):
        raise DrillFailure("Trusted Mosaic Git root missing above life-tracker")
    root = guarded_run(["git", "-C", str(repo), "rev-parse", "--show-toplevel"]).strip()
    if root != str(repo.parent.resolve()):
        raise DrillFailure("Mosaic nested checkout has unexpected Git root")
    actual = guarded_run(["git", "-C", str(repo), "rev-parse", "--verify", sha + "^{commit}"]).strip()
    if actual != sha:
        raise DrillFailure("Requested source Git object is not available")
    allowed = guarded_run(["git", "-C", str(repo), "merge-base", "--is-ancestor", sha, "FETCH_HEAD"])
    if allowed:
        raise DrillFailure("Unexpected Git provenance output")


def clean_env():
    env = os.environ.copy()
    for key in tuple(env):
        if key.startswith("PG") or key in (
            "DATABASE_URL", "SUPABASE_ACCESS_TOKEN", "SUPABASE_SERVICE_ROLE_KEY",
            "MOSAIC_FRESH_SNAPSHOT_SHA256", "MOSAIC_SUPABASE_SOURCE_STORAGE_KEY",
        ):
            env.pop(key, None)
    return env


def stage_run(name, callback):
    global ACTIVE_STAGE
    ACTIVE_STAGE = name
    print("MOSAIC_FULL_DR_STAGE_BEGIN: " + name, flush=True)
    result = callback()
    print("MOSAIC_FULL_DR_STAGE_PASS: " + name, flush=True)
    return result


def parse_metadata(stdout):
    start = stdout.find("{")
    if start < 0:
        raise DrillFailure("No structured authenticated TOC report")
    try:
        parsed, _ = json.JSONDecoder().raw_decode(stdout[start:])
    except json.JSONDecodeError as exc:
        raise DrillFailure("Malformed encrypted archive report") from exc
    if (parsed.get("status") != "METADATA_ONLY_NOT_RESTORED"
        or parsed.get("missingRequiredEntries") != []
        or parsed.get("criticalDataEntriesPresent") != parsed.get("criticalDataEntriesExpected")
        or parsed.get("criticalDataEntriesPresent", 0) < 6):
        raise DrillFailure("Encrypted archive missing mandatory Auth/core entries")
    return parsed


def parse_local(stdout, home):
    fields = dict(re.findall(
        r"^(ISOLATED_LOCAL_STACK_READY|PRIVATE_DOCKER_NETWORK|PRIVATE_LOCAL_DIRECTORY): ([^\r\n]+)$",
        stdout, re.M,
    ))
    if len(fields) != 3:
        raise DrillFailure("New isolated restoration target identifiers missing")
    stack = fields["ISOLATED_LOCAL_STACK_READY"]
    network = fields["PRIVATE_DOCKER_NETWORK"]
    path = Path(fields["PRIVATE_LOCAL_DIRECTORY"])
    if (not STACK.fullmatch(stack) or not NET.fullmatch(network)
        or not DIR.fullmatch(path.name) or path.parent != home
        or path.is_symlink() or not path.is_dir()):
        raise DrillFailure("Refusing unverified disposable stack identifiers")
    config = path / "supabase/config.toml"
    if "project_id = \"" + stack + "\"" not in config.read_text(encoding="utf-8"):
        raise DrillFailure("Disposable project identity mismatch")
    return path, network


def verify_markers(stdout, expected):
    if any(marker not in stdout for marker in expected):
        raise DrillFailure("A required signed safety assertion was not observed")


def run(args):
    global ACTIVE_STAGE
    ACTIVE_STAGE = STAGES[0]
    print("MOSAIC_FULL_DR_STAGE_BEGIN: " + STAGES[0], flush=True)
    home = Path.home()
    backup_key = home / ".config/mosaic/supabase-backup.agekey"
    pooler = home / ".config/mosaic/supabase-pooler.env"
    archive_dir = home / "mosaic-secure-backups"
    assert_private(backup_key)
    assert_private(archive_dir, directory=True)
    connection = pooler_config(pooler)
    exact_source(REPO, args.source_sha)
    for cmd in ("age", "age-keygen", "pg_dump", "pg_restore", "docker", "supabase", "node", "git"):
        if not shutil.which(cmd):
            raise DrillFailure("Missing local prerequisite: " + cmd)
    print("MOSAIC_FULL_DR_STAGE_PASS: " + STAGES[0], flush=True)
    # A pinned detached worktree is isolated from any user's existing worktree.
    temp = Path(tempfile.mkdtemp(prefix=".mosaic-onepass-worktree-", dir=home))
    private = None
    private_net = None
    try:
        guarded_run(["git", "-C", str(REPO), "worktree", "add", "--detach", str(temp), args.source_sha],
                    timeout=90)
        tracker = temp / "life-tracker"
        script = lambda name: str(tracker / "supabase-poc" / name)
        recipient = guarded_run(["age-keygen", "-y", str(backup_key)]).strip()
        if not re.fullmatch(r"age1[0-9a-z]{40,100}", recipient):
            raise DrillFailure("Stored private age identity has no valid public recipient")
        archive = archive_dir / ("mosaic-dr-" + secrets.token_hex(12) + ".age")
        # Existing private files are reused but source password is never written
        # to disk or the Git repo. The snapshot itself is retained encrypted.
        password = getpass.getpass("Scratch PostgreSQL password (hidden, one time): ")
        if not password:
            raise DrillFailure("Empty source database password")
        source_env = clean_env() | connection | {
            "PGPASSWORD": password, "MOSAIC_AGE_IDENTITY_FILE": str(backup_key),
            "MOSAIC_AGE_RECIPIENT": recipient,
        }
        try:
            def save():
                text = guarded_run(["bash", script("hosted-encrypted-backup.sh"), str(archive)],
                                   cwd=tracker, env=source_env, timeout=300)
                if "Encrypted snapshot created (archive SHA-256):" not in text or not archive.is_file():
                    raise DrillFailure("Encrypted PostgreSQL archive was not published")
            stage_run(STAGES[1], save)
        finally:
            source_env.pop("PGPASSWORD", None)
            password = ""
        def metadata():
            report = guarded_run(["bash", script("inspect-encrypted-backup-toc.sh"),
                                  str(archive), str(backup_key)], cwd=tracker, env=clean_env(), timeout=180)
            parse_metadata(report)
            print("MOSAIC_FULL_DR_AUTHENTICATED_TOC_PASS")
        stage_run("02b independently authenticate all backup bytes and inspect TOC", metadata)
        # Stream the encrypted snapshot: live user backups may be gigabytes.
        digest_state = hashlib.sha256()
        with archive.open("rb") as encrypted:
            for block in iter(lambda: encrypted.read(1024 * 1024), b""):
                digest_state.update(block)
        digest = digest_state.hexdigest()
        def restore():
            nonlocal private, private_net
            out = guarded_run(["bash", script("run-private-core-recovery.sh"), str(archive),
                               str(backup_key), "--fresh-snapshot-sha256", digest],
                              cwd=tracker, env=clean_env(), timeout=1500)
            if "DISPOSABLE_CORE_RESTORE_PASS: 7 data tables" not in out or "exact source/target rows verified" not in out:
                raise DrillFailure("Independent exact-row restore proof missing")
            private, private_net = parse_local(out, home)
            print("MOSAIC_FULL_DR_SOURCE_TARGET_ROWS_PASS")
        stage_run(STAGES[2], restore)
        def signin():
            # Actual verified local project; independent signed GoTrue account.
            print("Enter a populated existing account email and password for restored local sign-in.", flush=True)
            with open("/dev/tty", "r", encoding="utf-8") as tty:
                # Inherited output surfaces the existing script's CLI prompts.
                guarded_run(["python3", script("verify-private-core-signin.py"), str(private)],
                            cwd=tracker, env=clean_env(), stdin=tty, output=False, timeout=180)
            print("MOSAIC_FULL_DR_RESTORED_SIGNED_PRIVACY_PASS")
        stage_run(STAGES[3], signin)
        def photos():
            print("Enter two distinct hosted Scratch test account logins for private photo security.", flush=True)
            with open("/dev/tty", "r", encoding="utf-8") as tty:
                guarded_run(["python3", script("verify-hosted-private-photo.py")],
                            cwd=tracker, env=clean_env(), stdin=tty, output=False, timeout=240)
            print("MOSAIC_FULL_DR_HOSTED_PHOTO_ENCRYPTED_RESTORE_PASS")
        stage_run(STAGES[4], photos)
    finally:
        # If an earlier stage failed, keep its name as the primary diagnostic;
        # otherwise any cleanup error belongs to the cleanup stage.
        if sys.exc_info()[0] is None:
            ACTIVE_STAGE = STAGES[5]
        print("MOSAIC_FULL_DR_STAGE_BEGIN: " + STAGES[5], flush=True)
        # This owns ONLY an exact freshly generated private project, network and
        # temporary detached worktree. Preserve age ciphertext as DR evidence.
        errors = []
        if private is not None:
            try:
                guarded_run(["supabase", "stop", "--no-backup"], cwd=private, env=clean_env(), timeout=180)
            except DrillFailure:
                errors.append("local private Supabase stack stop")
        if private is not None and not any(
            item.startswith("local private Supabase") for item in errors
        ):
            # No user-provided path: parsed strictly from THIS run's disposable
            # restore output and validated against the exact project config.
            if (private.parent == home and DIR.fullmatch(private.name)
                and not private.is_symlink()):
                try:
                    shutil.rmtree(private)
                except OSError:
                    errors.append("private recovered data directory cleanup")
        if private_net is not None and NET.fullmatch(private_net):
            try:
                guarded_run(["docker", "network", "rm", private_net], env=clean_env(), timeout=60)
            except DrillFailure:
                errors.append("private Docker network removal")
        try:
            guarded_run(["git", "-C", str(REPO), "worktree", "remove", "--force", str(temp)], timeout=60)
        except DrillFailure:
            errors.append("temporary detached worktree removal")
        if not temp.exists() or not any(temp.iterdir()):
            temp.rmdir() if temp.exists() else None
        if errors:
            ACTIVE_STAGE = STAGES[5]
            raise DrillFailure("Isolated resource cleanup incomplete: " + ", ".join(errors))
        print("MOSAIC_FULL_DR_STAGE_PASS: " + STAGES[5], flush=True)
    print("MOSAIC_FULL_DR_COMBINED_EXISTING_GATES_PASS")
    print("NOT_FULL_RECOVERY: managed Auth/SMTP, all-owner scheduled Storage DR and separate-target nonempty media restore remain release gates")


def main():
    parser = argparse.ArgumentParser(description="One command: real encrypted Scratch core+photo recovery gates")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--plan", action="store_true", help="offline stage list; no secrets/cloud activity")
    mode.add_argument("--run", action="store_true", help="execute existing real hosted Scratch and disposable gates")
    parser.add_argument("--source-sha", help="exact reviewed isolated Supabase branch commit")
    args = parser.parse_args()
    if args.plan:
        if args.source_sha:
            raise DrillFailure("Plan mode is offline and refuses a source override")
        for item in STAGES:
            print("MOSAIC_FULL_DR_PLAN: " + item)
        print("MOSAIC_FULL_DR_PLAN_NO_CLOUD_OR_SECRETS_PASS")
        return
    if not SHA.fullmatch(args.source_sha or ""):
        raise DrillFailure("Real one-command drill requires an exact source SHA")
    run(args)


if __name__ == "__main__":
    try:
        main()
    except (DrillFailure, KeyboardInterrupt, OSError, ValueError) as exc:
        # Emit only our own fixed stage labels and program-authored guard
        # messages, never raw PostgreSQL/HTTP/credential subprocess output.
        print("MOSAIC_FULL_DR_FAILED_STAGE: " + ACTIVE_STAGE, file=sys.stderr)
        if isinstance(exc, DrillFailure):
            print("MOSAIC_FULL_DR_SAFE_REASON: " + str(exc), file=sys.stderr)
        print("MOSAIC_FULL_DR_NOT_VERIFIED", file=sys.stderr)
        sys.exit(1)
