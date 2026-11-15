#!/usr/bin/env python3
"""One-shot, credential-free live security probes of disposable Oracle Scratch only.

Never point at Production or TEST. No credentials, auth responses or test media
are persisted outside Python memory. IDs are printed solely for operator cleanup.
"""
import base64
import hashlib
import hmac
import http.client
import json
import os
import secrets
import struct
import time
from http.cookies import SimpleCookie

HOST = "129-221-244-67.sslip.io"
PROJECT = "6ae94a2100014d01f5ed"
FUNCTION = "6aa8057f002a4c306fdd"
BUCKET = "/v1/storage/buckets/task_images"
DIARY = "/v1/tablesdb/life_tracker/tables/diary/rows?limit=1"
FUNCTION_EXEC = "/v1/functions/" + FUNCTION + "/executions"
IMAGE = base64.b64decode("UklGRiQAAABXRUJQVlA4IBgAAABQAQCdASoBAAEAAUAmJaQABOOAAJPSzAA=")
DENIED = (401, 403, 404)

class Gate(Exception):
    pass

def request(method, path, data=None, cookie="", multipart=None, parse=True):
    if not path.startswith("/v1/") or any(ch in path for ch in ("\r", "\n", "#")):
        raise Gate("unsafe endpoint")
    headers = {
        "X-Appwrite-Project": PROJECT,
        "Accept": "application/json",
        "User-Agent": "mosaic-2067-disposable-scratch-security/1",
    }
    if cookie:
        headers["Cookie"] = cookie
    if multipart is not None:
        content, boundary = multipart
        headers["Content-Type"] = "multipart/form-data; boundary=" + boundary
    elif data is not None:
        content = json.dumps(data, separators=(",", ":")).encode("utf-8")
        headers["Content-Type"] = "application/json"
    else:
        content = None
    conn = http.client.HTTPSConnection(HOST, timeout=25)
    try:
        conn.request(method, path, body=content, headers=headers)
        response = conn.getresponse()
        status = response.status
        headers_out = response.getheaders()
        raw = response.read(262145)
        if len(raw) > 262144:
            raise Gate("oversize provider response")
        result = None
        if parse and raw:
            try:
                result = json.loads(raw)
            except (ValueError, UnicodeError):
                result = None
        return status, result, headers_out
    except (OSError, TimeoutError) as exc:
        raise Gate("Scratch HTTPS transport unavailable") from exc
    finally:
        conn.close()

def required(method, path, stage, statuses=(200,), **kwargs):
    status, data, headers = request(method, path, **kwargs)
    if status not in statuses:
        raise Gate(stage + " status=" + str(status))
    return data, headers

def extract_cookies(headers):
    cookies = SimpleCookie()
    for name, value in headers:
        if name.lower() == "set-cookie":
            try:
                cookies.load(value)
            except Exception:
                pass
    items = [(key, part.value) for key, part in cookies.items()
             if key.startswith("a_session_") and part.value]
    if not items:
        raise Gate("session cookie unavailable")
    return "; ".join(key + "=" + value for key, value in items)

def sign_in(user):
    result, headers = required(
        "POST", "/v1/account/sessions/email", "disposable login", (201,),
        data={"email": user["email"], "password": user["password"]})
    if not isinstance(result, dict):
        raise Gate("session result invalid")
    return extract_cookies(headers)

def account_id(cookie):
    user, _ = required("GET", "/v1/account", "authenticated account", cookie=cookie)
    if not isinstance(user, dict) or not isinstance(user.get("$id"), str):
        raise Gate("authenticated identity malformed")
    return user["$id"]

def setup_user(label):
    token = secrets.token_hex(5)
    uid = "m2067" + label + "_" + token
    user = {
        "id": uid,
        "email": "mosaic2067." + label + "." + token + "@example.com",
        "password": secrets.token_urlsafe(22),
    }
    result, _ = required("POST", "/v1/account", "disposable account creation", (201,),
        data={"userId": uid, "email": user["email"], "password": user["password"],
              "name": "Disposable Security 2067"})
    if not isinstance(result, dict) or result.get("$id") != uid:
        raise Gate("created disposable identity mismatch")
    user["cookie"] = sign_in(user)
    if account_id(user["cookie"]) != uid:
        raise Gate("login owner identity mismatch")
    return user

def file_upload(cookie, file_id, owner):
    boundary = "MosaicSecurity" + secrets.token_hex(12)
    pieces = []
    for key, value in (
        ("fileId", file_id),
        ("permissions[]", 'read("user:' + owner + '")'),
        ("permissions[]", 'update("user:' + owner + '")'),
        ("permissions[]", 'delete("user:' + owner + '")'),
    ):
        pieces.append(("--" + boundary + "\r\n"
            + 'Content-Disposition: form-data; name="' + key + '"\r\n\r\n'
            + value + "\r\n").encode())
    pieces.extend((
        ("--" + boundary + "\r\n"
         'Content-Disposition: form-data; name="file"; filename="test.webp"\r\n'
         "Content-Type: image/webp\r\n\r\n").encode(),
        IMAGE,
        b"\r\n",
        ("--" + boundary + "--\r\n").encode(),
    ))
    data, _ = required("POST", BUCKET + "/files", "private wallpaper upload",
                       (201,), cookie=cookie, multipart=(b"".join(pieces), boundary))
    if not isinstance(data, dict) or data.get("$id") != file_id:
        raise Gate("private upload identity mismatch")
    needed = {'read("user:' + owner + '")',
              'update("user:' + owner + '")',
              'delete("user:' + owner + '")'}
    if not needed.issubset(set(data.get("$permissions") or [])):
        raise Gate("owner-only file permissions not returned")
    return data

def denial(method, path, stage, cookie="", data=None):
    status, _, _ = request(method, path, cookie=cookie, data=data, parse=False)
    if status not in DENIED:
        raise Gate(stage + " expected-denial got=" + str(status))

def function_read(cookie, stage):
    body = {"body": json.dumps({"action":"get_notifications", "limit":1}),
            "async":False, "path":"/", "method":"POST"}
    res, _ = required("POST", FUNCTION_EXEC, stage, (201,), cookie=cookie, data=body)
    if not isinstance(res, dict) or res.get("status") != "completed" or res.get("responseStatusCode") != 200:
        raise Gate(stage + " function response not successful")
    return body

def totp(secret):
    s = secret.upper().replace(" ", "").strip("=")
    key = base64.b32decode(s + "=" * (-len(s) % 8), casefold=True)
    counter = struct.pack(">Q", int(time.time()) // 30)
    digest = hmac.new(key, counter, hashlib.sha1).digest()
    offset = digest[-1] & 15
    number = struct.unpack(">I", digest[offset:offset + 4])[0] & 0x7fffffff
    return str(number % 1000000).zfill(6)

def wait_new_totp_step(previous):
    deadline = time.monotonic() + 35
    while int(time.time()) // 30 <= previous and time.monotonic() < deadline:
        time.sleep(0.8)
    if int(time.time()) // 30 <= previous:
        raise Gate("TOTP clock did not advance")

def challenge(cookie, factor):
    result, _ = required("POST", "/v1/account/mfa/challenges",
        "MFA challenge " + factor, (200, 201), cookie=cookie, data={"factor": factor})
    if not isinstance(result, dict) or not isinstance(result.get("$id"), str):
        raise Gate("MFA challenge ID missing")
    return result["$id"]

def finish_challenge(cookie, challenge_id, secret):
    status, data, _ = request("PUT", "/v1/account/mfa/challenges",
        cookie=cookie, data={"challengeId": challenge_id, "otp": secret})
    if status != 200:
        error_type = data.get("type", "unrecognized") if isinstance(data, dict) else "unrecognized"
        if not isinstance(error_type, str) or not __import__("re").fullmatch("[a-z_]{1,64}", error_type):
            error_type = "unrecognized"
        raise Gate("complete MFA challenge status=" + str(status) + " type=" + error_type)

def cleanup(users, file_id):
    errors = []
    owner = users[0] if users else None
    if owner and file_id:
        cookies = [owner.get(x, "") for x in ("recovery_cookie", "totp_cookie", "cookie")]
        deleted = False
        for cookie in cookies:
            if not cookie:
                continue
            try:
                code, _, _ = request("DELETE", BUCKET + "/files/" + file_id, cookie=cookie)
                if code in (204, 200):
                    deleted = True
                    break
            except Gate:
                pass
        if not deleted:
            errors.append("WALLPAPER_FILE_DELETE_UNVERIFIED")
        else:
            print("MOSAIC_2067_TEST_FILE_DELETED_PASS", flush=True)
    for u in users:
        disabled = False
        for cookie in (u.get("recovery_cookie"), u.get("totp_cookie"), u.get("cookie")):
            if not cookie:
                continue
            try:
                status, _, _ = request("PATCH", "/v1/account/status", cookie=cookie, data={})
                if status in (200, 204):
                    disabled = True
                    break
            except Gate:
                pass
        if not disabled:
            errors.append("ACCOUNT_DISABLE_" + u["id"])
    if errors:
        print("MOSAIC_2067_CLEANUP_INCOMPLETE " + ",".join(errors), flush=True)
    else:
        print("MOSAIC_2067_TEST_ACCOUNTS_DISABLED_PASS", flush=True)
    return errors

def main():
    if (os.environ.get("GITHUB_REPOSITORY") != "carlers/mosaic-life-tracker"
        or os.environ.get("GITHUB_REF") != "refs/heads/chatgpt/2067-scratch-security-20261116"
        or os.environ.get("GITHUB_ACTOR") != "carlers"):
        raise Gate("untrusted runner identity or branch")
    if HOST != "129-221-244-67.sslip.io" or PROJECT != "6ae94a2100014d01f5ed":
        raise Gate("wrong backend target")
    status, _, _ = request("GET", "/v1/health/version", parse=False)
    if status != 200:
        raise Gate("scratch health unavailable")
    denial("GET", "/v1/account", "anonymous account")
    users, file_id, failed = [], "", None
    try:
        for label in ("a", "b"):
            user = setup_user(label)
            users.append(user)
            print("MOSAIC_2067_CREATED_DISPOSABLE_ID=" + user["id"], flush=True)
        a, b = users
        file_id = "wall_" + a["id"] + "_0"
        file_upload(a["cookie"], file_id, a["id"])
        mine, _ = required("GET", BUCKET + "/files/" + file_id,
                           "owner wallpaper metadata", cookie=a["cookie"])
        if not isinstance(mine, dict) or mine.get("$id") != file_id:
            raise Gate("owner wallpaper read malformed")
        code, raw_view, _ = request("GET", BUCKET + "/files/" + file_id + "/view",
                                    cookie=a["cookie"], parse=False)
        if code != 200:
            raise Gate("owner wallpaper view failed " + str(code))
        denial("GET", BUCKET + "/files/" + file_id, "foreign wallpaper metadata", b["cookie"])
        denial("GET", BUCKET + "/files/" + file_id + "/view",
               "foreign wallpaper bytes", b["cookie"])
        denial("GET", BUCKET + "/files/" + file_id, "anonymous wallpaper metadata")
        denial("GET", BUCKET + "/files/" + file_id + "/view", "anonymous wallpaper bytes")
        foreign_list, _ = required("GET", BUCKET + "/files?limit=25",
                                   "other account file list", cookie=b["cookie"])
        if any(f.get("$id") == file_id for f in (foreign_list or {}).get("files", [])):
            raise Gate("foreign listing leaked wallpaper")
        print("MOSAIC_2067_SCRATCH_CROSS_ACCOUNT_WALLPAPER_DENIAL_PASS", flush=True)
        required("GET", DIARY, "complete-session TablesDB baseline",
                 cookie=a["cookie"], parse=False)
        function_body = function_read(a["cookie"], "complete-session Function baseline")
        print("MOSAIC_2067_PRIVATE_RESOURCE_BASELINES_PASS", flush=True)
        factor, _ = required("POST", "/v1/account/mfa/authenticators/totp",
                             "create TOTP authenticator", (200, 201), cookie=a["cookie"], data={})
        if not isinstance(factor, dict) or not isinstance(factor.get("secret"), str):
            raise Gate("TOTP enrollment secret missing")
        secret = factor["secret"]
        enrollment_step = int(time.time()) // 30
        required("PUT", "/v1/account/mfa/authenticators/totp", "confirm TOTP",
                 (200,), cookie=a["cookie"], data={"otp": totp(secret)})
        # Mirror the shipped Security UI: verify TOTP, then create recovery codes.
        codes, _ = required("POST", "/v1/account/mfa/recovery-codes",
                            "create recovery codes", (201,), cookie=a["cookie"], data={})
        if not isinstance(codes, dict) or not isinstance(codes.get("recoveryCodes"), list) or not codes["recoveryCodes"]:
            raise Gate("recovery code set missing")
        code_once = codes["recoveryCodes"][0]
        enabled, _ = required("PATCH", "/v1/account/mfa", "enable user MFA",
                               (200,), cookie=a["cookie"], data={"mfa": True})
        if not isinstance(enabled, dict) or enabled.get("mfa") is not True:
            raise Gate("MFA enable not confirmed")
        print("MOSAIC_2067_SCRATCH_MFA_ENROLLMENT_PASS", flush=True)

        a["partial_cookie"] = sign_in(a)
        status, result, _ = request("GET", "/v1/account", cookie=a["partial_cookie"])
        if status not in (401, 403) or not isinstance(result, dict) or result.get("type") != "user_more_factors_required":
            raise Gate("partial MFA account.get was not specifically gated status=" + str(status))
        denial("GET", DIARY, "partial MFA TablesDB", a["partial_cookie"])
        denial("GET", BUCKET + "/files/" + file_id,
               "partial MFA own private file", a["partial_cookie"])
        denial("GET", BUCKET + "/files/" + file_id + "/view",
               "partial MFA own private file bytes", a["partial_cookie"])
        denial("POST", FUNCTION_EXEC, "partial MFA Function", a["partial_cookie"],
               data=function_body)
        print("MOSAIC_2067_SCRATCH_FIRST_FACTOR_PRIVATE_RESOURCE_DENIAL_PASS", flush=True)
        wait_new_totp_step(enrollment_step)
        ch = challenge(a["partial_cookie"], "totp")
        finish_challenge(a["partial_cookie"], ch, totp(secret))
        a["totp_cookie"] = a["partial_cookie"]
        if account_id(a["totp_cookie"]) != a["id"]:
            raise Gate("TOTP completion did not restore identity")
        function_read(a["totp_cookie"], "post-TOTP Function authorization")
        print("MOSAIC_2067_SCRATCH_TOTP_LOGIN_PASS", flush=True)

        a["recovery_cookie"] = sign_in(a)
        status, _, _ = request("GET", "/v1/account", cookie=a["recovery_cookie"])
        if status not in (401, 403):
            raise Gate("recovery session bypassed second factor")
        ch = challenge(a["recovery_cookie"], "recoveryCode")
        finish_challenge(a["recovery_cookie"], ch, code_once)
        if account_id(a["recovery_cookie"]) != a["id"]:
            raise Gate("recovery challenge did not restore identity")
        print("MOSAIC_2067_SCRATCH_RECOVERY_CODE_ONCE_PASS", flush=True)

        replay_cookie = sign_in(a)
        ch = challenge(replay_cookie, "recoveryCode")
        status, _, _ = request("PUT", "/v1/account/mfa/challenges",
            cookie=replay_cookie, data={"challengeId":ch, "otp":code_once})
        if status not in (400, 401, 403):
            raise Gate("reused recovery code accepted or inconclusive=" + str(status))
        status, _, _ = request("GET", "/v1/account", cookie=replay_cookie)
        if status not in (401, 403):
            raise Gate("recovery replay left a complete login")
        print("MOSAIC_2067_SCRATCH_RECOVERY_REPLAY_DENIED_PASS", flush=True)
    except Exception as error:
        failed = error if isinstance(error, Gate) else Gate("unhandled test API or data shape error")
    finally:
        errors = cleanup(users, file_id)
    if failed:
        raise failed
    if errors:
        raise Gate("synthetic cleanup was incomplete")
    print("MOSAIC_2067_AUTHENTICATED_SCRATCH_SECURITY_GATES_PASS", flush=True)

if __name__ == "__main__":
    try:
        main()
    except Gate as error:
        print("MOSAIC_2067_AUTHENTICATED_SCRATCH_SECURITY_GATES_BLOCKED: " + str(error), flush=True)
        raise SystemExit(1)
