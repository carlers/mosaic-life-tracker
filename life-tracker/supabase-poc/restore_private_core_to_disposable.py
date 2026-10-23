#!/usr/bin/env python3
"""#1027: restore SIX reviewed core data objects into a disposable local Supabase DB.

Requires a *new*, empty and initialized Supabase CLI database container.
No hostname, port or database URL accepted; Docker exec targets one verified
container ID. Only locally authenticated age source files; decrypted archive
lives only in anonymous host memory and the container's /dev/shm tmpfs.
Preserves Auth identities, password hashes, owner authority/revisions and
task/category rows; never restores old sessions, tokens or writer leases.

A mismatched schema, empty-target assertion or altered data fails closed.
This is core-data recovery, not complete managed-platform or invite recovery.
"""
import hashlib
import os
import re
import subprocess
import sys
from pathlib import Path

from audit_private_archive_rows import load_archive

CORE = [
    "auth.users", "auth.identities",
    "mosaic_candidate_private.core_authorities",
    "mosaic_candidate_private.owner_revisions",
    "public.mosaic_candidate_categories",
    "public.mosaic_candidate_tasks",
]
# The default historical artifact retains its six-table count pins. A newly
# SHA-pinned snapshot adds private Diary and checks every restored COPY byte.
FRESH_DIARY = ["public.mosaic_candidate_diary"]

def selected_data_tables():
    return CORE + (FRESH_DIARY if os.environ.get("MOSAIC_FRESH_SNAPSHOT_SHA256") is not None else [])

def validate_source_counts(counts, synthetic=False):
    selected = selected_data_tables()
    if set(counts) != set(selected):
        raise ValueError("Unexpected source table manifest")
    if not synthetic and os.environ.get("MOSAIC_FRESH_SNAPSHOT_SHA256") is None:
        if counts != EXPECTED_SOURCE:
            raise ValueError("Original archived core row counts changed unexpectedly")
    # Fresh data must preserve auth/owner one-to-one identities; empty/tampered
    # archives are never 'proved safe' merely by allowing dynamic row counts.
    if os.environ.get("MOSAIC_FRESH_SNAPSHOT_SHA256") is not None:
        users = counts["auth.users"]
        if users < 1 or users != counts["auth.identities"] or users != counts["mosaic_candidate_private.core_authorities"]:
            raise ValueError("Fresh archive Auth identities and owner authority counts disagree")
        if any(value < 0 or value > 250000 for value in counts.values()):
            raise ValueError("Fresh snapshot exceeds verified bounded restore capacity")
    return counts

EXPECTED_SOURCE = {
    "auth.users": 81,
    "auth.identities": 81,
    "mosaic_candidate_private.core_authorities": 81,
    "mosaic_candidate_private.owner_revisions": 49,
    "public.mosaic_candidate_categories": 53,
    "public.mosaic_candidate_tasks": 58,
}
# The actual snapshot's encrypted bytes were independently SHA256 verified.
EXPECTED_AGE_SHA256 = "fd09208eff25ebf947f78b3fd0efb85cbb82b24dedc3ca5194161da9a432fbf1"
MAX_DOCKER_SHM_ARCHIVE = 40 * 1024 * 1024
ARCHIVE_IN_RAM = "/dev/shm/mosaic_1027_private_backup.dump"
SELECT_IN_RAM = "/dev/shm/mosaic_1027_private_selection.toc"
SIMPLE_IDENT = re.compile(r"^[a-z][a-z0-9_]*$")
COPY = re.compile(r"^COPY ((?:\"[^\"]+\"|[a-z_][a-z0-9_]*))\.((?:\"[^\"]+\"|[a-z_][a-z0-9_]*)) \(([^)]*)\) FROM stdin;$")

def execute(argv, *, input_bytes=None, captures=True):
    p = subprocess.run(argv, input=input_bytes,
        stdout=subprocess.PIPE if captures else subprocess.DEVNULL,
        stderr=subprocess.PIPE, check=False)
    if p.returncode:
        raise ValueError("A restricted disposable container operation failed")
    return p.stdout if captures else b""

def in_db(container, program, *args, input_bytes=None):
    return execute(["docker", "exec"] + (["-i"] if input_bytes is not None else []) +
                   [container, program, *args], input_bytes=input_bytes)

def sql(container, statement):
    return in_db(container, "psql", "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1",
                 "-U", "postgres", "-d", "postgres", "-c", statement).decode().strip()

def assert_target(container):
    name = execute(["docker", "inspect", "--format", "{{.Name}}", container]).decode().strip().lstrip("/")
    synthetic = (os.getenv("GITHUB_ACTIONS") == "true" and
                 os.getenv("MOSAIC_REAL_AUTH_RECOVERY_LAB") == "1")
    if not (re.fullmatch(r"supabase_db_mosaic_dr_[a-z0-9]+", name) or
            (synthetic and re.fullmatch(r"supabase_db_[a-z0-9_-]+", name))):
        raise ValueError("Refusing unrecognized/non-disposable container name")
    # Never allow calling this on a non-Supabase Docker image or a PG 15 target.
    image = execute(["docker", "inspect", "--format", "{{.Config.Image}}", container]).decode().strip()
    if not any(image.startswith(prefix) for prefix in ("public.ecr.aws/supabase/postgres:", "supabase/postgres:", "ghcr.io/supabase/postgres:")):
        raise ValueError("Unexpected Docker image for local recovery")
    version = int(sql(container, "SHOW server_version_num"))
    if not (170000 <= version < 180000):
        raise ValueError("Restoring hosted PG17 snapshot requires a PG17 target")
    check = sql(container, """
        SELECT (to_regclass('auth.users') IS NOT NULL
           AND to_regclass('auth.identities') IS NOT NULL
           AND to_regclass('mosaic_candidate_private.core_authorities') IS NOT NULL
           AND to_regclass('mosaic_candidate_private.owner_revisions') IS NOT NULL
           AND to_regclass('public.mosaic_candidate_tasks') IS NOT NULL
           AND to_regclass('public.mosaic_candidate_categories') IS NOT NULL);
    """)
    if check != "t":
        raise ValueError("Disposable target missing fresh initialized schema")
    if FRESH_DIARY[0] in selected_data_tables():
        if sql(container, "SELECT to_regclass('public.mosaic_candidate_diary') IS NOT NULL") != "t":
            raise ValueError("Fresh restore target has no initialized private Diary")
        if sql(container, "SELECT count(*) FROM public.mosaic_candidate_diary") != "0":
            raise ValueError("Refusing nonempty private Diary recovery target")
    for table in CORE + ["auth.sessions", "auth.refresh_tokens",
                         "auth.one_time_tokens", "mosaic_candidate_private.core_sessions"]:
        count = sql(container, "SELECT count(*) FROM " + table)
        if count != "0":
            raise ValueError("Refusing nonempty local recovery target")
    available = int(in_db(container, "sh", "-c", "df -B1 /dev/shm | tail -1 | awk '{print $4}'").decode().strip())
    if available < MAX_DOCKER_SHM_ARCHIVE:
        raise ValueError("Disposable target has insufficient private tmpfs space")

def sha256(path):
    digest = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()

def copy_archive_to_tmpfs(container, archive, identity):
    memfd = load_archive(str(archive), str(identity))
    try:
        archive_bytes = os.fstat(memfd).st_size
        if not (archive_bytes > 0 and archive_bytes <= MAX_DOCKER_SHM_ARCHIVE):
            raise ValueError("Decrypted archive exceeds local tmpfs capacity")
        # No plaintext on either host disk or container layer. /dev/shm is RAM.
        sink = subprocess.Popen(["docker", "exec", "-i", container,
            "sh", "-c", "umask 077; cat > " + ARCHIVE_IN_RAM],
            stdin=subprocess.PIPE, stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL)
        try:
            with os.fdopen(os.dup(memfd), "rb") as stream:
                while chunk := stream.read(1024 * 1024):
                    sink.stdin.write(chunk)
            sink.stdin.close()
            if sink.wait() != 0:
                raise ValueError("Unable to stage archive in disposable RAM")
        except BaseException:
            sink.kill()
            sink.wait()
            raise
    finally:
        os.close(memfd)

def copy_manifest(container):
    # Source archives can include Supabase-managed TABLE DATA names with
    # quoted/leading-underscore identifiers. None belong to this restore.
    # Accept only the explicitly reviewed core records (plus private Diary
    # for a SHA-pinned fresh source); reject duplicates.
    lines = in_db(container, "pg_restore", "--list", ARCHIVE_IN_RAM).decode().splitlines()
    entry = re.compile(r"^\s*\d+;\s+\d+\s+\d+\s+TABLE DATA\s+(\S+)\s+(\S+)\s+")
    allowed = selected_data_tables()
    selected = {}
    for line in lines:
        match = entry.match(line)
        if not match:
            continue
        name = match.group(1) + "." + match.group(2)
        if name not in allowed:
            continue
        if name in selected:
            raise ValueError("Duplicate required core TABLE DATA object")
        selected[name] = line
    if set(selected) != set(allowed):
        raise ValueError("Missing required core TABLE DATA object")
    return selected

def restore_one(container, manifest, name):
    selection = "; SINGLE CORE DATA OBJECT ONLY\n" + manifest[name] + "\n"
    in_db(container, "sh", "-c", "umask 077; cat > " + SELECT_IN_RAM,
          input_bytes=selection.encode())
    in_db(container, "pg_restore", "--exit-on-error", "--no-owner",
          "--data-only", "--use-list=" + SELECT_IN_RAM, "-U", "postgres",
          "-d", "postgres", ARCHIVE_IN_RAM)

def q_ident(name):
    if not SIMPLE_IDENT.fullmatch(name):
        raise ValueError("Nonstandard table/column identifier; refuse unsafe SQL")
    return '"' + name + '"'

def source_copy_rows(container, manifest):
    allowed = selected_data_tables()
    selected = "; approved private owner TABLE DATA only\n" + "\n".join(manifest[x] for x in allowed) + "\n"
    in_db(container, "sh", "-c", "umask 077; cat > " + SELECT_IN_RAM,
          input_bytes=selected.encode())
    raw = in_db(container, "pg_restore", "--data-only", "--no-owner",
                "--use-list=" + SELECT_IN_RAM, "--file=/dev/stdout", ARCHIVE_IN_RAM)
    records = {name: [] for name in allowed}
    columns = {}
    active = None
    for line in raw.splitlines(keepends=True):
        if active:
            if line.strip(b"\r\n") == b"\\.":
                active = None
            else:
                records[active].append(line.rstrip(b"\r\n"))
            continue
        if not line.startswith(b"COPY "):
            continue
        header = line.decode("utf-8").rstrip("\r\n")
        match = COPY.match(header)
        if not match:
            raise ValueError("Unsupported archive COPY header")
        schema = match.group(1).strip('"')
        name = match.group(2).strip('"')
        fullname = schema + "." + name
        if fullname not in records or fullname in columns:
            raise ValueError("Unexpected or repeated table header")
        cols = [c.strip().strip('"') for c in match.group(3).split(",")]
        if not cols or not all(SIMPLE_IDENT.fullmatch(c) for c in cols):
            raise ValueError("Unrecognized archive COPY columns")
        columns[fullname] = cols
        active = fullname
    if active or len(columns) != len(allowed):
        raise ValueError("Incomplete core data comparison stream")
    return records, columns

def compare_restored_rows(container, archive_records, columns):
    for fullname in selected_data_tables():
        schema, table = fullname.split(".")
        column_sql = ", ".join(q_ident(c) for c in columns[fullname])
        statement = "COPY " + q_ident(schema) + "." + q_ident(table) + " (" + column_sql + ") TO STDOUT;"
        raw = in_db(container, "psql", "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1",
                    "-U", "postgres", "-d", "postgres", "-c", statement)
        restored = raw.splitlines()
        # Plain text COPY uses byte-escaped newlines; comparison is exact and
        # order-insensitive but never exposes source values/hashes to stdout.
        if sorted(restored) != sorted(archive_records[fullname]):
            raise ValueError("Restored core row contents differ from encrypted source")

def verify_restored_counts(container, expected):
    for name in selected_data_tables():
        value = int(sql(container, "SELECT count(*) FROM " + name))
        if value != expected[name]:
            raise ValueError("Restored row count mismatch")
    for name in ("auth.sessions", "auth.refresh_tokens",
                 "auth.one_time_tokens", "mosaic_candidate_private.core_sessions"):
        if sql(container, "SELECT count(*) FROM " + name) != "0":
            raise ValueError("Stale Auth session, token or writer lease reactivated")
    authority = sql(container, """
      SELECT count(*) FROM mosaic_candidate_private.core_authorities a
      WHERE a.canonical_id <> 'sb_' || replace(a.owner_id::text,'-','')
        OR a.provenance <> 'fresh-supabase'
        OR NOT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=a.owner_id);
    """)
    if authority != "0":
        raise ValueError("Canonical owner or frozen authority integrity failed")

def approved_source_sha256():
    """Default to the independently reviewed original. A new snapshot needs
    a separately recorded exact encrypted-file digest, never an implicit bypass.
    """
    new = os.environ.get("MOSAIC_FRESH_SNAPSHOT_SHA256")
    if new is None:
        return EXPECTED_AGE_SHA256
    if not re.fullmatch(r"[a-f0-9]{64}", new):
        raise ValueError("Invalid fresh encrypted archive SHA256 pin")
    return new


def restore(archive, identity, container):
    synthetic = (os.getenv("GITHUB_ACTIONS") == "true" and
                 os.getenv("MOSAIC_REAL_AUTH_RECOVERY_LAB") == "1")
    if not synthetic and sha256(archive) != approved_source_sha256():
        raise ValueError("Encrypted archive SHA256 does not match approved source pin")
    # Use ONLY PostgreSQL 17 tools inside the verified local Docker target.
    # Host pg_restore may be PG15/16 and cannot reliably decode PG17 archives.
    assert_target(container)
    copy_archive_to_tmpfs(container, archive, identity)
    try:
        manifest = copy_manifest(container)
        source_rows, columns = source_copy_rows(container, manifest)
        expected = validate_source_counts(
            {table: len(source_rows[table]) for table in selected_data_tables()},
            synthetic=synthetic,
        )
        # Disable only application triggers. Managed native Auth triggers remain.
        owner_tables = ("public.mosaic_candidate_categories", "public.mosaic_candidate_tasks") + (
            tuple(FRESH_DIARY) if FRESH_DIARY[0] in selected_data_tables() else ()
        )
        for tbl in owner_tables:
            sql(container, "ALTER TABLE " + tbl + " DISABLE TRIGGER USER")
        restore_one(container, manifest, "auth.users")
        restore_one(container, manifest, "auth.identities")
        if sql(container, "SELECT count(*) FROM mosaic_candidate_private.core_authorities") != str(expected["auth.users"]):
            raise ValueError("Native Auth enrollment did not create exactly one authority per user")
        # Only on checked newly initialized target: replace autogenerated
        # authority rows with the archived canonical owner/frozen backend state.
        sql(container, "DELETE FROM mosaic_candidate_private.core_authorities")
        for name in CORE[2:] + (FRESH_DIARY if FRESH_DIARY[0] in selected_data_tables() else []):
            restore_one(container, manifest, name)
        for tbl in owner_tables:
            sql(container, "ALTER TABLE " + tbl + " ENABLE TRIGGER USER")
        verify_restored_counts(container, expected)
        compare_restored_rows(container, source_rows, columns)
    finally:
        try:
            in_db(container, "sh", "-c",
                  "rm -f " + ARCHIVE_IN_RAM + " " + SELECT_IN_RAM)
        except ValueError:
            pass
    return {"coreDataRowCounts": expected}

def main():
    if len(sys.argv) != 4:
        raise ValueError("Usage: restore_private_core_to_disposable.py AGE_ARCHIVE AGE_KEY VERIFIED_DOCKER_CONTAINER")
    archive, identity = map(Path, sys.argv[1:3])
    if not all(path.is_absolute() and path.is_file() for path in (archive, identity)):
        raise ValueError("Private archive and key must be existing absolute paths")
    report = restore(archive, identity, sys.argv[3])
    # No row values, account identifiers, emails, row hashes or secrets.
    print("DISPOSABLE_CORE_RESTORE_PASS: " + str(len(report["coreDataRowCounts"])) + " data tables, " +
          str(sum(report["coreDataRowCounts"].values())) +
          " exact source/target rows verified; old sessions and writer leases excluded.")
    print("NOT_FULL_RECOVERY: historical invitations, managed Auth services, SMTP and live sign-in are separate gates.")

if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, subprocess.SubprocessError) as error:
        # The CI job has only randomly generated fake GoTrue accounts. Never
        # print details from an operator's real encrypted backup.
        if (os.getenv("GITHUB_ACTIONS") == "true" and
                os.getenv("MOSAIC_REAL_AUTH_RECOVERY_LAB") == "1"):
            print("Synthetic recovery guard:", type(error).__name__,
                  str(error)[:350], file=sys.stderr)
        print("Disposable recovery failed a strict target, data compatibility or integrity check; no live DB was used.", file=sys.stderr)
        sys.exit(1)
