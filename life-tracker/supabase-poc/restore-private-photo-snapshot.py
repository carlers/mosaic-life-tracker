#!/usr/bin/env python3
"""Restore the entire age-encrypted hosted Scratch photo archive into a DISTINCT,
loopback-only disposable local Supabase Storage target. Never upload to source.

Before any upload: authenticate all age ciphertext/tar/manifest/object hashes.
A clean empty source is permitted but must be supplemented by an independently
encrypted NONEMPTY synthetic round-trip through the same restore path.
"""
import base64
import hashlib
import importlib.util
import io
import json
import os
import re
import secrets
import stat
import subprocess
import sys
import tarfile
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, build_opener, HTTPRedirectHandler

HERE = Path(__file__).resolve().parent
SOURCE_SPEC = importlib.util.spec_from_file_location("media_source", HERE / "private-photo-snapshot.py")
source = importlib.util.module_from_spec(SOURCE_SPEC)
SOURCE_SPEC.loader.exec_module(source)
BUCKET = source.BUCKET
TARGET_PROJECT = re.compile(r"mosaic_dr_[0-9a-f]{12}\Z")
LOCAL_DIR = re.compile(r"\.mosaic-private-recovery-[A-Za-z0-9]{8}\Z")
SYNTH_OWNER = "00000000-0000-4000-8000-000000000001"
WEBP = base64.b64decode("UklGRjQAAABXRUJQVlA4ICgAAABwAQCdASoCAAIAAoBCJaACdAFAAAD+5Qr/+N4/yXf277eZTblcAAAA")
MAX_TOTAL = source.MAX_FILES * source.MAX_FILE


class Refused(ValueError):
    pass


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        raise Refused("Local Storage redirect forbidden")


def command(args, *, cwd=None, timeout=30):
    try:
        return subprocess.run(args, cwd=cwd, capture_output=True, text=True,
                              check=True, timeout=timeout).stdout.strip()
    except (OSError, subprocess.SubprocessError) as exc:
        raise Refused("Disposable local Supabase command unavailable") from exc


def target(path):
    home = Path.home()
    if (not path.is_absolute() or path.is_symlink() or path.parent != home
        or not LOCAL_DIR.fullmatch(path.name) or not path.is_dir()
        or stat.S_IMODE(path.stat().st_mode) & 0o077):
        raise Refused("Only newly created owner-private local recovery targets accepted")
    config = (path / "supabase/config.toml").read_text()
    matches = re.findall(r'^project_id\s*=\s*"(mosaic_dr_[0-9a-f]{12})"\s*$', config, re.M)
    if len(matches) != 1 or not TARGET_PROJECT.fullmatch(matches[0]):
        raise Refused("Unexpected disposable target identity")
    port_s = (path / "mosaic-disposable-api-port").read_text().strip()
    if not port_s.isdecimal() or not 32000 <= int(port_s) <= 47000:
        raise Refused("Invalid local API port")
    if os.environ.get("DOCKER_HOST", "").startswith(("tcp://", "ssh://")):
        raise Refused("Remote Docker context forbidden")
    docker = command(["docker", "context", "inspect", command(["docker", "context", "show"]),
                      "--format", "{{.Endpoints.docker.Host}}"])
    if not docker.startswith("unix://"):
        raise Refused("Nonlocal Docker context forbidden")
    # Reuse existing exact private-stack config verifier.
    command(["python3", str(HERE / "configure-private-disposable-stack.py"),
             "check", str(path), matches[0]], timeout=60)
    raw = command(["supabase", "status", "-o", "env"], cwd=str(path), timeout=50)
    keys = {}
    for line in raw.splitlines():
        name, sep, val = line.partition("=")
        if sep and name in ("SERVICE_ROLE_KEY", "SECRET_KEY"):
            keys[name] = val.strip().strip('"')
    key = keys.get("SERVICE_ROLE_KEY")
    if not key or not key.startswith("eyJ") or len(key) < 80:
        raise Refused("Local isolated service-role credential unavailable")
    return "http://127.0.0.1:" + port_s, key, matches[0]


def db_rows(project):
    db = "supabase_db_" + project
    rows = command(["docker", "exec", db, "psql", "-XAtq", "-v", "ON_ERROR_STOP=1",
                    "-U", "postgres", "-d", "postgres", "-c",
                    "select count(*) from storage.objects where bucket_id='mosaic-personal-photos'"],
                   timeout=30)
    if not rows.isdecimal():
        raise Refused("Private local Storage inventory is not an integer")
    return int(rows)


class LocalStorage:
    def __init__(self, base, key):
        if not re.fullmatch(r"http://127[.]0[.]0[.]1:[0-9]{5}", base):
            raise Refused("Untrusted local Storage restore URL")
        self.base = base
        self.key = key
        self.opener = build_opener(NoRedirect)

    def call(self, path, method="GET", body=None, mime=None):
        if (not path.startswith("/storage/v1/") or
            any(x in path for x in ("..", "?", "#", "//", "@")) or
            method not in ("GET", "POST", "DELETE")):
            raise Refused("Invalid local Storage endpoint")
        headers = {"apikey": self.key, "Authorization": "Bearer " + self.key}
        if body is not None:
            headers["Content-Type"] = mime or "application/json"
        req = Request(self.base + path, method=method, data=body, headers=headers)
        try:
            with self.opener.open(req, timeout=25) as response:
                raw = response.read(source.MAX_FILE + 1)
                if not 200 <= response.status < 300:
                    raise Refused("Local Storage rejected operation")
                return raw
        except (HTTPError, URLError, TimeoutError) as exc:
            raise Refused("Local Storage operation failed") from exc

    def ensure_private_bucket(self):
        # A new isolated project must not contain any user-private objects.
        try:
            current = json.loads(self.call("/storage/v1/bucket/" + BUCKET))
        except Refused:
            current = None
        if current is None:
            payload = json.dumps({"id": BUCKET, "name": BUCKET, "public": False,
                                  "file_size_limit": source.MAX_FILE,
                                  "allowed_mime_types": ["image/webp"]}).encode()
            self.call("/storage/v1/bucket", "POST", payload)
            current = json.loads(self.call("/storage/v1/bucket/" + BUCKET))
        if (current.get("id") != BUCKET or current.get("public") is not False or
            current.get("file_size_limit") != source.MAX_FILE or
            current.get("allowed_mime_types") != ["image/webp"]):
            raise Refused("Independent target bucket privacy/settings mismatch")

    def path(self, key, authenticated=False):
        if not isinstance(key, str) or key.count("/") != 1:
            raise Refused("Unexpected source object key")
        owner, name = key.split("/")
        if not source.UUID.fullmatch(owner) or not source.FILE.fullmatch(name):
            raise Refused("Invalid owner file key")
        return ("/storage/v1/object/" + ("authenticated/" if authenticated else "") +
                BUCKET + "/" + quote(owner) + "/" + quote(name))

    def upload(self, key, contents):
        if not 0 < len(contents) <= source.MAX_FILE:
            raise Refused("Invalid restored file size")
        self.call(self.path(key), "POST", contents, "image/webp")
        actual = self.call(self.path(key, authenticated=True))
        if actual != contents:
            raise Refused("Independent target Storage content hash mismatch")

    def remove(self, key):
        self.call(self.path(key), "DELETE")


def decrypt_stream(archive, identity):
    return subprocess.Popen(["age", "--decrypt", "--identity", str(identity), str(archive)],
                            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)


def validate_archive(archive, identity):
    if (archive.is_symlink() or not archive.is_file() or
        archive.suffix != ".age" or not archive.stat().st_size):
        raise Refused("Encrypted source media archive missing")
    source.restricted(identity)
    process = decrypt_stream(archive, identity)
    try:
        count, size = source.verify_tar(process.stdout)
        process.stdout.close()
        if process.wait(timeout=120) != 0:
            raise Refused("Age archive authentication failed")
    except BaseException:
        process.kill()
        process.wait()
        raise
    # A second streaming pass parses authenticated manifest; no plaintext disk.
    process = decrypt_stream(archive, identity)
    try:
        manifest = None
        with tarfile.open(fileobj=process.stdout, mode="r|") as tar:
            for item in tar:
                if item.name == "manifest.json":
                    manifest = json.loads(tar.extractfile(item).read(source.MAX_FILE + 1))
                else:
                    stream = tar.extractfile(item)
                    while stream.read(1024 * 1024):
                        pass
        process.stdout.close()
        if process.wait(timeout=120) != 0:
            raise Refused("Age manifest decryption failed")
        if not isinstance(manifest, dict) or len(manifest.get("objects", [])) != count:
            raise Refused("Authenticated manifest count mismatch")
        return manifest, count, size
    except BaseException:
        process.kill()
        process.wait()
        raise


def restore_archive(archive, identity, store, project, *, expected_min=0):
    manifest, count, total = validate_archive(archive, identity)
    if count < expected_min or count > source.MAX_FILES:
        raise Refused("Nonempty media recovery requirement not met")
    expected = {item["key"]: item for item in manifest["objects"]}
    if len(expected) != count:
        raise Refused("Duplicate manifest path")
    if db_rows(project) != 0:
        raise Refused("Independent target Storage is not initially empty")
    store.ensure_private_bucket()
    restored = 0
    process = decrypt_stream(archive, identity)
    try:
        with tarfile.open(fileobj=process.stdout, mode="r|") as tar:
            for item in tar:
                if item.name == "manifest.json":
                    break
                path = item.name[len("objects/"):]
                body = tar.extractfile(item).read(source.MAX_FILE + 1)
                detail = expected.get(path)
                if (detail is None or detail["size"] != len(body) or
                    detail["sha256"] != hashlib.sha256(body).hexdigest()):
                    raise Refused("Encrypted Storage object manifest/byte mismatch")
                store.upload(path, body)
                restored += 1
        process.stdout.close()
        if process.wait(timeout=120) != 0 or restored != count:
            raise Refused("Independent restored media count mismatch")
    except BaseException:
        process.kill()
        process.wait()
        raise
    if db_rows(project) != count:
        raise Refused("Restored Storage metadata count differs from archive")
    return count, total


def make_nonempty_archive(path, identity):
    """Exercise same real age+tar snapshot pipeline without live user photos."""
    if path.exists() or path.is_symlink():
        raise Refused("Synthetic media archive path already exists")
    recipient = command(["age-keygen", "-y", str(identity)])
    if not re.fullmatch(r"age1[0-9a-z]{40,100}", recipient):
        raise Refused("Existing backup age recipient invalid")
    class Synthetic:
        def list(self, prefix):
            if prefix == "":
                return [{"id": None, "name": SYNTH_OWNER}]
            if prefix == SYNTH_OWNER:
                return [{"id": "synthetic-file", "name": "synthetic-proof.webp",
                         "metadata": {"size": len(WEBP)}, "updated_at": "2026-10-24T00:00:00Z"}]
            raise Refused("Wrong synthetic Storage prefix")
        def download(self, name):
            if name != SYNTH_OWNER + "/synthetic-proof.webp":
                raise Refused("Unexpected synthetic fixture")
            return WEBP
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    try:
        with os.fdopen(fd, "wb") as dest:
            encrypted = subprocess.Popen(["age", "-r", recipient], stdin=subprocess.PIPE,
                                         stdout=dest, stderr=subprocess.DEVNULL)
            try:
                source.capture_tar(encrypted.stdin, Synthetic())
                encrypted.stdin.close()
                if encrypted.wait(timeout=90) != 0:
                    raise Refused("Synthetic media encryption failed")
            except BaseException:
                if encrypted.stdin and not encrypted.stdin.closed:
                    encrypted.stdin.close()
                encrypted.kill()
                encrypted.wait()
                raise
    except BaseException:
        path.unlink(missing_ok=True)
        raise


def run(archive, local_dir):
    key = Path.home() / ".config/mosaic/supabase-backup.agekey"
    source.restricted(key)
    base, token, project = target(local_dir)
    if db_rows(project) != 0:
        raise Refused("Disposable Storage target is not empty")
    store = LocalStorage(base, token)
    count, size = restore_archive(archive, key, store, project)
    print("SUPABASE_PRIVATE_MEDIA_ALL_BUCKET_ISOLATED_RESTORE_PASS: objects=" +
          str(count) + " bytes=" + str(size), flush=True)
    if count == 0:
        # The source may legitimately be empty today. That does not prove
        # an existing user image is recoverable; separately encrypt and restore
        # a nonempty synthetic snapshot into this isolated local target.
        backup = Path.home() / "mosaic-secure-backups"
        if (backup.is_symlink() or not backup.is_dir() or
            stat.S_IMODE(backup.stat().st_mode) & 0o077):
            raise Refused("Private backup directory unavailable")
        synthetic = backup / ("mosaic-private-media-synthetic-" + secrets.token_hex(12) + ".age")
        try:
            make_nonempty_archive(synthetic, key)
            actual, bytecount = restore_archive(synthetic, key, store, project, expected_min=1)
            if actual != 1 or bytecount != len(WEBP):
                raise Refused("Nonempty encrypted media restore parity failed")
            print("SUPABASE_PRIVATE_MEDIA_NONEMPTY_ENCRYPTED_RESTORE_PASS", flush=True)
        finally:
            synthetic.unlink(missing_ok=True)
    else:
        print("SUPABASE_PRIVATE_MEDIA_NONEMPTY_ENCRYPTED_RESTORE_PASS", flush=True)
    print("NOT_FULL_RECOVERY: ongoing scheduled backup/retention and managed Auth/SMTP remain separate.")


def main():
    if len(sys.argv) != 3:
        raise Refused("Usage: restore-private-photo-snapshot.py /private/media.age /private/disposable-target")
    run(Path(sys.argv[1]), Path(sys.argv[2]))


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, subprocess.SubprocessError, tarfile.TarError, KeyboardInterrupt):
        print("SUPABASE_PRIVATE_MEDIA_ISOLATED_RESTORE_NOT_VERIFIED", file=sys.stderr)
        sys.exit(1)
