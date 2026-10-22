#!/usr/bin/env python3
"""Read-only, privacy-safe row counts for every TABLE DATA entry in an age pg_dump.

All decrypted bytes and pg_restore's COPY stream stay in anonymous pipes / Linux
memfd. This program never executes SQL, connects to Postgres, writes plaintext
to disk, or emits record values, IDs, email addresses, tokens, or row hashes.
"""
import json
import os
import re
import subprocess
import sys

MAX_ARCHIVE_BYTES = 256 * 1024 * 1024
MAX_TABLE_DATA_ENTRIES = 250
TOC_LINE = re.compile(r"^\s*\d+;\s+\d+\s+\d+\s+TABLE DATA\s+(\S+)\s+(\S+)\s+")
SQL_IDENT = r'(?:"(?:[^"]|"")*"|[A-Za-z_][A-Za-z_0-9$]*)'
COPY_LINE = re.compile(r"^COPY (" + SQL_IDENT + r")\.(" + SQL_IDENT + r") \(.+\) FROM stdin;$")
REQUIRED = (
    "auth.users", "auth.identities",
    "mosaic_candidate_private.core_authorities",
    "mosaic_candidate_private.owner_revisions",
    "public.mosaic_candidate_categories", "public.mosaic_candidate_tasks",
)
MOSAIC_SCHEMAS = {"mosaic_candidate_private", "mosaic_poc_internal"}

def normalize(part):
    if part.startswith('"'):
        return part[1:-1].replace('""', '"')
    return part

def parse_toc(lines):
    """Return stable-order TABLE DATA TOC lines with duplicate/malformed refusal."""
    result = {}
    for line in lines:
        if "TABLE DATA " not in line or line.lstrip().startswith(";"):
            continue
        match = TOC_LINE.match(line)
        if not match:
            raise ValueError("Malformed TABLE DATA entry")
        schema, name = match.groups()
        if not all(re.fullmatch(r"[a-z][a-z0-9_]*", x) for x in (schema, name)):
            raise ValueError("Unexpected data table identifier")
        key = schema + "." + name
        if key in result:
            raise ValueError("Duplicate TABLE DATA entry")
        result[key] = line
    if any(name not in result for name in REQUIRED) or not result:
        raise ValueError("Missing core recovery TABLE DATA entry")
    if len(result) > MAX_TABLE_DATA_ENTRIES:
        raise ValueError("Too many archived data tables for this audit")
    return result

def count_copies(lines, expected):
    """Stream COPY data rows without reading or returning field values."""
    counts = {name: 0 for name in expected}
    found = set()
    active = None
    read_bytes = 0
    read_lines = 0
    for chunk in lines:
        read_bytes += len(chunk)
        read_lines += 1
        if active is not None:
            if chunk.rstrip(b"\r\n") == b"\\.":
                active = None
            else:
                counts[active] += 1
            continue
        if not chunk.startswith(b"COPY "):
            continue
        try:
            header = chunk.decode("ascii").rstrip("\r\n")
        except UnicodeDecodeError as exc:
            raise ValueError("Unexpected non-ASCII COPY header") from exc
        match = COPY_LINE.match(header)
        if not match:
            raise ValueError("Unsupported COPY header")
        key = normalize(match.group(1)) + "." + normalize(match.group(2))
        if key not in counts or key in found:
            raise ValueError("Unexpected or duplicate COPY data block")
        found.add(key)
        active = key
    if active is not None or len(found) != len(counts):
        raise ValueError("Incomplete data stream or missing table: " + ",".join(sorted(set(counts) - found)) + "; SQL stream lines=" + str(read_lines) + "; bytes=" + str(read_bytes))
    return counts

def put_memfd(data, label):
    fd = os.memfd_create(label, os.MFD_CLOEXEC)
    view = memoryview(data)
    while view:
        wrote = os.write(fd, view)
        view = view[wrote:]
    os.lseek(fd, 0, os.SEEK_SET)
    return fd

def load_archive(archive, identity):
    fd = os.memfd_create("mosaic-archive-data-count", os.MFD_CLOEXEC)
    try:
        total = 0
        with subprocess.Popen(
            ["age", "--decrypt", "--identity", identity, archive],
            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
        ) as decrypt:
            while True:
                chunk = decrypt.stdout.read(1024 * 1024)
                if not chunk:
                    break
                total += len(chunk)
                if total > MAX_ARCHIVE_BYTES:
                    decrypt.kill()
                    decrypt.wait()
                    raise ValueError("Private archive exceeds RAM-only limit")
                view = memoryview(chunk)
                while view:
                    size = os.write(fd, view)
                    view = view[size:]
            if decrypt.wait() != 0 or not total:
                raise ValueError("Archive could not be fully authenticated")
        os.lseek(fd, 0, os.SEEK_SET)
        return fd
    except BaseException:
        os.close(fd)
        raise

def pg_restore_list(fd):
    result = subprocess.run(
        ["pg_restore", "--list", "/proc/self/fd/" + str(fd)],
        stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, pass_fds=(fd,), check=False,
    )
    if result.returncode:
        raise ValueError("Archive TOC cannot be decoded")
    return result.stdout.decode("utf-8").splitlines()

def audit(archive, identity):
    if not hasattr(os, "memfd_create"):
        raise ValueError("Linux anonymous memory files required")
    fd = load_archive(archive, identity)
    try:
        tables = parse_toc(pg_restore_list(fd))
        # This list is solely TABLE DATA. Supabase-managed definitions, ACLs,
        # functions, policies, triggers, and DDL are never decoded or replayed.
        plan = "; Source TABLE DATA row count audit only, never execute\n" + "\n".join(tables.values()) + "\n"
        selected = put_memfd(plan.encode("utf-8"), "mosaic-table-data-plan")
        try:
            with subprocess.Popen(
                ["pg_restore", "--data-only", "--no-owner",
                 "--use-list=/proc/self/fd/" + str(selected),
                 "/proc/self/fd/" + str(fd)],
                stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                pass_fds=(fd, selected),
            ) as proc:
                try:
                    counts = count_copies(proc.stdout, tables)
                except BaseException:
                    proc.kill()
                    proc.wait()
                    raise
                if proc.wait() != 0:
                    raise ValueError("PostgreSQL data blocks failed to decode")
        finally:
            os.close(selected)
        mosaic = {k: v for k, v in counts.items() if
                  k.split(".", 1)[0] in MOSAIC_SCHEMAS or
                  k.startswith("public.mosaic_")}
        auth = {k: v for k, v in counts.items() if k.startswith("auth.")}
        storage = {k: v for k, v in counts.items() if k.startswith("storage.")}
        other = {k: v for k, v in counts.items() if k not in mosaic and
                 k not in auth and k not in storage}
        return {
            "status": "PRIVATE_ROW_COUNT_AUDIT_ONLY_NOT_RESTORED",
            "coreDataRowCounts": {name: counts[name] for name in REQUIRED},
            "additionalMosaicRowCounts": {k: mosaic[k] for k in sorted(mosaic)
                                           if k not in REQUIRED},
            "authTableDataEntries": len(auth),
            "authNonemptyTableRowCounts": {k: auth[k] for k in sorted(auth)
                                           if auth[k] > 0 and k not in REQUIRED},
            "storageTableDataEntries": len(storage),
            "storageNonemptyTableRowCounts": {k: storage[k] for k in sorted(storage)
                                              if storage[k] > 0},
            "otherTableDataEntries": len(other),
            "otherNonemptyTableRowCounts": {k: other[k] for k in sorted(other)
                                            if other[k] > 0},
            "allTableDataEntriesCounted": len(tables),
            "archivedTableRowsCounted": sum(counts.values()),
            "rowValuesOutput": 0,
            "restoresPerformed": 0,
            "independentRecoveryVerified": False,
        }
    finally:
        os.close(fd)

def main():
    if (len(sys.argv) != 3 or
        not all(os.path.isabs(x) and os.path.isfile(x) for x in sys.argv[1:])):
        raise ValueError("Two absolute private archive and identity paths required")
    print(json.dumps(audit(*sys.argv[1:]), indent=2))

if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError) as error:
        # The synthetic CI runner owns its generated fake archive. Operator
        # output must never contain parser diagnostics from a private archive.
        if (os.environ.get("MOSAIC_SYNTHETIC_RESTORE_LAB") == "1"
                and os.environ.get("GITHUB_ACTIONS") == "true"):
            print("Synthetic row count diagnostic:", type(error).__name__,
                  str(error), file=sys.stderr)
        print("Offline source row-count audit failed; zero database writes", file=sys.stderr)
        sys.exit(1)
