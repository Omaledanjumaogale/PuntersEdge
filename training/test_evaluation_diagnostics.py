import unittest
from evaluation_diagnostics import paired_block_interval, reliability


class DiagnosticsTests(unittest.TestCase):
    def test_empty_and_small_samples_cannot_support_promotion(self):
        self.assertIsNone(paired_block_interval([])['interval95'])
        self.assertFalse(paired_block_interval([-.1]*40)['sufficient'])

    def test_bootstrap_is_reproducible_and_keeps_fixture_as_unit(self):
        values = [-.02 + (index % 7)*.001 for index in range(70)]
        report = paired_block_interval(values)
        self.assertEqual(report, paired_block_interval(values))
        self.assertEqual(report['nFixtures'], 70)
        self.assertLess(report['interval95'][1], 0)

    def test_uncertain_or_worse_challengers_do_not_claim_improvement(self):
        self.assertGreater(paired_block_interval([.02]*70)['interval95'][0], 0)
        report = paired_block_interval([-.1]*35 + [.1]*35)
        self.assertLess(report['interval95'][0], 0)
        self.assertGreater(report['interval95'][1], 0)

    def test_reliability_reports_observed_outcomes_with_non_degenerate_intervals(self):
        bucket = reliability([(.91, 1)]*10)[0]
        self.assertEqual(bucket['n'], 10)
        self.assertEqual(bucket['observedRate'], 1)
        self.assertLess(bucket['observedRate95'][0], .8)
        self.assertAlmostEqual(bucket['observedRate95'][1], 1)
        with self.assertRaises(ValueError):
            reliability([(float('nan'), 1)])


if __name__ == '__main__':
    unittest.main()


class SelectedDirectionTests(unittest.TestCase):
 def test_reports_separate_calibration_and_exposes_regression_on_same_selected_fixtures(self):
  from evaluation_diagnostics import selected_direction_diagnostics
  rows=[(.9,.65,1)]*26+[(.9,.65,0)]*14
  report=selected_direction_diagnostics(rows)
  self.assertEqual(report['nFixtures'],40);self.assertTrue(report['sufficient']);self.assertFalse(report['nonRegressing'])
  self.assertAlmostEqual(report['observedWinRate'],.65);self.assertAlmostEqual(report['calibrationError'],.25)
  self.assertEqual(sum(b['n']for b in report['reliability']),40)
 def test_sparse_cohort_stays_explicitly_insufficient_and_invalid_probabilities_fail(self):
  from evaluation_diagnostics import selected_direction_diagnostics
  report=selected_direction_diagnostics([(.8,.7,1)])
  self.assertFalse(report['sufficient']);self.assertEqual(report['nFixtures'],1)
  with self.assertRaises(ValueError):selected_direction_diagnostics([(1.2,.5,1)])
