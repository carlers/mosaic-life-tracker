"""No-network strict source/restore mode regression for private Settings."""
import os
import sys
import hashlib
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parents[1]))
import restore_private_core_to_disposable as m

ALL = m.CORE + m.FRESH_DIARY + m.PERSONAL_SETTINGS
TEN = ALL + m.PRIVATE_BUCKET_LINKS


def table_data(names):
    return ("\n".join(
        f"{i}; 0 {i} TABLE DATA {name.split('.')[0]} {name.split('.')[1]} postgres"
        for i, name in enumerate(names, 1)
    ) + "\n").encode()


def mode(name=None):
    env = {}
    if name in ('diary', 'settings', 'ten'):
        env['MOSAIC_FRESH_SNAPSHOT_SHA256'] = 'a' * 64
    if name in ('settings', 'ten'):
        env['MOSAIC_PERSONAL_SETTINGS_RESTORE'] = '1'
    if name == 'ten':
        env['MOSAIC_BUCKET_LINKS_RESTORE'] = '1'
    return patch.dict(os.environ, env, clear=True)


def manifest(names):
    with patch.object(m, 'in_db', return_value=table_data(names)):
        return m.copy_manifest('disposable-only')


class Contract(unittest.TestCase):
    def test_six_historical_unchanged(self):
        with mode():
            self.assertEqual(m.selected_data_tables(), m.CORE)
            self.assertEqual(list(manifest(m.CORE)), m.CORE)
            self.assertEqual(m.validate_source_counts(m.EXPECTED_SOURCE), m.EXPECTED_SOURCE)

    def test_seven_fresh_unchanged(self):
        with mode('diary'):
            self.assertEqual(m.selected_data_tables(), ALL[:-1])
            self.assertEqual(list(manifest(ALL[:-1])), ALL[:-1])

    def test_old_modes_refuse_settings_bearing_archive(self):
        for flavor in (None, 'diary'):
            with self.subTest(flavor=flavor), mode(flavor):
                with self.assertRaisesRegex(ValueError, 'eight-table'):
                    manifest(ALL)

    def test_manifest_order_cannot_hide_a_newer_personal_profile(self):
        # A fresh archive carries Diary *before* Settings. A generic Diary
        # refusal must not hide the stricter reviewed Settings profile.
        with mode(None), self.assertRaisesRegex(ValueError, 'eight-table'):
            manifest(list(reversed(ALL)))
        with mode(None), self.assertRaisesRegex(ValueError, 'eight-table'):
            manifest(ALL)
        with mode('diary'), self.assertRaisesRegex(ValueError, 'ten-table'):
            manifest(m.CORE + m.FRESH_DIARY + m.PRIVATE_BUCKET_LINKS)
        with mode('settings'), self.assertRaisesRegex(ValueError, 'ten-table'):
            manifest(list(reversed(TEN)))

    def test_old_modes_refuse_new_bucket_or_link_data_without_ten_table_recovery(self):
        for flavor in (None, 'diary', 'settings'):
            for domain in m.PRIVATE_BUCKET_LINKS:
                with self.subTest(mode=flavor, table=domain), mode(flavor):
                    allowed = m.selected_data_tables()
                    with self.assertRaisesRegex(ValueError, 'ten-table'):
                        manifest(allowed + [domain])

    def test_unknown_personal_data_never_silently_disappears(self):
        for flavor in (None, 'diary', 'settings'):
            with self.subTest(mode=flavor), mode(flavor):
                allowed = m.selected_data_tables()
                with self.assertRaisesRegex(ValueError, 'Unknown personal table'):
                    manifest(allowed + ['public.mosaic_candidate_unreviewed'])

    def test_eight_requires_sha(self):
        with patch.dict(os.environ, {'MOSAIC_PERSONAL_SETTINGS_RESTORE':'1'}, clear=True):
            with self.assertRaisesRegex(ValueError, 'fresh archive SHA'):
                m.selected_data_tables()

    def test_noncanonical_mode_refused(self):
        for val in ('', 'true', '0', 'false'):
            with self.subTest(val=val), patch.dict(os.environ, {
                'MOSAIC_PERSONAL_SETTINGS_RESTORE':val,
                'MOSAIC_FRESH_SNAPSHOT_SHA256':'a'*64,
            }, clear=True):
                with self.assertRaisesRegex(ValueError, 'authorization'):
                    m.selected_data_tables()

    def test_explicit_eight_requires_every_entry(self):
        with mode('settings'):
            self.assertEqual(m.selected_data_tables(), ALL)
            self.assertEqual(list(manifest(ALL)), ALL)

    def test_missing_settings_entry_refused(self):
        with mode('settings'), self.assertRaisesRegex(ValueError, 'Missing required'):
            manifest(ALL[:-1])

    def test_duplicate_settings_entry_refused(self):
        with mode('settings'), self.assertRaisesRegex(ValueError, 'Duplicate'):
            manifest(ALL + m.PERSONAL_SETTINGS)

    def test_explicit_ten_requires_all_authorized_data_objects(self):
        with mode('ten'):
            self.assertEqual(m.selected_data_tables(), TEN)
            self.assertEqual(list(manifest(TEN)), TEN)

    def test_ten_rejects_missing_and_duplicate_bucket_link_data(self):
        with mode('ten'):
            for name in m.PRIVATE_BUCKET_LINKS:
                with self.subTest(table=name):
                    with self.assertRaisesRegex(ValueError, 'Missing required'):
                        manifest([t for t in TEN if t != name])
                    with self.assertRaisesRegex(ValueError, 'Duplicate required'):
                        manifest(TEN + [name])

    def test_ten_requires_exact_explicit_settings_and_sha_mode(self):
        for env in [
            {'MOSAIC_BUCKET_LINKS_RESTORE':'1'},
            {'MOSAIC_BUCKET_LINKS_RESTORE':'1',
             'MOSAIC_FRESH_SNAPSHOT_SHA256':'a'*64},
            {'MOSAIC_BUCKET_LINKS_RESTORE':'0',
             'MOSAIC_PERSONAL_SETTINGS_RESTORE':'1',
             'MOSAIC_FRESH_SNAPSHOT_SHA256':'a'*64},
        ]:
            with self.subTest(env=env), patch.dict(os.environ, env, clear=True):
                with self.assertRaisesRegex(ValueError, 'Bucket/link'):
                    m.selected_data_tables()

    def test_ten_preserves_bounded_signed_auth_count_and_tombstone_rows(self):
        with mode('ten'):
            counts = dict.fromkeys(TEN, 0)
            for key in ('auth.users','auth.identities',
                        'mosaic_candidate_private.core_authorities'):
                counts[key] = 2
            counts['public.mosaic_candidate_buckets'] = 4
            counts['public.mosaic_candidate_bucket_task_links'] = 5
            self.assertEqual(m.validate_source_counts(counts), counts)
            bad = dict(counts); bad['public.mosaic_candidate_bucket_task_links'] = 250001
            with self.assertRaises(ValueError):
                m.validate_source_counts(bad)

    def test_synthetic_backup_sha_pin_is_checked_before_any_container_operation(self):
        raw = b'only disposable fake ciphertext; no personal data'
        good = hashlib.sha256(raw).hexdigest()
        with tempfile.TemporaryDirectory() as folder:
            archive = Path(folder) / 'backup.age'
            archive.write_bytes(raw)
            for digest, accepted in [('0' * 64, False), (good, True)]:
                with self.subTest(accepted=accepted), patch.dict(os.environ, {
                    'MOSAIC_FRESH_SNAPSHOT_SHA256':digest,
                    'MOSAIC_PERSONAL_SETTINGS_RESTORE':'1',
                    'MOSAIC_BUCKET_LINKS_RESTORE':'1',
                    'GITHUB_ACTIONS':'true',
                    'MOSAIC_REAL_AUTH_RECOVERY_LAB':'1',
                }, clear=True):
                    with patch.object(m, 'assert_target',
                                      side_effect=ValueError('Reached disposable target')) as target:
                        with self.assertRaisesRegex(ValueError,
                            'Reached disposable target' if accepted else 'SHA256'):
                            m.restore(archive, archive, 'synthetic_only')
                        if accepted:
                            target.assert_called_once_with('synthetic_only')
                        else:
                            target.assert_not_called()

    def test_legacy_six_table_disposable_pin_is_explicit_and_not_a_bypass(self):
        cipher = b'CI-generated six-table encrypted snapshot fixture'
        digest = hashlib.sha256(cipher).hexdigest()
        with tempfile.TemporaryDirectory() as folder:
            archive = Path(folder) / 'snapshot.age'
            archive.write_bytes(cipher)
            good = {'GITHUB_ACTIONS':'true',
                    'MOSAIC_REAL_AUTH_RECOVERY_LAB':'1',
                    'MOSAIC_SYNTHETIC_ARCHIVE_SHA256':digest}
            with patch.dict(os.environ, good, clear=True):
                self.assertEqual(m.selected_data_tables(), m.CORE)
                with patch.object(m, 'assert_target',
                                  side_effect=ValueError('Reached verified disposable target')) as target:
                    with self.assertRaisesRegex(ValueError, 'Reached verified disposable target'):
                        m.restore(archive, archive, 'ci_db')
                    target.assert_called_once_with('ci_db')
            for bad in [
                {**good, 'MOSAIC_SYNTHETIC_ARCHIVE_SHA256':'0'*64},
                {**good, 'MOSAIC_SYNTHETIC_ARCHIVE_SHA256':'invalid'},
                {**good, 'GITHUB_ACTIONS':'false'},
                {**good, 'MOSAIC_REAL_AUTH_RECOVERY_LAB':'0'},
                {**good, 'MOSAIC_FRESH_SNAPSHOT_SHA256':digest},
            ]:
                with self.subTest(bad=bad), patch.dict(os.environ, bad, clear=True):
                    with patch.object(m, 'assert_target') as target:
                        with self.assertRaisesRegex(ValueError, 'SHA256|synthetic'):
                            m.restore(archive, archive, 'ci_db')
                        target.assert_not_called()

    def test_auth_integrity_and_personal_row_bound(self):
        with mode('settings'):
            counts = dict.fromkeys(ALL, 0)
            for key in ('auth.users', 'auth.identities',
                        'mosaic_candidate_private.core_authorities'):
                counts[key] = 2
            counts['public.mosaic_candidate_settings'] = 17
            self.assertEqual(m.validate_source_counts(counts), counts)
            for key in ('auth.users', 'auth.identities',
                        'mosaic_candidate_private.core_authorities'):
                bad=dict(counts); bad[key]=0
                with self.assertRaises(ValueError):
                    m.validate_source_counts(bad)
            bad=dict(counts); bad['public.mosaic_candidate_settings']=250001
            with self.assertRaises(ValueError):
                m.validate_source_counts(bad)


if __name__ == '__main__':
    unittest.main()
