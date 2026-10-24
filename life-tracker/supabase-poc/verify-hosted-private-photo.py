#!/usr/bin/env python3
"""#1027: private mosaic-dev Storage photo verification using TWO signed owners.

No service-role/admin secrets, DB passwords, API-token grants, user rows or
permanent fixtures. A single random WebP object is deleted on every exit.
Accounts and publishable key are entered in the trusted operator terminal.
Not a Storage media disaster recovery test or a Production migration.
"""
import base64
import getpass
import hashlib
import json
import os
import re
import secrets
import sys
import stat
import subprocess
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, HTTPRedirectHandler, build_opener

ORIGIN = "https://hcxtiifzxoaflhjgoglb.supabase.co"
BUCKET = "mosaic-personal-photos"
UUID = re.compile(r"[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\Z", re.I)
WEBP = base64.b64decode(
    "UklGRjQAAABXRUJQVlA4ICgAAABwAQCdASoCAAIAAoBCJaACdAFAAAD+5Qr/+N4/yXf277eZTblcAAAA"
)
MAX_RESPONSE = 1024 * 1024
# Modern publishable key is explicitly non-secret; bound to this reviewed
# Scratch project. Environment override allows safe public key rotation.
DEFAULT_PUBLISHABLE_KEY = "sb_publishable_xj5Jj1DtNMRju9nXl8XPJQ_6oh4367V"


class DenyRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        raise ValueError("HTTP redirect forbidden in private media verification")


def endpoint(path):
    if path in ("/auth/v1/token?grant_type=password", "/auth/v1/user"):
        return ORIGIN + path
    if not path.startswith("/storage/v1/object/") or any(
        x in path for x in ("..", "//", "\\", "#", "?", "@")
    ):
        raise ValueError("Invalid Storage test API path")
    return ORIGIN + path


def request(path, publishable, token=None, method="GET", body=None, mime=None):
    if method not in ("GET", "POST", "DELETE") or not publishable.startswith("sb_publishable_"):
        raise ValueError("Unsafe request parameters")
    headers = {"apikey": publishable, "Accept": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    if body is not None:
        headers["Content-Type"] = mime or "application/json"
        if mime == "image/webp":
            headers["x-upsert"] = "false"
    req = Request(endpoint(path), headers=headers, data=body, method=method)
    try:
        with build_opener(DenyRedirect).open(req, timeout=25) as response:
            return response.status, response.read(MAX_RESPONSE + 1)
    except HTTPError as exc:
        return exc.code, exc.read(MAX_RESPONSE + 1)
    except (URLError, TimeoutError) as exc:
        raise RuntimeError("Hosted API request failed; inspect network locally") from exc


def json_request(path, publishable, token=None, payload=None):
    status, raw = request(path, publishable, token,
                          "POST" if payload is not None else "GET",
                          json.dumps(payload).encode() if payload is not None else None,
                          "application/json" if payload is not None else None)
    if not (200 <= status < 300) or len(raw) > MAX_RESPONSE:
        raise ValueError("Hosted signed Auth request denied or oversized")
    try:
        return json.loads(raw)
    except (ValueError, UnicodeDecodeError) as exc:
        raise ValueError("Invalid hosted Auth JSON") from exc


def signed_owner(publishable, ordinal):
    print("Sign in hosted Supabase owner " + str(ordinal) + " (private input).")
    # The audited one-command runner pipes source from Git directly into
    # python3 -. Reading sys.stdin here would receive EOF instead of the
    # operator's input. Require a trusted interactive terminal explicitly.
    print("Account email: ", end="", flush=True)
    with open("/dev/tty", encoding="utf-8") as terminal:
        email = terminal.readline().strip().lower()
    password = getpass.getpass("Account password (hidden): ")
    if "@" not in email or not password:
        raise ValueError("Missing signed account identity")
    try:
        auth = json_request("/auth/v1/token?grant_type=password", publishable,
                            payload={"email": email, "password": password})
    finally:
        password = ""
        email = ""
    token = auth.get("access_token")
    owner = auth.get("user", {}).get("id")
    if not isinstance(token, str) or len(token) < 24 or not isinstance(owner, str) or not UUID.fullmatch(owner):
        raise ValueError("Unverified hosted signed session")
    principal = json_request("/auth/v1/user", publishable, token)
    if principal.get("id") != owner:
        raise ValueError("Hosted signed owner mismatch")
    return owner, token


def expect_denied(label, status):
    if 200 <= status < 300:
        raise ValueError(label + " was wrongly allowed")


def storage_path(owner, name, authenticated=False, public=False):
    if not UUID.fullmatch(owner) or not re.fullmatch(r"probe_[0-9a-f]{24}", name):
        raise ValueError("Invalid private fixture owner/object ID")
    prefix = "/storage/v1/object/"
    if authenticated:
        prefix += "authenticated/"
    elif public:
        prefix += "public/"
    return prefix + BUCKET + "/" + quote(owner) + "/" + name + ".webp"


def encrypted_roundtrip(blob):
    """Escrow only this synthetic fixture with the existing private age key.

    No plaintext temporary files or DB/service credentials. Do not mistake
    this independent binary drill for scheduled recovery of every real photo.
    """
    identity = Path.home() / ".config/mosaic/supabase-backup.agekey"
    backup_dir = Path.home() / "mosaic-secure-backups"
    if not identity.is_file() or identity.is_symlink() or not identity.stat().st_size:
        raise ValueError("Existing locally escrowed age private key required")
    if not backup_dir.is_dir() or backup_dir.is_symlink() or (
        stat.S_IMODE(backup_dir.stat().st_mode) & 0o077
    ):
        raise ValueError("Private encrypted backup directory must exist with restricted permissions")
    try:
        recipient = subprocess.run(
            ["age-keygen", "-y", str(identity)], capture_output=True, text=True,
            check=True, timeout=20
        ).stdout.strip()
        if not re.fullmatch(r"age1[0-9a-z]{40,100}", recipient):
            raise ValueError("Invalid age backup recipient")
        archive = backup_dir / ("mosaic-photo-dr-" + secrets.token_hex(12) + ".age")
        old_umask = os.umask(0o077)
        try:
            # Creation is O_EXCL: never overwrite a valid backup.
            with archive.open("xb") as output:
                subprocess.run(
                    ["age", "--encrypt", "--recipient", recipient],
                    input=blob, stdout=output, stderr=subprocess.DEVNULL,
                    check=True, timeout=20
                )
        except BaseException:
            archive.unlink(missing_ok=True)
            raise
        finally:
            os.umask(old_umask)
        restored = subprocess.run(
            ["age", "--decrypt", "--identity", str(identity), str(archive)],
            capture_output=True, check=True, timeout=20
        ).stdout
        if restored != blob or not archive.stat().st_size:
            raise ValueError("Encrypted Storage binary recovery was not byte-exact")
        return restored
    except (OSError, subprocess.SubprocessError) as exc:
        raise ValueError("Encrypted Storage fixture backup/restore failed") from exc


def cleanup_previous_probe():
    # Only the 2026-10-24 09:44 UTC probe; never touch ordinary user files.
    _, token_owner = (None, None)
    key = (os.getenv("MOSAIC_SUPABASE_PUBLISHABLE_KEY") or DEFAULT_PUBLISHABLE_KEY).strip()
    owner, token_owner = signed_owner(key, 1)
    payload = json.dumps({"prefix": owner + "/", "limit": 100, "offset": 0}).encode()
    code, raw = request("/storage/v1/object/list/" + BUCKET, key, token_owner,
                        "POST", payload, "application/json")
    if code != 200:
        raise ValueError("Owner-only fixture list unavailable")
    items = json.loads(raw)
    if not isinstance(items, list) or len(items) >= 100:
        raise ValueError("Private fixture listing cannot be trusted")
    candidates = [
        x["name"] for x in items if isinstance(x, dict)
        and isinstance(x.get("name"), str)
        and re.fullmatch(r"probe_[0-9a-f]{24}[.]webp", x["name"])
        and str(x.get("created_at", "")).startswith("2026-10-24T09:44:")
    ]
    if len(candidates) != 1:
        raise ValueError("Exactly one owner-signed probe from the incident minute required")
    obj = storage_path(owner, candidates[0][:-5])
    private = storage_path(owner, candidates[0][:-5], authenticated=True)
    code, data = request(private, key, token_owner)
    if code != 200 or data != WEBP:
        raise ValueError("Not the original synthetic WebP; refusing deletion")
    code, _ = request(obj, key, token_owner, "DELETE")
    if not 200 <= code < 300:
        raise ValueError("Fixture Storage API deletion not confirmed")
    # A successful Storage DELETE is authoritative, but still verify absence.
    # A post-delete GET/404 sometimes aborted without reaching the service
    # and left a misleading NOT_VERIFIED after a real HTTP 200 DELETE.
    # Reuse the already working authenticated scoped-list API instead.
    code, raw = request("/storage/v1/object/list/" + BUCKET, key, token_owner,
                        "POST", payload, "application/json")
    if code != 200:
        raise ValueError("Owner-only post-delete inventory unavailable")
    after = json.loads(raw)
    if not isinstance(after, list) or len(after) >= 100:
        raise ValueError("Post-delete inventory incomplete")
    if any(not isinstance(item, dict) or
           not isinstance(item.get("name"), str) for item in after):
        raise ValueError("Invalid post-delete listing")
    if any(item["name"] == candidates[0] for item in after):
        raise ValueError("Synthetic photo still present after signed delete")
    print("HOSTED_PRIVATE_PHOTO_LEFTOVER_CLEANUP_PASS")


def verify_absent_from_signed_inventory(owner, publishable, token, filename):
    """Storage GET after DELETE may fail before reaching provider; list is authoritative."""
    prefix = owner + "/"
    status, raw = request("/storage/v1/object/list/" + BUCKET,
                          publishable, token, "POST",
                          json.dumps({"prefix": prefix, "limit": 100, "offset": 0}).encode(),
                          "application/json")
    if status != 200 or len(raw) > MAX_RESPONSE:
        raise ValueError("Signed private post-delete inventory unavailable")
    try:
        items = json.loads(raw)
    except (ValueError, UnicodeDecodeError) as exc:
        raise ValueError("Invalid private post-delete inventory") from exc
    if (not isinstance(items, list) or len(items) >= 100 or
        any(not isinstance(x, dict) or not isinstance(x.get("name"), str) for x in items)):
        raise ValueError("Incomplete or malformed signed private inventory")
    if any(x["name"] == filename for x in items):
        raise ValueError("Synthetic private fixture still exists")


def main():
    if sys.argv[1:] == ["--cleanup-20261024-probe"]:
        cleanup_previous_probe()
        return
    if len(sys.argv) != 1:
        raise ValueError("No arguments permitted; this test is bound to Scratch")
    print("Hosted private-photo security lab: mosaic-dev only; no admin credentials.")
    key = (os.getenv("MOSAIC_SUPABASE_PUBLISHABLE_KEY") or DEFAULT_PUBLISHABLE_KEY).strip()
    if not key.startswith("sb_publishable_") or any(c.isspace() for c in key):
        raise ValueError("Invalid project publishable key")
    owner_a, token_a = signed_owner(key, 1)
    owner_b, token_b = signed_owner(key, 2)
    if owner_a == owner_b:
        raise ValueError("Two distinct signed Supabase owners are required")
    name = "probe_" + secrets.token_hex(12)
    object_path = storage_path(owner_a, name)
    private_path = storage_path(owner_a, name, authenticated=True)
    public_path = storage_path(owner_a, name, public=True)
    uploaded = False
    attempted_upload = False
    restore_name = "probe_" + secrets.token_hex(12)
    restore_object = storage_path(owner_a, restore_name)
    restore_private = storage_path(owner_a, restore_name, authenticated=True)
    attempted_restore_upload = False
    restored_uploaded = False
    try:
        # Start from an independently verified unused random test object ID.
        status, _ = request(private_path, key, token_a)
        if status not in (400, 404):
            raise ValueError("Private test object unexpectedly already exists")
        status, _ = request(object_path, key, token_b, "POST", WEBP, "image/webp")
        expect_denied("Foreign-owner object upload", status)
        status, _ = request(object_path, key, None, "POST", WEBP, "image/webp")
        expect_denied("Anonymous object upload", status)
        attempted_upload = True
        status, _ = request(object_path, key, token_a, "POST", WEBP, "image/webp")
        if not (200 <= status < 300):
            raise ValueError("Owner-private WebP upload failed (" + str(status) + ")")
        uploaded = True
        status, actual = request(private_path, key, token_a)
        if status != 200 or actual != WEBP:
            raise ValueError("Owner-private binary photo readback differs")
        status, _ = request(private_path, key, token_b)
        expect_denied("Foreign-owner private read", status)
        status, _ = request(private_path, key, None)
        expect_denied("Anonymous private read", status)
        status, _ = request(public_path, key, None)
        expect_denied("Public file URL", status)
        status, _ = request(object_path, key, token_b, "DELETE")
        expect_denied("Foreign-owner object deletion", status)
        status, _ = request(object_path, key, token_a, "POST", WEBP, "image/webp")
        expect_denied("Immutable object overwrite", status)
        status, after = request(private_path, key, token_a)
        if status != 200 or hashlib.sha256(after).digest() != hashlib.sha256(WEBP).digest():
            raise ValueError("Immutable photo bytes were changed")
        # One operation: signed two-owner RLS verification AND encrypted media
        # binary backup/restore using the user's already-escrowed age identity.
        recovered = encrypted_roundtrip(after)
        attempted_restore_upload = True
        status, _ = request(restore_object, key, token_a, "POST", recovered, "image/webp")
        if not 200 <= status < 300:
            raise ValueError("Recovered encrypted photo could not be re-uploaded")
        restored_uploaded = True
        status, live = request(restore_private, key, token_a)
        if status != 200 or live != WEBP:
            raise ValueError("Independent recovered photo differs from its source")
        status, _ = request(restore_private, key, token_b)
        expect_denied("Foreign owner recovered photo read", status)
        print("HOSTED_PRIVATE_PHOTO_OWNER_UPLOAD_READ_PASS")
        print("HOSTED_PRIVATE_PHOTO_CROSS_OWNER_DENIAL_PASS")
        print("HOSTED_PRIVATE_PHOTO_PUBLIC_ANON_DENIAL_PASS")
        print("HOSTED_PRIVATE_PHOTO_IMMUTABLE_BYTES_PASS")
        print("HOSTED_PRIVATE_PHOTO_ENCRYPTED_BYTE_RESTORE_PASS")
    finally:
        # Attempt BOTH isolated fixture cleanups even if the first raises or
        # its response is interrupted. A previous run left the original object.
        cleanup_errors = []
        for attempted, confirmed, obj, private in (
            (attempted_upload, uploaded, object_path, private_path),
            (attempted_restore_upload, restored_uploaded, restore_object, restore_private),
        ):
            if not attempted:
                continue
            try:
                code, _ = request(obj, key, token_a, "DELETE")
                if not (200 <= code < 300 or (code in (400, 404) and not confirmed)):
                    cleanup_errors.append("delete not confirmed")
            except (OSError, RuntimeError, ValueError):
                cleanup_errors.append("delete interrupted")
            try:
                verify_absent_from_signed_inventory(
                    owner_a, key, token_a, obj.rsplit("/", 1)[-1]
                )
            except (OSError, RuntimeError, ValueError):
                cleanup_errors.append("signed inventory did not confirm deletion")
        if cleanup_errors:
            raise ValueError("One or more private fixture cleanups were not verified")
        if attempted_upload and attempted_restore_upload:
            print("HOSTED_PRIVATE_PHOTO_FIXTURE_CLEANUP_PASS")
    print("NOT_FULL_RECOVERY: synthetic encrypted bytes verified; backend-wide scheduled Storage backups, managed Auth and device tests remain separate.")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, RuntimeError, KeyboardInterrupt, EOFError, OSError):
        # Intentionally do not print HTTP bodies, bearer tokens, account emails,
        # owner UUIDs, paths or request/response objects.
        print("HOSTED_PRIVATE_PHOTO_TEST_NOT_VERIFIED (inspect local environment)", file=sys.stderr)
        sys.exit(1)
