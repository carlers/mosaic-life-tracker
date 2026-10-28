#!/usr/bin/env python3
"""Trusted Fedora #1027 R2-only paired credential check; no DB or R2 writes.

Fetch exact source SHA before invoking through git-show into python3.
Private five-field input is sent to an exact reviewed Node read-only probe only
via ephemeral child environment, never argv, files or application logs.
"""
import argparse
import getpass
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile

REPO = Path.home() / "mosaic-photo-dr-review/life-tracker"
SHA = re.compile(r"[a-f0-9]{40}\Z")
ACCOUNT = re.compile(r"[a-f0-9]{32}\Z")
ACCESS = re.compile(r"[A-Za-z0-9]{16,128}\Z")
ALLOWED = frozenset((
    "PASS", "HTTP_403_SIGNATURE_MISMATCH", "HTTP_403_ACCESS_DENIED",
    "HTTP_401_UNAUTHORIZED", "HTTP_404_BUCKET_NOT_FOUND",
    "HTTP_403_EXPIRED", "HTTP_429_RATE_LIMIT", "HTTP_500_SERVER_ERROR",
    "HTTP_503_SERVICE_UNAVAILABLE", "HISTORICAL_MARKER_ABSENT",
    "HISTORICAL_MARKER_MISMATCH", "UNVERIFIED",
))


class Refused(Exception):
    """Only constant, code-authored failure messages may be displayed."""


def cmd(argv, *, timeout=60, cwd=None, env=None):
    try:
        result = subprocess.run(
            argv, cwd=cwd, env=env, check=False, timeout=timeout,
            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True,
        )
    except (OSError, subprocess.SubprocessError) as exc:
        raise Refused("TRUSTED_LOCAL_COMMAND_UNAVAILABLE") from exc
    if result.returncode:
        raise Refused("TRUSTED_LOCAL_COMMAND_FAILED")
    return result.stdout


def preflight(source):
    if not SHA.fullmatch(source or "") or REPO.is_symlink() or not REPO.is_dir():
        raise Refused("EXACT_RECOVERY_SOURCE_REQUIRED")
    if cmd(["git", "-C", str(REPO), "rev-parse", "--show-toplevel"]).strip() != str(REPO.parent.resolve()):
        raise Refused("RECOVERY_REPOSITORY_MISMATCH")
    if (cmd(["git", "-C", str(REPO), "rev-parse", "FETCH_HEAD"]).strip() != source or
            cmd(["git", "-C", str(REPO), "rev-parse", "--verify", source + "^{commit}"]).strip() != source):
        raise Refused("EXACT_FETCHED_SOURCE_MISMATCH")
    for name in ("git", "node", "python3"):
        if not shutil.which(name):
            raise Refused("PRIVATE_OPERATOR_TOOL_MISSING")


def credentials():
    account = getpass.getpass("R2 Cloudflare account ID (hidden): ")
    reader = getpass.getpass("R2 READ-ONLY Access Key ID (hidden): ")
    reader_secret = getpass.getpass("R2 READ-ONLY Secret Access Key (hidden): ")
    writer = getpass.getpass("R2 WRITE Access Key ID (hidden): ")
    writer_secret = getpass.getpass("R2 WRITE Secret Access Key (hidden): ")
    if (not ACCOUNT.fullmatch(account or "") or
            not ACCESS.fullmatch(reader or "") or not ACCESS.fullmatch(writer or "") or
            any(not 16 <= len(value) <= 256 or any(ch.isspace() for ch in value)
                for value in (reader_secret, writer_secret)) or
            reader == writer or reader_secret == writer_secret):
        raise Refused("R2_CREDENTIAL_PAIR_FORMAT_OR_SEPARATION_INVALID")
    return account, reader, reader_secret, writer, writer_secret


def check_results(raw, exit_code):
    lines = raw.splitlines()
    roles = {}
    for role in ("READER", "WRITER"):
        prefix = "MOSAIC_R2_" + role + "_READ_CHECK_"
        values = [line[len(prefix):] for line in lines if line.startswith(prefix)]
        if len(values) != 1 or values[0] not in ALLOWED:
            raise Refused("R2_PAIRED_CHILD_OUTPUT_NOT_VERIFIED")
        roles[role] = values[0]
    status = "MOSAIC_R2_BOTH_CREDENTIAL_PAIRS_READ_ONLY_PASS" if all(
        value == "PASS" for value in roles.values()
    ) else "MOSAIC_R2_CREDENTIAL_PAIR_NOT_VERIFIED"
    if len(lines) != 3 or lines[2] != status or (exit_code == 0) != (status.endswith("_PASS")):
        raise Refused("R2_PAIRED_CHILD_RESULT_NOT_VERIFIED")
    return roles, status


def run(source):
    preflight(source)
    account, reader, reader_secret, writer, writer_secret = credentials()
    home = Path.home()
    scratch = Path(tempfile.mkdtemp(prefix=".mosaic-r2-pairs-", dir=home))
    try:
        cmd(["git", "-C", str(REPO), "worktree", "add", "--detach",
             str(scratch), source], timeout=90)
        child = scratch / "life-tracker/supabase-poc/r2-paired-probe.mjs"
        if not child.is_file() or child.is_symlink():
            raise Refused("PINNED_R2_PROBE_COMPONENT_MISSING")
        env = {
            "HOME": str(home), "PATH": os.environ.get("PATH", ""),
            "MOSAIC_R2_ACCOUNT_ID": account,
            "MOSAIC_R2_READER_ACCESS_KEY_ID": reader,
            "MOSAIC_R2_READER_SECRET_ACCESS_KEY": reader_secret,
            "MOSAIC_R2_WRITER_ACCESS_KEY_ID": writer,
            "MOSAIC_R2_WRITER_SECRET_ACCESS_KEY": writer_secret,
        }
        try:
            result = subprocess.run(
                ["node", str(child), "--run"], cwd=child.parent, env=env,
                check=False, timeout=120, stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL, text=True,
            )
        except (OSError, subprocess.SubprocessError) as exc:
            raise Refused("TRUSTED_R2_READ_ONLY_PROBE_UNAVAILABLE") from exc
        roles, status = check_results(result.stdout, result.returncode)
        for role in ("READER", "WRITER"):
            print("MOSAIC_R2_" + role + "_READ_CHECK_" + roles[role], flush=True)
        print(status, flush=True)
        return status.endswith("_PASS")
    finally:
        cmd(["git", "-C", str(REPO), "worktree", "remove", "--force", str(scratch)], timeout=90)
        if scratch.exists():
            if any(scratch.iterdir()):
                raise Refused("ISOLATED_R2_WORKTREE_NOT_EMPTY")
            scratch.rmdir()
        print("MOSAIC_R2_PROBE_ISOLATED_CLEANUP_PASS", flush=True)


def main():
    parser = argparse.ArgumentParser(description="Source-pinned, five-field R2 paired READ-ONLY authentication check")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--plan", action="store_true")
    mode.add_argument("--run", action="store_true")
    parser.add_argument("--source-sha")
    args = parser.parse_args()
    if args.plan:
        if args.source_sha:
            raise Refused("PLAN_SOURCE_FORBIDDEN")
        print("MOSAIC_R2_PAIRED_PLAN: exact source, five hidden R2 fields, reader/writer LIST and ten-table marker GET, isolated cleanup")
        print("MOSAIC_R2_PAIRED_PLAN_NO_SECRET_OR_CLOUD_PASS")
        return
    if not run(args.source_sha):
        raise SystemExit(1)


if __name__ == "__main__":
    try:
        main()
    except (Refused, OSError, ValueError, UnicodeError, KeyboardInterrupt, subprocess.SubprocessError) as exc:
        if isinstance(exc, Refused):
            print("MOSAIC_R2_PAIRED_SAFE_REASON: " + str(exc), file=sys.stderr)
        print("MOSAIC_R2_PAIRED_NOT_VERIFIED", file=sys.stderr)
        raise SystemExit(1)
