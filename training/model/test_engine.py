import math
import unittest
from engine import (football, totals, negative_binomial, count_sport, basketball,
                    service_game, tiebreak, tennis_set, tennis_match, devig,
                    recommendation_gate)


class Probabilities(unittest.TestCase):
    def test_football_normalization_symmetry_and_market_consistency(self):
        f = football(1.4,1.4,-0.08)
        self.assertAlmostEqual(sum(f['grid'].values()),1,places=12)
        m = f['markets']
        self.assertAlmostEqual(m['home'],m['away'],places=12)
        self.assertAlmostEqual(m['home']+m['draw']+m['away'],1)
        self.assertAlmostEqual(m['dnb_home_conditional'],0.5)
        self.assertAlmostEqual(m['dnb_push'],m['draw'])
        self.assertEqual(totals(f['grid'],2.5)['push'],0)
        self.assertGreater(totals(f['grid'],1.5)['over'],totals(f['grid'],2.5)['over'])
        self.assertAlmostEqual(sum(totals(f['grid'],2).values()),1)

    def test_dc_independent_oracle_and_tail(self):
        f=football(1.8,0.9)
        self.assertAlmostEqual(f['markets']['btts'],(1-math.exp(-1.8))*(1-math.exp(-0.9)),places=10)
        self.assertLess(f['truncated_mass'],3e-12)
        self.assertGreater(football(2.8,0.9)['markets']['home'],f['markets']['home'])
        with self.assertRaises(ValueError): football(2,2,0.5)
        with self.assertRaises(ValueError): football(-1,2)
        with self.assertRaises(ValueError): totals(f['grid'],2.25)

    def test_negative_binomial_moments_and_tie_scope(self):
        mean,r=4,3
        ps=negative_binomial(mean,r)
        observed=sum(i*p for i,p in enumerate(ps))
        variance=sum((i-mean)**2*p for i,p in enumerate(ps))
        self.assertAlmostEqual(observed,mean,places=8)
        self.assertAlmostEqual(variance,mean+mean**2/r,places=7)
        f=count_sport(2,2,5,5)
        self.assertAlmostEqual(sum(f['grid'].values()),1)
        self.assertAlmostEqual(f['markets']['home'],f['markets']['away'])
        self.assertGreater(f['markets']['draw'],0)
        self.assertEqual(f['scope'],'regulation_only')
        self.assertAlmostEqual(sum(totals(f['grid'],5).values()),1)
        with self.assertRaises(ValueError): negative_binomial(2,0)

    def test_normal_and_devig(self):
        b=basketball(0,10,200,20)
        self.assertEqual(b['home_win'],0.5)
        self.assertEqual(b['total_over'],0.5)
        self.assertGreater(basketball(5,10,210,20)['home_win'],b['home_win'])
        self.assertAlmostEqual(sum(devig([2,3,4])),1)
        self.assertEqual(devig([1.9,1.9]),[0.5,0.5])
        with self.assertRaises(ValueError): devig([1,2])
        with self.assertRaises(ValueError): basketball(0,0,200,20)

    def test_tennis_known_oracles_and_monotonicity(self):
        self.assertAlmostEqual(service_game(0.5),0.5)
        self.assertAlmostEqual(tiebreak(0.5,0.5),0.5)
        self.assertAlmostEqual(tennis_match(0.6,0.6)['a_win'],0.5)
        p=tennis_match(0.65,0.6)['a_win']
        self.assertGreater(p,0.5)
        self.assertGreater(tennis_match(0.7,0.6)['a_win'],p)
        self.assertGreater(tennis_match(0.65,0.6,5)['a_win'],p)
        with self.assertRaises(ValueError): tennis_match(0.6,0.6,1)
        with self.assertRaises(ValueError): tennis_match(1,0.6)

    def test_tennis_server_order_distribution(self):
        # Swapping players and first server must swap winners and next server.
        a=tennis_set(0.67,0.59,0)
        b=tennis_set(0.59,0.67,1)
        self.assertAlmostEqual(sum(a.values()),1)
        self.assertEqual(set(a),{(0,0),(0,1),(1,0),(1,1)})
        for (winner,server),p in a.items():
            self.assertAlmostEqual(p,b[(1-winner,1-server)],places=12)
        self.assertAlmostEqual(tiebreak(0.67,0.59,0),1-tiebreak(0.59,0.67,1))
        self.assertAlmostEqual(tennis_match(0.67,0.59,3,0)['a_win'],
                               1-tennis_match(0.59,0.67,3,1)['a_win'])

    def test_gate_defaults_and_uncertainty(self):
        self.assertFalse(recommendation_gate(0.8,1.5)['recommend'])
        flags=dict(validated=True,calibrated=True,data_complete=True)
        self.assertFalse(recommendation_gate(0.8,1.5,**flags)['recommend'])
        self.assertFalse(recommendation_gate(0.8,1.5,lower_probability=0.6,**flags)['recommend'])
        self.assertTrue(recommendation_gate(0.8,1.5,lower_probability=0.75,**flags)['recommend'])
        with self.assertRaises(ValueError): recommendation_gate(0.8,1.5,lower_probability=0.9)


if __name__ == '__main__':
    unittest.main()
