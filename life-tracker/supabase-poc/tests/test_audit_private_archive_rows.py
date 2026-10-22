"""Fail-closed tests for read-only archive TABLE DATA row-count inspection."""
import importlib.util
import unittest
from pathlib import Path

source = Path(__file__).resolve().parents[1] / "audit_private_archive_rows.py"
spec = importlib.util.spec_from_file_location("mosaic_private_archive_audit", source)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

CORE = (
    "auth users",
    "auth identities",
    "mosaic_candidate_private core_authorities",
    "mosaic_candidate_private owner_revisions",
    "public mosaic_candidate_categories",
    "public mosaic_candidate_tasks",
)

class PrivateArchiveRowCountsTests(unittest.TestCase):
    def test_toc_limits_to_data_and_requires_all_six(self):
        toc = ["; Custom archive comment"]
        toc.extend("%s; 0 %s TABLE DATA %s postgres" % (i, i, table)
                   for i, table in enumerate(CORE, 1))
        toc.append("7; 1255 9 FUNCTION realtime list_changes(text) postgres")
        tables = module.parse_toc(toc)
        self.assertEqual(len(tables), 6)
        self.assertEqual(set(tables), set(module.REQUIRED))
        with self.assertRaises(ValueError):
            module.parse_toc(toc[:-2] + toc[-1:])
        with self.assertRaises(ValueError):
            module.parse_toc(toc + [toc[1]])

    def test_stream_copy_counts_rows_without_storing_field_data(self):
        sql = [
            b"-- pg_restore output\n",
            b"COPY auth.users (id, email) FROM stdin;\n",
            b"synthetic-id\tfake@example.invalid\n",
            b"another-id\tfake2@example.invalid\n",
            b"\\.\n",
            b"COPY public.mosaic_candidate_tasks (owner_id, title) FROM stdin;\n",
            b"the-owner\tA private task with COPY auth.users fake data\n",
            b"\\N\t\\N\n",
            b"\\.\n",
        ]
        counts = module.count_copies(iter(sql), ("auth.users", "public.mosaic_candidate_tasks"))
        self.assertEqual(counts, {"auth.users": 2, "public.mosaic_candidate_tasks": 2})
        self.assertNotIn("fake@example.invalid", str(counts))
        self.assertNotIn("private task", str(counts))

    def test_reject_missing_truncated_repeated_or_extra_data(self):
        source = [b"COPY auth.users (id) FROM stdin;\n", b"fake\n", b"\\.\n"]
        self.assertRaises(ValueError, module.count_copies, source, ["auth.users", "auth.identities"])
        self.assertRaises(ValueError, module.count_copies, source[:-1], ["auth.users"])
        self.assertRaises(ValueError, module.count_copies, source + source, ["auth.users"])
        self.assertRaises(ValueError, module.count_copies, source, ["auth.identities"])

if __name__ == "__main__":
    unittest.main()
