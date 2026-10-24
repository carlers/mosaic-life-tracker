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
    email = input("Account email: ").strip().lower()
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


def main():
    if len(sys.argv) != 1:
        raise ValueError("No arguments permitted; this test is bound to Scratch")
    print("Hosted private-photo security lab: mosaic-dev only; no admin credentials.")
    key = (os.getenv("MOSAIC_SUPABASE_PUBLISHABLE_KEY") or
           getpass.getpass("Project publishable key (sb_publishable_, hidden): ")).strip()
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
        print("HOSTED_PRIVATE_PHOTO_OWNER_UPLOAD_READ_PASS")
        print("HOSTED_PRIVATE_PHOTO_CROSS_OWNER_DENIAL_PASS")
        print("HOSTED_PRIVATE_PHOTO_PUBLIC_ANON_DENIAL_PASS")
        print("HOSTED_PRIVATE_PHOTO_IMMUTABLE_BYTES_PASS")
    finally:
        # Always attempt to remove only our random object, even when an upload
        # response was lost. Never list/delete arbitrary user photos.
        if attempted_upload:
            status, _ = request(object_path, key, token_a, "DELETE")
            if not (200 <= status < 300) and not (status in (400, 404) and not uploaded):
                raise ValueError("Private photo fixture cleanup failed; inspect bucket manually")
            status, _ = request(private_path, key, token_a)
            if 200 <= status < 300:
                raise ValueError("Private fixture remains after cleanup")
            print("HOSTED_PRIVATE_PHOTO_FIXTURE_CLEANUP_PASS")
    print("NOT_FULL_RECOVERY: Auth config, Storage binary DR, other owners and app device tests remain separate.")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, RuntimeError, KeyboardInterrupt, EOFError, OSError):
        # Intentionally do not print HTTP bodies, bearer tokens, account emails,
        # owner UUIDs, paths or request/response objects.
        print("HOSTED_PRIVATE_PHOTO_TEST_NOT_VERIFIED (inspect local environment)", file=sys.stderr)
        sys.exit(1)
