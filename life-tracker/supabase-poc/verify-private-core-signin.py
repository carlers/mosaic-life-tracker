#!/usr/bin/env python3
"""#1027: operator-only read of one restored, populated account on a private stack.

Never accepts a remote endpoint or database URL; never prints account identifiers,
passwords, tokens, row contents or local API secrets. No hosted changes.
"""
import getpass
import json
import os
from pathlib import Path
import re
import subprocess
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, build_opener, HTTPRedirectHandler


PROJECT_ID = re.compile(r"mosaic_dr_[0-9a-f]{12}\Z")
UUID = re.compile(r"[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\Z", re.I)
PROJECT_LINE = re.compile(r'^project_id\s*=\s*"(mosaic_dr_[0-9a-f]{12})"\s*$', re.M)


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        raise ValueError("Redirect forbidden in private recovery")


def parse_status(raw):
    """Select only browser-scoped local API key; NEVER use secret/service key."""
    fields = {}
    for line in raw.splitlines():
        k, mark, val = line.partition("=")
        if mark and k in ("PUBLISHABLE_KEY", "ANON_KEY") and k not in fields:
            value = val.strip().strip('"')
            if value and len(value) > 15 and "\n" not in value:
                fields[k] = value
    return fields.get("PUBLISHABLE_KEY") or fields.get("ANON_KEY")


def resolve_project(raw):
    path = Path(raw)
    home = Path.home()
    if (not path.is_absolute() or path.is_symlink() or
            path.parent != home or
            not re.fullmatch(r"\.mosaic-private-recovery-[A-Za-z0-9]{8}", path.name) or
            not path.is_dir() or path.stat().st_mode & 0o077):
        raise ValueError("Not an owner-private disposable recovery directory")
    config = (path / "supabase" / "config.toml").read_text()
    found = PROJECT_LINE.findall(config)
    if len(found) != 1 or not PROJECT_ID.fullmatch(found[0]):
        raise ValueError("Unexpected private project configuration")
    port_text = (path / "mosaic-disposable-api-port").read_text().strip()
    if not port_text.isdecimal() or not (32000 <= int(port_text) <= 47000):
        raise ValueError("Invalid local API port")
    return path, found[0], int(port_text)


def invoke(args, **kwargs):
    try:
        return subprocess.run(args, capture_output=True, text=True, timeout=25, check=True, **kwargs).stdout.strip()
    except (OSError, subprocess.SubprocessError) as exc:
        raise ValueError("Local disposable target command failed") from exc


def query_local(db_container, statement):
    return invoke(["docker", "exec", db_container, "psql", "-XAtq",
                   "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres",
                   "-c", statement])


def request_json(base, path, key, token=None, payload=None):
    headers = {"apikey": key, "Authorization": "Bearer " + (token or key),
               "Accept": "application/json"}
    if payload is not None:
        headers["Content-Type"] = "application/json"
    url = base + path
    if not url.startswith(base) or not base.startswith("http://127.0.0.1:"):
        raise ValueError("Non-local recovery URL forbidden")
    req = Request(url, headers=headers, method="POST" if payload is not None else "GET",
                  data=json.dumps(payload).encode() if payload is not None else None)
    try:
        with build_opener(NoRedirect).open(req, timeout=15) as response:
            if response.status < 200 or response.status >= 300:
                raise ValueError("Local signed HTTP request rejected")
            raw = response.read(1024 * 1024 + 1)
            if len(raw) > 1024 * 1024:
                raise ValueError("Unexpected large recovery response")
            return json.loads(raw)
    except (HTTPError, URLError, OSError, ValueError, json.JSONDecodeError) as exc:
        raise ValueError("Local signed Auth/API verification failed") from exc


def verify(project):
    directory, name, port = resolve_project(project)
    if os.environ.get("DOCKER_HOST", "").startswith(("tcp://", "ssh://")):
        raise ValueError("Remote Docker context forbidden")
    context = invoke(["docker", "context", "inspect",
                      invoke(["docker", "context", "show"]),
                      "--format", "{{.Endpoints.docker.Host}}"])
    if not context.startswith("unix://"):
        raise ValueError("Remote Docker context forbidden")
    invoke(["python3", str(Path(__file__).with_name("configure-private-disposable-stack.py")),
            "check", str(directory), name])

    local_env = invoke(["supabase", "status", "-o", "env"], cwd=str(directory))
    key = parse_status(local_env)
    if not key:
        raise ValueError("No browser-scoped local API key")
    base = "http://127.0.0.1:" + str(port)
    # Both prompts remain on the operator's private terminal, not in shell
    # history, environment variables, URLs, logs, GitHub Actions or this chat.
    email = input("Existing restored account email (private terminal): ").strip().lower()
    if "@" not in email:
        raise ValueError("Invalid local sign-in input")
    password = getpass.getpass("Existing account password (hidden): ")
    if not password:
        raise ValueError("Empty password")
    auth = request_json(base, "/auth/v1/token?grant_type=password",
                        key, payload={"email": email, "password": password})
    password = ""
    owner = auth.get("user", {}).get("id", "")
    token = auth.get("access_token", "")
    if not UUID.fullmatch(owner) or not isinstance(token, str) or len(token) < 24:
        raise ValueError("No signed private restored identity")
    principal = request_json(base, "/auth/v1/user", key, token=token)
    if principal.get("id") != owner:
        raise ValueError("Local signed principal mismatch")
    lease = request_json(base, "/rest/v1/rpc/mosaic_core_session",
                         key, token=token, payload={"p_action": "acquire"})
    if (lease.get("ownerId") != owner or
            lease.get("canonicalOwnerId") != "sb_" + owner.replace("-", "") or
            lease.get("backend") != "supabase-cloud"):
        raise ValueError("Fresh restored owner lease rejected")

    db = "supabase_db_" + name
    total_tasks = query_local(db, "select count(*) from public.mosaic_candidate_tasks where owner_id='" + owner + "'")
    total_cats = query_local(db, "select count(*) from public.mosaic_candidate_categories where owner_id='" + owner + "'")
    if not (total_tasks.isdecimal() and total_cats.isdecimal()):
        raise ValueError("Private recovered owner inventory unavailable")
    tasks = request_json(base, "/rest/v1/mosaic_candidate_tasks?" +
                         urlencode({"select": "id,is_deleted", "owner_id": "eq." + owner, "limit": "1000"}),
                         key, token=token)
    cats = request_json(base, "/rest/v1/mosaic_candidate_categories?" +
                        urlencode({"select": "id", "owner_id": "eq." + owner, "limit": "1000"}),
                        key, token=token)
    if not isinstance(tasks, list) or not isinstance(cats, list):
        raise ValueError("Signed local core reads unavailable")
    if len(tasks) != int(total_tasks) or len(cats) != int(total_cats):
        raise ValueError("Recovered signed owner rows differ from independent local DB counts")
    if not any(row.get("is_deleted") is False for row in tasks):
        raise ValueError("Positive read requires a restored owner with at least one live task")

    foreign = query_local(db, "select owner_id from public.mosaic_candidate_tasks "
                          "where owner_id<>'" + owner + "' limit 1")
    if not UUID.fullmatch(foreign):
        raise ValueError("No independent restored foreign-owner task")
    denied = request_json(base, "/rest/v1/mosaic_candidate_tasks?" +
                          urlencode({"select": "id", "owner_id": "eq." + foreign, "limit": "1"}),
                          key, token=token)
    if denied != []:
        raise ValueError("Restored signed cross-owner row isolation failed")
    print("FRESH_RESTORED_ORIGINAL_PASSWORD_SIGNIN_PASS")
    print("FRESH_RESTORED_AUTHORITY_LEASE_PASS")
    print("FRESH_RESTORED_POPULATED_OWNER_READ_PASS")
    print("FRESH_RESTORED_CROSS_OWNER_READ_ISOLATION_PASS")
    print("Signed owner task/category totals match the independent local database.")
    print("NOT_FULL_RECOVERY: remote Auth/SMTP, old writers, all non-core data and hosted rollout remain unverified.")


if __name__ == "__main__":
    try:
        if len(sys.argv) != 2:
            raise ValueError("Usage: python3 supabase-poc/verify-private-core-signin.py /ABSOLUTE/PRIVATE_NEW_STACK_DIR")
        verify(sys.argv[1])
    except (ValueError, OSError, KeyboardInterrupt, EOFError):
        # Never emit credentials, UUIDs, API responses, or paths from real data.
        print("PRIVATE_RESTORED_SIGNED_READ_NOT_VERIFIED (local check failed)", file=sys.stderr)
        sys.exit(1)
