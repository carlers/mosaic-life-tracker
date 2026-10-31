"""Offline contract tests for the independent benchmark harness."""
import unittest
from benchmark import AS_OF, read_cases, rule_predict, safe_validate, stratified_sample
from pathlib import Path


class BenchmarkContract(unittest.TestCase):
    def test_corpus_is_fixed_and_uses_no_real_task_data(self):
        cases = read_cases(Path(__file__).with_name('cases.jsonl'))
        self.assertEqual(len(cases), 168)
        self.assertEqual(len({r['id'] for r in cases}), len(cases))
        self.assertEqual({r['group'] for r in cases}, {'canonical', 'rephrased', 'natural', 'taglish', 'ambiguous', 'unsupported'})

    def test_sample_is_reproducible_and_covers_all_groups(self):
        cases = read_cases(Path(__file__).with_name('cases.jsonl'))
        first = stratified_sample(cases, 48)
        self.assertEqual([x['id'] for x in first], [x['id'] for x in stratified_sample(cases, 48)])
        self.assertEqual(len(first), 48)
        self.assertEqual(len({x['group'] for x in first}), 6)

    def test_rule_parser_creates_only_explicit_owned_task(self):
        self.assertEqual(rule_predict('Add buy milk to Personal tomorrow'),
                         {'status': 'create_task', 'title': 'buy milk', 'category': 'Personal', 'date': '2026-11-01'})
        self.assertEqual(rule_predict('Create read a book in College in backlog')['date'], '')
        self.assertEqual(rule_predict('Add my work to Work today')['title'], 'my work')

    def test_validation_rejects_invalid_or_missing_fields(self):
        for bad in [
            {'status': 'create_task', 'title': 'buy milk', 'category': 'Not Mine', 'date': '2026-11-01'},
            {'status': 'create_task', 'title': 'buy milk', 'category': 'School', 'date': '2026-02-30'},
            {'status': 'create_task', 'title': '', 'category': 'School', 'date': '2026-11-01'},
            {'status': 'delete_all', 'title': 'buy milk', 'category': 'School', 'date': '2026-11-01'},
        ]:
            self.assertEqual(safe_validate(bad)['status'], 'needs_review')

    def test_date_error_does_not_create(self):
        self.assertEqual(rule_predict('Add assignment to School on 2026-02-30')['status'], 'needs_review')
        self.assertEqual(rule_predict('Add assignment to School on 2026-11-01 or 2026-11-02')['status'], 'needs_review')


if __name__ == '__main__':
    unittest.main()
