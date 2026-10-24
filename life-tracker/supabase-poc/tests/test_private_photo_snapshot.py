"""Offline no-network invariants for Supabase privileged encrypted media capture."""
import importlib.util
import io
import json
import pathlib
import tarfile
import unittest

SCRIPT = pathlib.Path(__file__).parents[1] / 'private-photo-snapshot.py'
spec = importlib.util.spec_from_file_location('media_dr', SCRIPT)
s = importlib.util.module_from_spec(spec)
spec.loader.exec_module(s)
OWNER = '11111111-1111-4111-8111-111111111111'
FILE = 'opaque_17.webp'
WEBP = b'RIFFtestWEBPsynthetic_private_bytes'


class Client:
    def __init__(self, missing=False, mutation=False):
        self.missing = missing
        self.mutation = mutation
        self.rounds = 0

    def list(self, prefix):
        if self.missing:
            return []
        if prefix == '':
            return [{'name': OWNER, 'id': None}]
        if prefix == OWNER:
            self.rounds += 1
            return [{'name': FILE, 'id': 'item-id-1',
                     'updated_at': '2026-10-24T00:00:00Z' if self.rounds == 1 or not self.mutation else '2026-10-24T00:00:01Z',
                     'metadata': {'size': len(WEBP)}}]
        raise AssertionError('Wrong owner listing')

    def download(self, key):
        assert key == OWNER + '/' + FILE
        return WEBP


class SnapshotTests(unittest.TestCase):
    def test_complete_byte_exact_snapshot_and_empty_inventory(self):
        for client, count, size in [(Client(), 1, len(WEBP)), (Client(missing=True), 0, 0)]:
            target = io.BytesIO()
            manifest = s.capture_tar(target, client)
            self.assertEqual(len(manifest['objects']), count)
            self.assertEqual(s.verify_tar(io.BytesIO(target.getvalue())), (count, size))

    def test_mutating_inventory_never_succeeds(self):
        with self.assertRaisesRegex(ValueError, 'changed'):
            s.capture_tar(io.BytesIO(), Client(mutation=True))

    def test_archive_tampering_is_rejected(self):
        buf = io.BytesIO()
        with tarfile.open(fileobj=buf, mode='w|') as tar:
            s.tar_entry(tar, 'objects/' + OWNER + '/' + FILE, b'BAD')
            s.tar_entry(tar, 'manifest.json', json.dumps({'format': 'mosaic-supabase-private-media-v1',
                'source': s.SOURCE, 'bucket': s.BUCKET, 'objects': [{
                    'key': OWNER + '/' + FILE, 'size': 3, 'sha256': '0' * 64}]}).encode())
        with self.assertRaisesRegex(ValueError, 'bytes mismatch'):
            s.verify_tar(io.BytesIO(buf.getvalue()))

    def test_rogue_paths_and_folders_are_rejected(self):
        class Rogue(Client):
            def list(self, prefix):
                if prefix == '':
                    return [{'name': OWNER, 'id': None}, {'name': '../../other', 'id': None}]
                return super().list(prefix)
        with self.assertRaisesRegex(ValueError, 'folder'):
            s.inventory(Rogue())

    def test_secret_key_uses_api_key_header_not_opaque_bearer(self):
        class FakeOpener:
            def open(self, req, timeout):
                self.headers = req.headers
                return io.BytesIO(b'[]')
        client = s.Storage('sb_secret_synthetic_not_real')
        fake = FakeOpener()
        client.opener = fake
        client.list('')
        self.assertNotIn('Authorization', fake.headers)
        self.assertEqual(fake.headers.get('Apikey'), 'sb_secret_synthetic_not_real')

    def test_identity_paths_never_include_private_metadata(self):
        self.assertEqual(s.inventory(Client())[0]['key'], OWNER + '/' + FILE)
        with self.assertRaises(ValueError):
            s.Storage('sb_publishable_not_authorized')


if __name__ == '__main__':
    unittest.main()
