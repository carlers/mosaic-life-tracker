"""Offline R2-only differential operator contracts: no credentials or provider IO."""
import importlib.util
import io
from pathlib import Path
import subprocess
import sys
import unittest
from unittest.mock import patch

SOURCE = Path(__file__).parents[1] / "operator-r2-paired-probe.py"
spec = importlib.util.spec_from_file_location("mosaic_r2_pair", SOURCE)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class PairedR2OperatorTests(unittest.TestCase):
    def test_plan_has_no_cloud_secrets_or_backup(self):
        result = subprocess.run(
            [sys.executable, str(SOURCE), "--plan"],
            capture_output=True, text=True, check=False, timeout=10,
            env={"PATH": "/usr/bin:/bin", "HOME": "/nonexistent"},
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("MOSAIC_R2_PAIRED_PLAN_NO_SECRET_OR_CLOUD_PASS", result.stdout)
        self.assertNotIn("Access Key ID (hidden)", result.stdout)
        self.assertNotIn("R2 WRITE Access Key", result.stdout)

    def test_reader_success_and_writer_signature_mismatch_are_separate(self):
        raw = (
            "MOSAIC_R2_READER_READ_CHECK_PASS\n"
            "MOSAIC_R2_WRITER_READ_CHECK_HTTP_403_SIGNATURE_MISMATCH\n"
            "MOSAIC_R2_CREDENTIAL_PAIR_NOT_VERIFIED\n"
        )
        roles, status = module.check_results(raw, 1)
        self.assertEqual(roles["READER"], "PASS")
        self.assertEqual(roles["WRITER"], "HTTP_403_SIGNATURE_MISMATCH")
        self.assertEqual(status, "MOSAIC_R2_CREDENTIAL_PAIR_NOT_VERIFIED")

    def test_both_readonly_success_is_only_valid_positive_result(self):
        raw = (
            "MOSAIC_R2_READER_READ_CHECK_PASS\n"
            "MOSAIC_R2_WRITER_READ_CHECK_PASS\n"
            "MOSAIC_R2_BOTH_CREDENTIAL_PAIRS_READ_ONLY_PASS\n"
        )
        roles, status = module.check_results(raw, 0)
        self.assertEqual(roles, {"READER": "PASS", "WRITER": "PASS"})
        self.assertTrue(status.endswith("_PASS"))
        with self.assertRaises(module.Refused):
            module.check_results(raw, 1)

    def test_extra_provider_data_or_malformed_output_is_never_relayed(self):
        good = (
            "MOSAIC_R2_READER_READ_CHECK_PASS\n"
            "MOSAIC_R2_WRITER_READ_CHECK_PASS\n"
            "MOSAIC_R2_BOTH_CREDENTIAL_PAIRS_READ_ONLY_PASS\n"
        )
        for raw in (good + "secret=accidental-unsafe-payload\n",
                    good.replace("READ_CHECK_PASS", "READ_CHECK_UNTRUSTED"),
                    good.replace("BOTH_CREDENTIAL_PAIRS_READ_ONLY_PASS", "CREDENTIAL_PAIR_NOT_VERIFIED")):
            with self.subTest(raw=raw), self.assertRaises(module.Refused):
                module.check_results(raw, 0)

    def test_pair_validation_does_not_echo_private_key_or_try_network(self):
        secret = "private-s3-writer-secret-do-not-log"
        inputs = ["a" * 32, "R" * 24, "reader-secret-123456789",
                  "W" * 24, secret]
        with patch.object(module.getpass, "getpass", side_effect=inputs):
            self.assertEqual(module.credentials()[-1], secret)
        bad = ["a" * 32, "R" * 24, "reader-secret-123456789",
               "R" * 24, secret]
        with patch.object(module.getpass, "getpass", side_effect=bad):
            with self.assertRaises(module.Refused) as error:
                module.credentials()
            self.assertNotIn(secret, str(error.exception))

    def test_exact_source_sha_required_before_any_credentials(self):
        with self.assertRaises(module.Refused):
            module.preflight("not-a-commit-sha")


if __name__ == "__main__":
    unittest.main()
