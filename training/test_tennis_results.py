import unittest
from tennis_results import parse_row, forecasts, Ratings, DELAY


def source(**changes):
    return {'match_id': '1', 'joueur1_id': 'z', 'joueur2_id': 'a', 'vainqueur_id': 'z',
            'genre': 'atp', 'surface': 'dur', 'score': '6-4 7-6(3)', 'date': '2025-01-01 10:00:00',
            'cote1_ouverture': '1.5', 'cote2_ouverture': '2.8', **changes}


class ResultsTests(unittest.TestCase):
    def test_canonical_player_order_keeps_labels_and_odds_on_correct_side(self):
        row = parse_row(source())
        self.assertEqual((row['a'], row['b']), ('a', 'z'))
        self.assertEqual(row['match_winner'], 0)
        self.assertEqual(row['first_set_winner'], 0)
        self.assertAlmostEqual(row['openingBenchmark'], (1/2.8)/(1/1.5+1/2.8))

    def test_retirements_incomplete_and_inconsistent_winners_are_excluded(self):
        for score in ('6-4 2-1 RET', '6-4', '6-0 6-0 6-0 6-0', '6-6 6-0', 'W/O'):
            self.assertIsNone(parse_row(source(score=score)))
        self.assertIsNone(parse_row(source(vainqueur_id='a')))

    def test_missing_quotes_do_not_become_estimated_bookmaker_prices(self):
        row = parse_row(source(cote1_ouverture='', cote2_ouverture=''))
        self.assertIsNone(row['openingBenchmark'])
        self.assertNotIn('serveA', row)

    def test_unknown_players_abstain_until_ten_prior_labels(self):
        row = parse_row(source())
        model = Ratings()
        for _ in range(9):
            model.update(row, 'match_winner')
        self.assertIsNone(model.probability(row))
        model.update(row, 'match_winner')
        self.assertLess(model.probability(row), .5)

    def test_current_outcome_and_delayed_future_labels_cannot_change_forecast(self):
        base = parse_row(source())
        rows = [{**base, 'id': str(i), 'start': base['start']+i*86400} for i in range(35)]
        original, _ = forecasts(rows)
        altered = [dict(row) for row in rows]
        altered[-1]['match_winner'] = 1
        changed, _ = forecasts(altered)
        self.assertTrue(original)
        self.assertEqual([r['p'] for r in original], [r['p'] for r in changed])
        short = [{**base, 'id': str(i), 'start': base['start']+i} for i in range(50)]
        self.assertEqual(forecasts(short)[0], [])
        self.assertEqual(DELAY, 7*86400)


if __name__ == '__main__':
    unittest.main()
