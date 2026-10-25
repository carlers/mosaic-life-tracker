"""No-network strict source/restore mode regression for private Settings."""
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parents[1]))
import restore_private_core_to_disposable as m

ALL = m.CORE + m.FRESH_DIARY + m.PERSONAL_SETTINGS


def table_data(names):
    return ("\n".join(
        f"{i}; 0 {i} TABLE DATA {name.split('.')[0]} {name.split('.')[1]} postgres"
        for i, name in enumerate(names, 1)
    ) + "\n").encode()


def mode(name=None):
    env = {}
    if name in ('diary', 'settings'):
        env['MOSAIC_FRESH_SNAPSHOT_SHA256'] = 'a' * 64
    if name == 'settings':
        env['MOSAIC_PERSONAL_SETTINGS_RESTORE'] = '1'
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
