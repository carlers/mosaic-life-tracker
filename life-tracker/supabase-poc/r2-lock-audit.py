#!/usr/bin/env python3
"""Read-only Cloudflare native R2 30-day lock audit for Mosaic Scratch offsite.

No S3/R2 writes/deletes, no rule edits, no AWS credentials and no secrets in output.
"""
import argparse
import getpass
import json
import re
import sys
from urllib.request import Request, build_opener, HTTPRedirectHandler
from urllib.error import HTTPError, URLError

BUCKET = "mosaic-supabase-backups"
MIN_AGE_SECONDS = 30 * 86400
ACCOUNT_ID = re.compile(r"[a-f0-9]{32}\Z")
TOKEN = re.compile(r"[A-Za-z0-9._\-]{20,512}\Z")
SAFE_RULE_PREFIXES = ("", "mosaic-supabase/", "mosaic-supabase/v1/",
                      "mosaic-supabase/v1/snapshots/")


class Refused(Exception):
    pass


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        raise Refused("Cloudflare lock-audit redirect forbidden")


def rule_covers_all_future_snapshots(rule):
    """Accept only unambiguous 30d/indefinite rules covering ALL future snapshots."""
    if not isinstance(rule, dict) or rule.get("enabled") is not True:
        return False
    if rule.get("prefix", "") not in SAFE_RULE_PREFIXES:
        return False
    condition = rule.get("condition")
    if not isinstance(condition, dict):
        return False
    if condition.get("type") == "Indefinite":
        return True
    return (condition.get("type") == "Age"
            and isinstance(condition.get("maxAgeSeconds"), int)
            and not isinstance(condition.get("maxAgeSeconds"), bool)
            and condition["maxAgeSeconds"] >= MIN_AGE_SECONDS)


def assert_native_lock(document):
    if not isinstance(document, dict) or document.get("success") is not True:
        raise Refused("Cloudflare R2 native bucket-lock response not successful")
    result = document.get("result")
    rules = result.get("rules") if isinstance(result, dict) else None
    if not isinstance(rules, list) or not any(map(rule_covers_all_future_snapshots, rules)):
        raise Refused("No enabled native >=30-day lock covering all future unified R2 snapshots")
    return True


def query_native_rules(account_id, token, *, opener=None):
    if not ACCOUNT_ID.fullmatch(account_id or "") or not TOKEN.fullmatch(token or ""):
        raise Refused("Private Cloudflare account or bucket-configuration token invalid")
    # This is an independent Cloudflare *account API* token, not R2 S3 access keys.
    # It must be permitted to READ the R2 bucket configuration. Never PUT/DELETE.
    url = (f"https://api.cloudflare.com/client/v4/accounts/{account_id}"
           f"/r2/buckets/{BUCKET}/lock")
    request = Request(url, method="GET", headers={
        "Authorization": f"Bearer {token}", "Accept": "application/json",
    })
    client = opener if opener is not None else build_opener(NoRedirect)
    try:
        with client.open(request, timeout=25) as response:
            if response.status != 200:
                raise Refused("Cloudflare native lock readback HTTP status failed")
            raw = response.read(128 * 1024 + 1)
    except (HTTPError, URLError, TimeoutError, OSError) as exc:
        raise Refused("Could not read Cloudflare native R2 bucket-lock configuration") from exc
    if len(raw) > 128 * 1024:
        raise Refused("Unexpected oversized Cloudflare lock response")
    try:
        document = json.loads(raw)
    except (ValueError, UnicodeError) as exc:
        raise Refused("Malformed native R2 bucket-lock response") from exc
    return assert_native_lock(document)


def main():
    args = argparse.ArgumentParser(description="Cloudflare read-only R2 native bucket lock audit")
    mode = args.add_mutually_exclusive_group(required=True)
    mode.add_argument("--plan", action="store_true")
    mode.add_argument("--run", action="store_true")
    parsed = args.parse_args()
    if parsed.plan:
        print("MOSAIC_SUPABASE_R2_LOCK_PLAN_GET_ONLY_NO_WRITES_PASS")
        return
    with open("/dev/tty", encoding="utf-8") as tty:
        print("Cloudflare account ID (private terminal): ", end="", flush=True)
        account = tty.readline().strip()
    token = getpass.getpass("Cloudflare R2 bucket-configuration API token (hidden): ")
    try:
        query_native_rules(account, token)
    finally:
        token = ""
    print("MOSAIC_SUPABASE_NATIVE_R2_LOCK_30D_READBACK_PASS")
    print("NOT_DELETE_DENIAL_TESTED: no object deletion or lock modification attempted")


if __name__ == "__main__":
    try:
        main()
    except (Refused, KeyboardInterrupt, OSError, ValueError):
        print("MOSAIC_SUPABASE_NATIVE_R2_LOCK_NOT_VERIFIED", file=sys.stderr)
        sys.exit(1)
