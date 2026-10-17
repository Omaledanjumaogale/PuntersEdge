import unittest
from tennis_live import name_key, project


class TennisLiveTests(unittest.TestCase):
    def setUp(self):
        self.at = 1800000000000
        self.coverage = {'at': self.at, 'events': [{'id': 'actual', 'sportKey': 'tennis_atp_event', 'playerA': 'André One',
                                                  'playerB': 'Two Beta', 'startedAt': self.at+3600000}],
                         'competitions': [{'key': 'tennis_atp_event', 'title': 'Provider event'}]}
        self.index = {('ATP', name_key('One André')): {'1': self.at/1000-10000}, ('ATP', name_key('Beta Two')): {'2': self.at/1000-10000}}
        self.model = {'global': {'1': 1700, '2': 1500}, 'counts': {'1': 40, '2': 50},
                      'calibrator': {'intercept': 0, 'slope': 1}, 'trainedThroughAssumed': self.at/1000-20000}
        self.artifacts = {'ATP:match_winner': self.model, 'ATP:first_set_winner': self.model}

    def test_exact_identity_market_order_and_probability_complements(self):
        result = project(self.coverage, self.artifacts, self.index)
        self.assertFalse(result['bettingApproved'])
        fixture = result['fixtures'][0]
        self.assertEqual(fixture['league'], 'Provider event')
        for market in fixture['markets']:
            self.assertGreater(market['options'][0]['modelProb'], market['options'][1]['modelProb'])
            self.assertAlmostEqual(sum(option['modelProb'] for option in market['options']), 1)
            self.assertNotIn('odds', market['options'][0])

    def test_ambiguous_player_abstains(self):
        self.index[('ATP', name_key('One André'))]['other'] = self.at/1000-10000
        self.assertEqual(project(self.coverage, self.artifacts, self.index)['fixtures'], [])

    def test_future_training_or_insufficient_history_never_publishes(self):
        self.model['trainedThroughAssumed'] = self.at/1000+1
        self.assertEqual(project(self.coverage, self.artifacts, self.index)['fixtures'], [])
        self.model['trainedThroughAssumed'] = self.at/1000-20000
        self.model['counts']['1'] = 9
        self.assertEqual(project(self.coverage, self.artifacts, self.index)['fixtures'], [])

    def test_past_events_and_doubles_and_missing_calibration_abstain(self):
        self.coverage['events'][0]['startedAt'] = self.at-1
        self.assertEqual(project(self.coverage, self.artifacts, self.index)['fixtures'], [])
        self.coverage['events'][0]['startedAt'] = self.at+3600000
        self.coverage['events'][0]['playerA'] = 'André One / Other Player'
        self.assertEqual(project(self.coverage, self.artifacts, self.index)['fixtures'], [])
        self.coverage['events'][0]['playerA'] = 'André One'
        self.model['calibrator'] = None
        self.assertEqual(project(self.coverage, self.artifacts, self.index)['fixtures'], [])


if __name__ == '__main__':
    unittest.main()
