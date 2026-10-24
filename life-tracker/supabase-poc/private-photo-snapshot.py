#!/usr/bin/env python3
"""Isolated #1027 Scratch-only, encrypted read-only private Storage snapshot.

Requires a privileged source Storage key ONLY in this offline operator process.
Never embed that key in a Vite app, repository, Actions log, or CLI argument.
The captured archive is not complete platform DR or a replacement for a
separate-target restore and scheduled retention/monitoring.
"""
import hashlib
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
from urllib.request import HTTPRedirectHandler, Request, build_opener

SOURCE = 'https://hcxtiifzxoaflhjgoglb.supabase.co'
BUCKET = 'mosaic-personal-photos'
UUID = re.compile(r'[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\Z', re.I)
FILE = re.compile(r'[A-Za-z0-9][A-Za-z0-9._-]{0,35}[.]webp\Z')
MAX_FILE = 5 * 1024 * 1024
MAX_FILES = 100000
MAX_LIST_PAGES = 1500


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        raise ValueError('Storage redirect not allowed')


class Storage:
    def __init__(self, key):
        if not key or any(c.isspace() for c in key):
            raise ValueError('Privileged Storage key missing')
        # Service-role JWT or newer project secret is operator-only; never print.
        if not (key.startswith('eyJ') or key.startswith('sb_secret_')):
            raise ValueError('Privileged Storage key format unsupported')
        self.key = key
        self.opener = build_opener(NoRedirect)

    def fetch(self, path, payload=None):
        if not path.startswith('/storage/v1/object/') or '..' in path or '?' in path or '#' in path:
            raise ValueError('Invalid Storage API path')
        headers = {'apikey': self.key}
        if self.key.startswith('eyJ'):  # Legacy signed service-role JWT only.
            headers['Authorization'] = 'Bearer ' + self.key
        if payload is not None:
            headers['Content-Type'] = 'application/json'
        req = Request(SOURCE + path, headers=headers, method='POST' if payload is not None else 'GET',
                      data=json.dumps(payload).encode() if payload is not None else None)
        try:
            with self.opener.open(req, timeout=30) as resp:
                return resp.read(MAX_FILE + 1 if payload is None else 1024 * 1024)
        except HTTPError as exc:
            raise ValueError('Storage API denied request (' + str(exc.code) + ')') from None
        except (URLError, TimeoutError):
            raise ValueError('Storage network request failed') from None

    def list(self, prefix):
        # The v1 Storage REST list API groups directories via id=null.
        result = []
        for page in range(MAX_LIST_PAGES):
            raw = self.fetch('/storage/v1/object/list/' + BUCKET,
                             {'prefix': prefix, 'limit': 100, 'offset': 100 * page,
                              'sortBy': {'column': 'name', 'order': 'asc'}})
            items = json.loads(raw)
            if not isinstance(items, list) or len(items) > 100:
                raise ValueError('Storage list malformed')
            result.extend(items)
            if len(items) < 100:
                return result
        raise ValueError('Storage inventory pagination bound exceeded')

    def download(self, name):
        owner, filename = name.split('/')
        path = '/storage/v1/object/authenticated/' + BUCKET + '/' + quote(owner) + '/' + quote(filename)
        return self.fetch(path)


def inventory(client):
    records = []
    seen = set()
    roots = client.list('')
    folders = set()
    for folder in roots:
        if not isinstance(folder, dict) or folder.get('id') is not None:
            raise ValueError('Unexpected file in Storage root')
        owner = folder.get('name')
        if not isinstance(owner, str) or not UUID.fullmatch(owner) or owner in folders:
            raise ValueError('Unexpected Storage owner folder')
        folders.add(owner)
    for owner in sorted(folders):
        for item in client.list(owner):
            if not isinstance(item, dict) or not isinstance(item.get('name'), str):
                raise ValueError('Invalid Storage item')
            name = item['name']
            meta = item.get('metadata')
            if (item.get('id') is None or not FILE.fullmatch(name)
                or not isinstance(meta, dict) or type(meta.get('size')) is not int
                or not 0 < meta['size'] <= MAX_FILE
                or not isinstance(item.get('updated_at'), str)
                or not isinstance(item.get('id'), str)):
                raise ValueError('Unexpected Storage object contract')
            key = owner + '/' + name
            if key in seen or len(seen) >= MAX_FILES:
                raise ValueError('Duplicate or oversized Storage inventory')
            seen.add(key)
            records.append({'key': key, 'id': item['id'],
                            'updated_at': item['updated_at'], 'size': meta['size']})
    return sorted(records, key=lambda x: x['key'])


def tar_entry(archive, name, contents):
    info = tarfile.TarInfo(name)
    info.size = len(contents)
    info.mode = 0o600
    info.mtime = 0
    archive.addfile(info, io.BytesIO(contents))


def capture_tar(target, client):
    before = inventory(client)
    digest_items = []
    with tarfile.open(fileobj=target, mode='w|') as archive:
        for row in before:
            raw = client.download(row['key'])
            if len(raw) != row['size'] or len(raw) > MAX_FILE:
                raise ValueError('Storage object size mismatch')
            tar_entry(archive, 'objects/' + row['key'], raw)
            digest_items.append({**row, 'sha256': hashlib.sha256(raw).hexdigest()})
        if inventory(client) != before:
            raise ValueError('Storage inventory changed during capture')
        manifest = {'format': 'mosaic-supabase-private-media-v1',
                    'source': SOURCE, 'bucket': BUCKET, 'objects': digest_items}
        tar_entry(archive, 'manifest.json', json.dumps(manifest, separators=(',', ':'), sort_keys=True).encode())
    return manifest


def verify_tar(source):
    found = {}
    manifest = None
    with tarfile.open(fileobj=source, mode='r|') as archive:
        for entry in archive:
            if not entry.isfile() or entry.size > MAX_FILE or entry.name in found:
                raise ValueError('Invalid encrypted archive entry')
            if manifest is not None:
                raise ValueError('Manifest must be final')
            body = archive.extractfile(entry).read(MAX_FILE + 1)
            if len(body) != entry.size:
                raise ValueError('Truncated encrypted entry')
            if entry.name == 'manifest.json':
                manifest = json.loads(body)
                continue
            if not entry.name.startswith('objects/') or entry.name.count('/') != 2:
                raise ValueError('Invalid encrypted object path')
            owner, name = entry.name[len('objects/'):].split('/')
            if not UUID.fullmatch(owner) or not FILE.fullmatch(name) or not body:
                raise ValueError('Invalid encrypted object')
            found[owner + '/' + name] = (len(body), hashlib.sha256(body).hexdigest())
            if len(found) > MAX_FILES:
                raise ValueError('Encrypted snapshot too large')
    if not isinstance(manifest, dict) or manifest.get('format') != 'mosaic-supabase-private-media-v1' or manifest.get('source') != SOURCE or manifest.get('bucket') != BUCKET:
        raise ValueError('Encrypted manifest identity mismatch')
    declared = manifest.get('objects')
    if not isinstance(declared, list) or len(declared) != len(found):
        raise ValueError('Encrypted object count mismatch')
    observed = set()
    for item in declared:
        if not isinstance(item, dict) or not isinstance(item.get('key'), str):
            raise ValueError('Malformed encrypted manifest item')
        key = item['key']
        if key in observed or key not in found or found[key] != (item.get('size'), item.get('sha256')):
            raise ValueError('Encrypted object bytes mismatch')
        observed.add(key)
    return len(found), sum(size for size, _ in found.values())


def restricted(path):
    if path.is_symlink() or not path.is_file() or not path.stat().st_size:
        raise ValueError('Private age identity missing')
    if stat.S_IMODE(path.stat().st_mode) & 0o077:
        raise ValueError('Private age identity permissions too broad')


def run(out):
    if not out.is_absolute() or out.suffix != '.age' or out.exists() or out.is_symlink():
        raise ValueError('Output must be a fresh absolute .age path')
    parent = out.parent
    if not parent.is_dir() or parent.is_symlink() or stat.S_IMODE(parent.stat().st_mode) & 0o077:
        raise ValueError('Encrypted output directory must be private')
    identity = Path.home() / '.config/mosaic/supabase-backup.agekey'
    restricted(identity)
    key = os.environ.get('MOSAIC_SUPABASE_SOURCE_STORAGE_KEY', '')
    source = Storage(key)
    recipient = subprocess.run(['age-keygen', '-y', str(identity)],
                               capture_output=True, text=True, check=True, timeout=20).stdout.strip()
    if not re.fullmatch(r'age1[0-9a-z]{40,100}', recipient):
        raise ValueError('Invalid age recipient')
    partial = out.with_name(out.name + '.partial.' + secrets.token_hex(12))
    fd = os.open(partial, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    try:
        with os.fdopen(fd, 'wb') as encrypted:
            writer = subprocess.Popen(['age', '--encrypt', '--recipient', recipient],
                                      stdin=subprocess.PIPE, stdout=encrypted, stderr=subprocess.DEVNULL)
            try:
                capture_tar(writer.stdin, source)
                writer.stdin.close()
                if writer.wait(timeout=120) != 0:
                    raise ValueError('Age encryption failed')
            except BaseException:
                if writer.stdin and not writer.stdin.closed:
                    writer.stdin.close()
                writer.kill()
                writer.wait()
                raise
        reader = subprocess.Popen(['age', '--decrypt', '--identity', str(identity), str(partial)],
                                  stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
        try:
            count, size = verify_tar(reader.stdout)
            reader.stdout.close()
            if reader.wait(timeout=120) != 0:
                raise ValueError('Age authenticated decryption failed')
        except BaseException:
            reader.kill()
            reader.wait()
            raise
        os.link(partial, out)
        print('SUPABASE_PRIVATE_MEDIA_ENCRYPTED_SNAPSHOT_PASS: objects=' + str(count) + ' bytes=' + str(size))
        print('NOT_FULL_RECOVERY: scheduled retention and independently restored target remain unverified.')
    finally:
        partial.unlink(missing_ok=True)


def main():
    if len(sys.argv) != 2:
        raise ValueError('Usage: private-photo-snapshot.py /private/nonexistent-snapshot.age')
    run(Path(sys.argv[1]))


if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError, subprocess.SubprocessError, tarfile.TarError, KeyboardInterrupt):
        # The privileged bearer and personal object names must never appear in output.
        print('SUPABASE_PRIVATE_MEDIA_SNAPSHOT_NOT_VERIFIED', file=sys.stderr)
        sys.exit(1)
