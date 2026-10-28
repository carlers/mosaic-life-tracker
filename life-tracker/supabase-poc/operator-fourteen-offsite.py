#!/usr/bin/env python3
"""Owner-only, exact-SHA fourteen-table Scratch backup -> R2 -> disposable DR.

This is an ALTERNATIVE operator-run path while main-only GitHub workflows await
normal branch protection. It neither grants consent nor changes hosted SQL,
managed Auth, Production or release evidence. Secrets stay in terminal memory.
"""
import argparse
import getpass
import importlib.util
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile

PROJECT = "hcxtiifzxoaflhjgoglb"
PROFILE = "fourteen-personal-identity"
BUCKET = "mosaic-supabase-backups"
REPO = Path.home() / "mosaic-photo-dr-review/life-tracker"
SHA = re.compile(r"[a-f0-9]{40}\Z")
SNAPSHOT = re.compile(r"[0-9]{8}T[0-9]{9}Z\Z")
STAGES = (
    "01 exact source, local private escrow and disposable Docker preflight",
    "02 source and independent R2 credentials in private operator terminal",
    "03 exact fourteen-table encrypted PostgreSQL/Auth and whole-media R2 commit",
    "04 independent read-only R2 entire ciphertext and profile verification",
    "05 independent fresh PG17/GoTrue owner/foreign and private-media restore",
    "06 remove only this run's temporary detached Git worktree",
)
ACTIVE_STAGE = STAGES[0]
COMMITTED_SNAPSHOT = None


class SafeFailure(Exception):
    """Only constant, programmer-authored messages may be displayed."""


def cmd(argv, *, cwd=None, env=None, timeout=90):
    """Run trusted fixed argv. Never echo provider errors, credentials or stdout."""
    try:
        result = subprocess.run(
            argv, cwd=cwd, env=env, check=False, timeout=timeout,
            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True,
        )
    except (OSError, subprocess.SubprocessError) as exc:
        raise SafeFailure("GUARDED_CHILD_UNAVAILABLE") from exc
    if result.returncode != 0:
        raise SafeFailure("GUARDED_CHILD_FAILED")
    return result.stdout


def stage(index, callback):
    global ACTIVE_STAGE
    ACTIVE_STAGE = STAGES[index]
    print("MOSAIC_FOURTEEN_R2_STAGE_BEGIN: " + ACTIVE_STAGE, flush=True)
    result = callback()
    print("MOSAIC_FOURTEEN_R2_STAGE_PASS: " + ACTIVE_STAGE, flush=True)
    return result


def source_preflight(sha, repo=REPO):
    if not SHA.fullmatch(sha or "") or repo.is_symlink() or not repo.is_dir() or repo.name != "life-tracker":
        raise SafeFailure("EXACT_TRUSTED_SOURCE_REQUIRED")
    root = cmd(["git", "-C", str(repo), "rev-parse", "--show-toplevel"]).strip()
    fetched = cmd(["git", "-C", str(repo), "rev-parse", "FETCH_HEAD"]).strip()
    resolved = cmd(["git", "-C", str(repo), "rev-parse", "--verify", sha + "^{commit}"]).strip()
    if root != str(repo.parent.resolve()) or fetched != sha or resolved != sha:
        raise SafeFailure("EXACT_FETCHED_SOURCE_MISMATCH")
    for binary in ("git", "node", "python3", "age", "age-keygen", "docker", "supabase", "pg_dump", "pg_restore"):
        if not shutil.which(binary):
            raise SafeFailure("PRIVATE_OPERATOR_PREREQUISITE_MISSING")
    for binary in ("pg_dump", "pg_restore"):
        version = cmd([binary, "--version"]).strip()
        if not re.search(r"PostgreSQL\) 17(?:\.|\s)", version):
            raise SafeFailure("POSTGRESQL_17_CLIENT_REQUIRED")


def private_config(scripts, home):
    """Reuse the previously accepted private pooler and age-identity parser."""
    module = import_source(scripts / "full-recovery-drill.py", "mosaic_private_pooler")
    key = home / ".config/mosaic/supabase-backup.agekey"
    pooler = home / ".config/mosaic/supabase-pooler.env"
    archive_dir = home / "mosaic-secure-backups"
    try:
        module.assert_private(key)
        module.assert_private(archive_dir, directory=True)
        connection = module.pooler_config(pooler)
    except (ValueError, OSError, module.DrillFailure) as exc:
        raise SafeFailure("PRIVATE_LOCAL_ESCROW_OR_POOLER_INVALID") from exc
    if key.stat().st_size > 512:
        raise SafeFailure("PRIVATE_AGE_IDENTITY_OVERSIZED")
    # Normal age-keygen escrow includes harmless comment lines; extract only
    # the ONE secret identity, never echo comments or private key to logs.
    entries = [line.strip() for line in key.read_text(encoding="utf-8").splitlines()
               if line.strip() and not line.lstrip().startswith("#")]
    if len(entries) != 1 or not re.fullmatch(r"AGE-SECRET-KEY-[A-Z0-9]+", entries[0]):
        raise SafeFailure("PRIVATE_AGE_IDENTITY_INVALID")
    return connection, entries[0]


def import_source(path, name):
    if not path.is_file() or path.is_symlink():
        raise SafeFailure("PINNED_RECOVERY_COMPONENT_MISSING")
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise SafeFailure("PINNED_RECOVERY_MODULE_UNAVAILABLE")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def operator_credentials():
    """Never print or persist these; reject same read/write R2 identity."""
    password = getpass.getpass("mosaic-dev Scratch PostgreSQL password (hidden): ")
    storage = getpass.getpass("mosaic-dev backend-only Storage secret (hidden): ")
    account = getpass.getpass("Cloudflare R2 account ID (hidden): ")
    writer = getpass.getpass("Dedicated Supabase R2 WRITE Access Key ID (hidden): ")
    writer_secret = getpass.getpass("Dedicated Supabase R2 WRITE Secret Access Key (hidden): ")
    reader = getpass.getpass("Dedicated Supabase R2 READ-ONLY Access Key ID (hidden): ")
    reader_secret = getpass.getpass("Dedicated Supabase R2 READ-ONLY Secret Access Key (hidden): ")
    def access(value):
        return re.fullmatch(r"[A-Za-z0-9]{16,128}", value or "") is not None
    def secret(value):
        return 16 <= len(value or "") <= 256 and not any(c.isspace() for c in value)
    if not password or any(c in password for c in "\r\n\0"):
        raise SafeFailure("SOURCE_PASSWORD_INVALID")
    if not storage.startswith("sb_secret_") or len(storage) < 22 or any(c.isspace() for c in storage):
        raise SafeFailure("SOURCE_STORAGE_BACKEND_SECRET_INVALID")
    if not re.fullmatch(r"[a-f0-9]{32}", account or ""):
        raise SafeFailure("R2_ACCOUNT_ID_INVALID")
    if not access(writer) or not secret(writer_secret):
        raise SafeFailure("R2_WRITER_CREDENTIALS_INVALID")
    if not access(reader) or not secret(reader_secret):
        raise SafeFailure("R2_READER_CREDENTIALS_INVALID")
    if reader == writer or reader_secret == writer_secret:
        raise SafeFailure("SEPARATE_R2_READ_ONLY_IDENTITY_REQUIRED")
    return {
        "pg_password": password, "storage": storage, "account": account,
        "writer": writer, "writer_secret": writer_secret,
        "reader": reader, "reader_secret": reader_secret,
    }


def minimal_env(home):
    """Never inherit any unverified provider credentials or hosted DB context."""
    env = {"HOME": str(home), "PATH": os.environ.get("PATH", "")}
    for optional in ("LANG", "LC_ALL", "SSL_CERT_FILE", "SSL_CERT_DIR", "XDG_RUNTIME_DIR"):
        if os.environ.get(optional):
            env[optional] = os.environ[optional]
    return env


def guarded_publish(scripts, home, connection, age_key, secrets):
    env = minimal_env(home) | {
        "SUPABASE_DR_ENABLED": "true",
        "SUPABASE_DR_RECOVERY_PROFILE": PROFILE,
        "SUPABASE_DR_SOURCE_PROJECT": PROJECT,
        "SUPABASE_DR_PGHOST": connection["PGHOST"],
        "SUPABASE_DR_PGPORT": connection["PGPORT"],
        "SUPABASE_DR_PGUSER": connection["PGUSER"],
        "SUPABASE_DR_PGDATABASE": connection["PGDATABASE"],
        "SUPABASE_DR_PGPASSWORD": secrets["pg_password"],
        "SUPABASE_DR_SOURCE_STORAGE_KEY": secrets["storage"],
        "SUPABASE_DR_AGE_IDENTITY": age_key,
        "SUPABASE_DR_R2_ACCOUNT_ID": secrets["account"],
        "SUPABASE_DR_R2_ACCESS_KEY_ID": secrets["writer"],
        "SUPABASE_DR_R2_SECRET_ACCESS_KEY": secrets["writer_secret"],
        "SUPABASE_DR_R2_BUCKET": BUCKET,
        "SUPABASE_DR_PRUNE_ENABLED": "false",
        "SUPABASE_DR_R2_LOCK_CONFIRMED": "false",
    }
    result = cmd(["node", str(scripts / "unified-offsite.mjs"), "--backup"],
                 cwd=scripts.parent, env=env, timeout=4000)
    found = re.findall(r"^MOSAIC_SUPABASE_FULL_OFFSITE_COMMITTED_PASS: (\S+)$", result, re.M)
    if len(found) != 1 or not SNAPSHOT.fullmatch(found[0]):
        raise SafeFailure("FOURTEEN_R2_COMPLETE_MARKER_NOT_CONFIRMED")
    return found[0]


def guarded_watch(scripts, home, secrets, snapshot):
    env = minimal_env(home) | {
        "SUPABASE_DR_SOURCE_PROJECT": PROJECT,
        "SUPABASE_DR_RECOVERY_PROFILE": PROFILE,
        "SUPABASE_DR_R2_ACCOUNT_ID": secrets["account"],
        "SUPABASE_DR_R2_ACCESS_KEY_ID": secrets["reader"],
        "SUPABASE_DR_R2_SECRET_ACCESS_KEY": secrets["reader_secret"],
        "SUPABASE_DR_R2_BUCKET": BUCKET,
    }
    result = cmd(["node", str(scripts / "unified-offsite.mjs"), "--watch"],
                 cwd=scripts.parent, env=env, timeout=2400)
    if result.splitlines() != ["MOSAIC_SUPABASE_FULL_OFFSITE_FRESH_PASS: " + snapshot]:
        raise SafeFailure("INDEPENDENT_R2_PROFILE_OR_COMPLETED_ID_MISMATCH")


def guarded_restore(scripts, home, sha, secrets, snapshot):
    """Reuse every accepted restored Auth/PG17/Storage check without bypass."""
    module = import_source(scripts / "restore-unified-r2.py", "mosaic_fourteen_r2_restore")
    if module.PROFILES.get(PROFILE) != ("--fresh-personal-identity-sha256", 14):
        raise SafeFailure("EXACT_FOURTEEN_RESTORE_PROFILE_UNAVAILABLE")
    # The original restore prompts from /dev/tty. Reuse read-only credentials
    # already entered privately, without file, CLI args or subprocess env.
    # All other strong checks in module.run(), including source, age, Auth,
    # account isolation, exact 14-table data bytes and cleanup, remain intact.
    module.read_credentials = lambda: (
        secrets["account"], secrets["reader"], secrets["reader_secret"]
    )
    try:
        module.run(sha, snapshot, PROFILE)
    except (module.Refused, OSError, ValueError, subprocess.SubprocessError) as exc:
        raise SafeFailure("EXACT_FOURTEEN_LOCAL_RESTORE_NOT_VERIFIED") from exc


def run(sha):
    global ACTIVE_STAGE, COMMITTED_SNAPSHOT
    COMMITTED_SNAPSHOT = None
    home = Path.home()
    source_preflight(sha)
    disposable = Path(tempfile.mkdtemp(prefix=".mosaic-fourteen-offsite-", dir=home))
    scripts = disposable / "life-tracker/supabase-poc"
    try:
        cmd(["git", "-C", str(REPO), "worktree", "add", "--detach", str(disposable), sha], timeout=120)
        def preflight():
            if not all((scripts / x).is_file() for x in (
                "unified-offsite.mjs", "full-recovery-drill.py",
                "restore-unified-r2.py", "check-private-docker-network.sh"
            )):
                raise SafeFailure("PINNED_RECOVERY_COMPONENT_MISSING")
            config = private_config(scripts, home)
            probe = cmd(["bash", str(scripts / "check-private-docker-network.sh"), "--probe"],
                        cwd=scripts.parent, env=minimal_env(home), timeout=90)
            if probe.splitlines() != ["MOSAIC_LOCAL_NETWORK_PREFLIGHT_PASS"]:
                raise SafeFailure("LOCAL_DISPOSABLE_DOCKER_PREFLIGHT_FAILED")
            return config
        connection, age = stage(0, preflight)
        credentials = stage(1, operator_credentials)
        def publish():
            global COMMITTED_SNAPSHOT
            COMMITTED_SNAPSHOT = guarded_publish(scripts, home, connection, age, credentials)
            print("MOSAIC_FOURTEEN_R2_EXACT_COMPLETED_SNAPSHOT: " + COMMITTED_SNAPSHOT, flush=True)
        stage(2, publish)
        stage(3, lambda: guarded_watch(scripts, home, credentials, COMMITTED_SNAPSHOT))
        stage(4, lambda: guarded_restore(scripts, home, sha, credentials, COMMITTED_SNAPSHOT))
    finally:
        ACTIVE_STAGE = STAGES[5] if sys.exc_info()[0] is None else ACTIVE_STAGE
        print("MOSAIC_FOURTEEN_R2_STAGE_BEGIN: " + STAGES[5], flush=True)
        try:
            cmd(["git", "-C", str(REPO), "worktree", "remove", "--force", str(disposable)], timeout=90)
            if disposable.exists():
                if any(disposable.iterdir()):
                    raise SafeFailure("DISPOSABLE_WORKTREE_NOT_EMPTY")
                disposable.rmdir()
        except (OSError, SafeFailure) as exc:
            raise SafeFailure("DISPOSABLE_WORKTREE_CLEANUP_FAILED") from exc
        print("MOSAIC_FOURTEEN_R2_STAGE_PASS: " + STAGES[5], flush=True)
    print("MOSAIC_FOURTEEN_R2_COMPLETE_OFFSITE_DISPOSABLE_RESTORE_PASS: " + COMMITTED_SNAPSHOT, flush=True)
    print("MOSAIC_FOURTEEN_R2_NOT_MANAGED_PLATFORM_RECOVERY: SMTP/OAuth/JWT/device and signed hosted release are separate", flush=True)


def main():
    parser = argparse.ArgumentParser(description="Exact 14-table source -> read-only source capture -> R2 immutable age archives -> isolated restore")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--plan", action="store_true")
    mode.add_argument("--run", action="store_true")
    parser.add_argument("--source-sha")
    args = parser.parse_args()
    if args.plan:
        if args.source_sha:
            raise SafeFailure("PLAN_MODE_FORBIDS_SOURCE_OR_SECRETS")
        for part in STAGES:
            print("MOSAIC_FOURTEEN_R2_PLAN: " + part)
        print("MOSAIC_FOURTEEN_R2_PLAN_NO_CLOUD_OR_SECRETS_PASS")
        return
    if not SHA.fullmatch(args.source_sha or ""):
        raise SafeFailure("EXACT_PINNED_SOURCE_REQUIRED")
    run(args.source_sha)


def cli():
    try:
        main()
    except (SafeFailure, OSError, ValueError, UnicodeError, KeyboardInterrupt, subprocess.SubprocessError) as exc:
        print("MOSAIC_FOURTEEN_R2_FAILED_STAGE: " + ACTIVE_STAGE, file=sys.stderr)
        if isinstance(exc, SafeFailure):
            print("MOSAIC_FOURTEEN_R2_SAFE_REASON: " + str(exc), file=sys.stderr)
        if COMMITTED_SNAPSHOT:
            print("MOSAIC_FOURTEEN_R2_ALREADY_COMMITTED_RETAIN: " + COMMITTED_SNAPSHOT, file=sys.stderr)
        print("MOSAIC_FOURTEEN_R2_NOT_VERIFIED", file=sys.stderr)
        raise SystemExit(1)


if __name__ == "__main__":
    cli()
