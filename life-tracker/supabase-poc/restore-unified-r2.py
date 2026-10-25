#!/usr/bin/env python3
"""One trusted-host run: exact completed R2 ciphertext -> isolated PG17/Auth/Storage restore.

Reads only the protected Supabase R2 bucket. Never reads/writes hosted Supabase,
Appwrite or Production, never exports plaintext outside fresh local containers.
"""
import argparse
import getpass
import hashlib
import importlib.util
import os
from pathlib import Path
import re
import secrets
import shutil
import subprocess
import sys
import tempfile

PROJECT = "hcxtiifzxoaflhjgoglb"
SNAPSHOT = "20261025T031343499Z"
BRANCH = "feature/1027-supabase-recovery-20261020"
REPO = Path.home() / "mosaic-photo-dr-review/life-tracker"
BUCKET = "mosaic-supabase-backups"
SHA = re.compile(r"[a-f0-9]{40}\Z")
ACCOUNT = re.compile(r"[a-f0-9]{32}\Z")
ACCESS = re.compile(r"[A-Za-z0-9]{16,128}\Z")
STAGES = (
    "01 exact pinned source and private local preflight",
    "02 download exact completed R2 database/media ciphertext with read-only key",
    "03 authenticate full database and media age archives and inspect Auth TOC",
    "04 independently restore exact PostgreSQL data into new loopback-only PG17",
    "05 original-password signed owner read and foreign-owner denial",
    "06 isolated complete private Storage restore and nonempty synthetic photo",
    "07 dispose only this run's local stack and detached worktree",
)
ACTIVE_STAGE = STAGES[0]


class Refused(Exception):
    pass


def private_file(path, directory=False):
    import stat
    if path.is_symlink() or not (path.is_dir() if directory else path.is_file()) or \
            stat.S_IMODE(path.stat().st_mode) & 0o077 or \
            (not directory and path.stat().st_size < 1):
        raise Refused("Missing or insecure pre-existing private local resource")


def clean_env():
    banned = ("PG", "SUPABASE", "MOSAIC_SUPABASE", "SUPABASE_DR", "R2_", "AWS_", "DATABASE_URL")
    return {k: v for k, v in os.environ.items() if not k.startswith(banned)}


def command(args, *, cwd=None, env=None, timeout=120, stdin=None, visible=False):
    try:
        r = subprocess.run(args, cwd=cwd, env=env or clean_env(),
                           stdin=stdin, stdout=None if visible else subprocess.PIPE,
                           stderr=None if visible else subprocess.PIPE, text=True,
                           check=False, timeout=timeout)
    except (OSError, subprocess.SubprocessError) as exc:
        raise Refused("Guarded local recovery subprocess unavailable") from exc
    if r.returncode:
        raise Refused("Guarded local recovery subprocess failed")
    return r.stdout or ""


def stage(i, callback):
    global ACTIVE_STAGE
    ACTIVE_STAGE = STAGES[i]
    print("MOSAIC_R2_RESTORE_STAGE_BEGIN: " + ACTIVE_STAGE, flush=True)
    result = callback()
    print("MOSAIC_R2_RESTORE_STAGE_PASS: " + ACTIVE_STAGE, flush=True)
    return result


def valid_source(sha):
    if not SHA.fullmatch(sha or "") or REPO.is_symlink() or REPO.name != "life-tracker" or \
            not (REPO.parent / ".git").exists():
        raise Refused("Invalid pinned source or trusted Mosaic checkout")
    root = command(["git", "-C", str(REPO), "rev-parse", "--show-toplevel"]).strip()
    fetched = command(["git", "-C", str(REPO), "rev-parse", "FETCH_HEAD"]).strip()
    if root != str(REPO.parent.resolve()) or fetched != sha:
        raise Refused("Requested exact remote source was not fetched into trusted checkout")
    resolved = command(["git", "-C", str(REPO), "rev-parse", "--verify", sha + "^{commit}"]).strip()
    if resolved != sha:
        raise Refused("Fetched pinned source SHA mismatch")


def read_credentials():
    with open("/dev/tty", encoding="utf-8") as tty:
        print("Cloudflare R2 account ID (from your password manager): ", end="", flush=True)
        account_id = tty.readline().strip()
    access = getpass.getpass("Dedicated Supabase R2 READ-ONLY Access Key ID (hidden): ")
    secret = getpass.getpass("Dedicated Supabase R2 READ-ONLY Secret Access Key (hidden): ")
    if not ACCOUNT.fullmatch(account_id) or not ACCESS.fullmatch(access) or \
            not 16 <= len(secret) <= 256 or any(c.isspace() for c in secret):
        raise Refused("Dedicated R2 reader credentials malformed")
    return account_id, access, secret


def checked_sha(path):
    value = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            value.update(chunk)
    return value.hexdigest()


def run(sha):
    global ACTIVE_STAGE
    home = Path.home()
    key = home / ".config/mosaic/supabase-backup.agekey"
    archives = home / "mosaic-secure-backups"

    def preflight():
        private_file(key)
        private_file(archives, directory=True)
        valid_source(sha)
        for cmd in ("git", "node", "python3", "docker", "supabase", "age", "age-keygen"):
            if not shutil.which(cmd):
                raise Refused("Missing trusted local prerequisite: " + cmd)
    stage(0, preflight)

    temp = Path(tempfile.mkdtemp(prefix=".mosaic-onepass-worktree-", dir=home))
    local = None
    network = None
    downloaded = None
    try:
        command(["git", "-C", str(REPO), "worktree", "add", "--detach", str(temp), sha], timeout=90)
        tracker = temp / "life-tracker"
        scripts = tracker / "supabase-poc"
        if not (scripts / "unified-offsite.mjs").is_file() or not (scripts / "full-recovery-drill.py").is_file():
            raise Refused("Pinned restore components missing")
        spec = importlib.util.spec_from_file_location("mosaic_existing_private_dr", scripts / "full-recovery-drill.py")
        existing = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(existing)
        downloaded = archives / ("mosaic-r2-" + SNAPSHOT + "-" + secrets.token_hex(10))

        def download():
            account, access, secret = read_credentials()
            env = clean_env() | {
                "SUPABASE_DR_SOURCE_PROJECT": PROJECT,
                "SUPABASE_DR_R2_BUCKET": BUCKET,
                "SUPABASE_DR_R2_ACCOUNT_ID": account,
                "SUPABASE_DR_R2_ACCESS_KEY_ID": access,
                "SUPABASE_DR_R2_SECRET_ACCESS_KEY": secret,
            }
            try:
                result = command(["node", str(scripts / "unified-offsite.mjs"),
                                  "--download", SNAPSHOT, str(downloaded)],
                                 cwd=tracker, env=env, timeout=1800)
            finally:
                env.pop("SUPABASE_DR_R2_SECRET_ACCESS_KEY", None)
                secret = ""
            if "MOSAIC_SUPABASE_FULL_OFFSITE_CIPHERTEXT_DOWNLOAD_PASS" not in result:
                raise Refused("Complete dual-archive readback pass marker absent")
            private_file(downloaded, directory=True)
            for path in (downloaded / "database.age", downloaded / "media.age"):
                private_file(path)
            print("MOSAIC_R2_EXACT_ENCRYPTED_DOWNLOAD_PASS", flush=True)
        stage(1, download)
        database, media = downloaded / "database.age", downloaded / "media.age"

        def authenticate():
            for archive in (database, media):
                # Full-stream age authentication. No plaintext is materialized on disk.
                with open(os.devnull, "wb") as sink:
                    result = subprocess.run(["age", "--decrypt", "--identity", str(key), str(archive)],
                                            stdout=sink, stderr=subprocess.DEVNULL,
                                            env=clean_env(), timeout=240)
                if result.returncode:
                    raise Refused("Age identity could not authenticate R2 ciphertext")
            toc = command(["bash", str(scripts / "inspect-encrypted-backup-toc.sh"),
                           str(database), str(key)], cwd=tracker, timeout=200)
            existing.parse_metadata(toc)
            print("MOSAIC_R2_BOTH_AGE_ARCHIVES_AUTHENTICATED_PASS", flush=True)
        stage(2, authenticate)

        def restore_database():
            nonlocal local, network
            result = command(["bash", str(scripts / "run-private-core-recovery.sh"),
                              str(database), str(key), "--fresh-snapshot-sha256", checked_sha(database)],
                             cwd=tracker, timeout=1500)
            if "DISPOSABLE_CORE_RESTORE_PASS: 7 data tables" not in result or \
                    "exact source/target rows verified" not in result:
                raise Refused("Exact row-byte parity restoration marker missing")
            local, network = existing.parse_local(result, home)
            print("MOSAIC_R2_EXACT_SOURCE_TARGET_DATA_PASS", flush=True)
        stage(3, restore_database)

        def signed_owner():
            print("Enter original password for an existing populated account in the fresh LOCAL restore.", flush=True)
            with open("/dev/tty", "r", encoding="utf-8") as tty:
                command(["python3", str(scripts / "verify-private-core-signin.py"), str(local)],
                        cwd=tracker, stdin=tty, visible=True, timeout=210)
            print("MOSAIC_R2_RESTORED_OWNER_ISOLATION_PASS", flush=True)
        stage(4, signed_owner)

        def restore_media():
            output = command(["python3", str(scripts / "restore-private-photo-snapshot.py"),
                              str(media), str(local)], cwd=tracker, timeout=1000)
            for marker in ("SUPABASE_PRIVATE_MEDIA_ALL_BUCKET_ISOLATED_RESTORE_PASS:",
                           "SUPABASE_PRIVATE_MEDIA_NONEMPTY_ENCRYPTED_RESTORE_PASS"):
                if marker not in output:
                    raise Refused("Independent local Storage byte restore marker missing")
            print("MOSAIC_R2_EXACT_MEDIA_AND_SYNTHETIC_RECOVERY_PASS", flush=True)
        stage(5, restore_media)
    finally:
        # No hosted/Production cleanup. All teardown targets are independently
        # identified by the pre-existing isolated recovery guard.
        if sys.exc_info()[0] is None:
            ACTIVE_STAGE = STAGES[6]
        print("MOSAIC_R2_RESTORE_STAGE_BEGIN: " + STAGES[6], flush=True)
        errors = []
        if local is not None:
            try:
                command(["supabase", "stop", "--no-backup"], cwd=local, timeout=180)
            except Refused:
                errors.append("disposable Supabase local stop")
            if not errors and local.parent == home and existing.DIR.fullmatch(local.name):
                try:
                    shutil.rmtree(local)
                except OSError:
                    errors.append("disposable local directory")
        if network is not None and existing.NET.fullmatch(network):
            try:
                command(["docker", "network", "rm", network], timeout=90)
            except Refused:
                errors.append("disposable Docker bridge")
        try:
            command(["git", "-C", str(REPO), "worktree", "remove", "--force", str(temp)], timeout=90)
        except Refused:
            errors.append("disposable detached Git worktree")
        if temp.exists() and not any(temp.iterdir()):
            temp.rmdir()
        if errors:
            ACTIVE_STAGE = STAGES[6]
            raise Refused("Local disposable cleanup incomplete: " + ", ".join(errors))
        print("MOSAIC_R2_RESTORE_STAGE_PASS: " + STAGES[6], flush=True)
    print("MOSAIC_R2_EXACT_SNAPSHOT_DISPOSABLE_RESTORE_PASS: " + SNAPSHOT, flush=True)
    print("MOSAIC_R2_RESTORE_NOT_FULL_MANAGED_PLATFORM: SMTP/OAuth/JWT and photo-bearing source remain separate", flush=True)


def main():
    parser = argparse.ArgumentParser(description="Exact private R2 snapshot -> isolated fresh Supabase recovery")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--plan", action="store_true")
    mode.add_argument("--run", action="store_true")
    parser.add_argument("--source-sha")
    args = parser.parse_args()
    if args.plan:
        if args.source_sha:
            raise Refused("Offline plan forbids source override")
        for part in STAGES:
            print("MOSAIC_R2_RESTORE_PLAN: " + part)
        print("MOSAIC_R2_RESTORE_PLAN_NO_CLOUD_OR_SECRETS_PASS")
        return
    if not SHA.fullmatch(args.source_sha or ""):
        raise Refused("Exact reviewed source SHA required")
    run(args.source_sha)


def cli():
    try:
        main()
    except (Refused, KeyboardInterrupt, OSError, ValueError, subprocess.SubprocessError) as exc:
        print("MOSAIC_R2_RESTORE_FAILED_STAGE: " + ACTIVE_STAGE, file=sys.stderr)
        if isinstance(exc, Refused):
            print("MOSAIC_R2_RESTORE_SAFE_REASON: " + str(exc), file=sys.stderr)
        print("MOSAIC_R2_RESTORE_NOT_VERIFIED", file=sys.stderr)
        raise SystemExit(1)


if __name__ == "__main__":
    cli()
