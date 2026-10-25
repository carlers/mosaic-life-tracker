"""Offline fail-closed tests for non-destructive Cloudflare native R2 lock inspection."""
import importlib.util
import io
import json
from pathlib import Path
from unittest import TestCase, main
from unittest.mock import patch

P = Path(__file__).parents[1] / "r2-lock-audit.py"
spec = importlib.util.spec_from_file_location("lock_audit", P)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


def make_rule(*, prefix="mosaic-supabase/v1/", age=2592000, enabled=True, kind="Age"):
    condition = {"type": kind}
    if kind == "Age":
        condition["maxAgeSeconds"] = age
    elif kind == "Date":
        condition["date"] = "2030-01-01T00:00:00Z"
    return {"id": "operator-provisioned", "prefix": prefix,
            "condition": condition, "enabled": enabled}


def document(*rules):
    return {"success": True, "result": {"rules": list(rules)}}


class Tests(TestCase):
    def test_exact_scope_and_30days(self):
        for scope in m.SAFE_RULE_PREFIXES:
            self.assertTrue(m.assert_native_lock(document(make_rule(prefix=scope))))
        self.assertTrue(m.assert_native_lock(document(make_rule(kind="Indefinite"))))

    def test_short_29days_and_fixed_dates_rejected(self):
        for r in (make_rule(age=29*86400), make_rule(kind="Date"),
                  make_rule(age=True)):
            with self.subTest(r=r), self.assertRaises(m.Refused):
                m.assert_native_lock(document(r))

    def test_wrong_scope_disabled_or_snapshot_specific_rejected(self):
        for r in (make_rule(prefix="mosaic-dr/"), make_rule(enabled=False),
                  make_rule(prefix="mosaic-supabase/v1/snapshots/20261025T031343499Z/")):
            with self.subTest(r=r), self.assertRaises(m.Refused):
                m.assert_native_lock(document(r))

    def test_untrusted_response_shapes_fail_closed(self):
        for doc in ({}, {"success": False, "result": {"rules": [make_rule()]}},
                    {"success": True}, {"success": True, "result": {"rules": {}}},
                    document({"enabled": True, "condition": "Age"})):
            with self.subTest(doc=doc), self.assertRaises(m.Refused):
                m.assert_native_lock(doc)

    def test_no_redirect_and_endpoint_is_hardcoded_get(self):
        class Response:
            status = 200
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def read(self, limit): return json.dumps(document(make_rule())).encode()
        class Recorder:
            def open(self, request, timeout):
                self.request = request
                self.timeout = timeout
                return Response()
        recorder = Recorder()
        self.assertTrue(m.query_native_rules("a"*32, "X"*24, opener=recorder))
        self.assertEqual(recorder.request.get_method(), "GET")
        self.assertEqual(recorder.request.full_url, "https://api.cloudflare.com/client/v4/accounts/"
                         + "a"*32 + "/r2/buckets/mosaic-supabase-backups/lock")
        self.assertEqual(recorder.timeout, 25)

    def test_invalid_secret_or_account_refused_before_request(self):
        class NoNetwork:
            def open(self, *args, **kwargs):
                raise AssertionError("No untrusted network access")
        for account, token in (("wrong", "X"*24), ("a"*32, "short"), ("b"*32, "bad token "*4)):
            with self.assertRaises(m.Refused):
                m.query_native_rules(account, token, opener=NoNetwork())

    def test_tampered_status_or_json_refused(self):
        class Recorder:
            def __init__(self, code, bytes_): self.code, self.bytes = code, bytes_
            def open(self, request, timeout):
                class Response:
                    def __enter__(selfinner): selfinner.status = self.code; return selfinner
                    def __exit__(selfinner, *args): pass
                    def read(selfinner, limit): return self.bytes
                return Response()
        for code, body in ((403, b"unauthorized"), (200, b"{not-json"),
                           (200, b"x"*(128*1024+1))):
            with self.assertRaises(m.Refused):
                m.query_native_rules("a"*32, "X"*24, opener=Recorder(code, body))

    def test_offline_plan_has_no_secrets_or_network(self):
        with patch("sys.argv", ["lock", "--plan"]), patch("sys.stdout", new_callable=io.StringIO) as out:
            m.main()
        self.assertIn("GET_ONLY_NO_WRITES_PASS", out.getvalue())


if __name__ == "__main__":
    main()
