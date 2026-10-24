"""Offline all-object private media recovery, integrity and isolated-target guards."""
import importlib.util
import io
import json
import os
from pathlib import Path
import stat
import tarfile
import tempfile
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).parents[1] / "restore-private-photo-snapshot.py"
spec = importlib.util.spec_from_file_location("restore_media", SCRIPT)
r = importlib.util.module_from_spec(spec)
spec.loader.exec_module(r)


def make_tar(objects):
    class FakeSource:
        def list(self, prefix):
            if prefix == "":
                return [{"id": None, "name": owner} for owner in sorted(objects)]
            return [
                {"id": "synthetic-" + name, "name": name, "metadata": {"size": len(data)},
                 "updated_at": "2026-10-24T00:00:00Z"}
                for name, data in sorted(objects[prefix].items())
            ]
        def download(self, key):
            owner, name = key.split("/")
            return objects[owner][name]
    sink = io.BytesIO()
    r.source.capture_tar(sink, FakeSource())
    return sink.getvalue()


class AgeProcess:
    def __init__(self, data):
        self.stdout = io.BytesIO(data)
    def wait(self, timeout=None):
        return 0
    def kill(self):
        pass


class FakeStorage:
    def __init__(self):
        self.items = {}
        self.configured = False
    def ensure_private_bucket(self):
        self.configured = True
    def upload(self, key, contents):
        assert self.configured and key not in self.items
        self.items[key] = contents


class MediaRestoreTest(unittest.TestCase):
    def fixture(self, objects):
        temp = tempfile.TemporaryDirectory()
        root = Path(temp.name)
        identity = root / "identity.agekey"
        identity.write_text("synthetic-private-only")
        identity.chmod(0o600)
        archive = root / "encrypted.age"
        archive.write_bytes(b"synthetic-ciphertext-replaced-in-test")
        archive.chmod(0o600)
        return temp, archive, identity, make_tar(objects)

    def test_all_owners_files_exact_parity_without_remote_api(self):
        a = "11111111-1111-4111-8111-111111111111"
        b = "22222222-2222-4222-8222-222222222222"
        files = {a: {"a.webp": r.WEBP, "b.webp": r.WEBP+b"01"},
                 b: {"third.webp": r.WEBP+b"02"}}
        temp, archive, identity, tarbytes = self.fixture(files)
        with temp:
            store = FakeStorage()
            def count(_):
                return len(store.items)
            with patch.object(r, "decrypt_stream", side_effect=lambda *_: AgeProcess(tarbytes)), \
                 patch.object(r, "db_rows", side_effect=count):
                total, size = r.restore_archive(archive, identity, store, "mosaic_dr_123456abcdef",
                                                 expected_min=1)
            self.assertEqual(total, 3)
            self.assertEqual(size, sum(len(x) for y in files.values() for x in y.values()))
            self.assertEqual(store.items[a+"/a.webp"], r.WEBP)
            self.assertEqual(store.items[b+"/third.webp"], r.WEBP+b"02")

    def test_empty_bucket_is_honestly_empty(self):
        temp, archive, identity, tarbytes = self.fixture({})
        with temp:
            store = FakeStorage()
            with patch.object(r, "decrypt_stream", side_effect=lambda *_: AgeProcess(tarbytes)), \
                 patch.object(r, "db_rows", return_value=0):
                total, size = r.restore_archive(archive, identity, store, "mosaic_dr_123456abcdef")
            self.assertEqual((total, size), (0, 0))

    def test_modified_decrypted_bytes_refused_before_local_upload(self):
        owner = "11111111-1111-4111-8111-111111111111"
        temp, archive, identity, tarbytes = self.fixture({owner: {"a.webp": r.WEBP}})
        with temp:
            tampered = tarbytes.replace(r.WEBP, bytes([r.WEBP[0] ^ 1])+r.WEBP[1:], 1)
            self.assertNotEqual(tampered, tarbytes)
            store = FakeStorage()
            with patch.object(r, "decrypt_stream", side_effect=lambda *_: AgeProcess(tampered)):
                with self.assertRaises((ValueError, tarfile.TarError)):
                    r.restore_archive(archive, identity, store, "mosaic_dr_123456abcdef")
            self.assertEqual(store.items, {})

    def test_preexisting_local_photo_blocks_any_restoration(self):
        temp, archive, identity, tarbytes = self.fixture({})
        with temp:
            store = FakeStorage()
            with patch.object(r, "decrypt_stream", side_effect=lambda *_: AgeProcess(tarbytes)), \
                 patch.object(r, "db_rows", return_value=1):
                with self.assertRaisesRegex(ValueError, "not initially empty"):
                    r.restore_archive(archive, identity, store, "mosaic_dr_123456abcdef")
            self.assertFalse(store.configured)

    def test_only_loopback_storage_endpoint_allowed(self):
        for base in ("https://hcxtiifzxoaflhjgoglb.supabase.co",
                     "http://localhost:54321", "http://127.0.0.1:9999"):
            with self.assertRaises(ValueError):
                r.LocalStorage(base, "synthetic-secret")
        safe = r.LocalStorage("http://127.0.0.1:32522", "synthetic-key")
        for path in ("//storage/v1/object", "/storage/v1/object/../../secret",
                     "/storage/v1/object?token=secret"):
            with self.assertRaises(ValueError):
                safe.call(path)

    def test_empty_source_triggers_nonempty_synthetic_recovery_and_deletes_fixture(self):
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp)
            key = home / ".config/mosaic/supabase-backup.agekey"
            key.parent.mkdir(parents=True, mode=0o700)
            key.write_text("fake-key"); key.chmod(0o600)
            private = home / "mosaic-secure-backups"
            private.mkdir(mode=0o700)
            source_archive = private / "source.age"
            source_archive.write_bytes(b"ciphertext")
            local_dir = home / ".mosaic-private-recovery-AbCd1234"
            local_dir.mkdir(mode=0o700)
            calls = []
            def fake_restore(file, *_args, **_kwargs):
                calls.append(file)
                return (0, 0) if len(calls)==1 else (1, len(r.WEBP))
            def fake_create(path, identity):
                self.assertEqual(identity, key)
                path.write_bytes(b"encrypted-synthetic")
            with patch.object(r.Path, "home", return_value=home), \
                 patch.object(r, "target", return_value=("http://127.0.0.1:32522", "fake", "mosaic_dr_123456abcdef")), \
                 patch.object(r, "db_rows", return_value=0), \
                 patch.object(r, "restore_archive", side_effect=fake_restore), \
                 patch.object(r, "make_nonempty_archive", side_effect=fake_create):
                r.run(source_archive, local_dir)
            self.assertEqual(len(calls), 2)
            self.assertFalse(calls[1].exists(), "ephemeral synthetic encrypted archive not cleaned")

if __name__ == "__main__":
    unittest.main()
