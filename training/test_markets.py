import unittest,sys
from pathlib import Path
import numpy as np
sys.path.insert(0,str(Path(__file__).parent))
from market_benchmark import settlement,outcomes,parse
class MarketTests(unittest.TestCase):
 def test_quarter_handicap_and_total_components(self):
  self.assertEqual(settlement(0,-.25,'margin','home'),'half_loss')
  self.assertEqual(settlement(0,.25,'margin','home'),'half_win')
  self.assertEqual(settlement(2,2.25,'total','under'),'half_win')
  self.assertEqual(settlement(2,2,'total','under'),'push')
  self.assertEqual(settlement(0,-.25,'margin','away'),'half_win')
 def test_discrete_probability_partition(self):
  d=(np.array([-1,0,1]),np.array([.2,.5,.3]));p=outcomes(d,-.25,'margin','home')
  np.testing.assert_allclose(p,[.3,0,0,.5,.2]);self.assertAlmostEqual(float(p.sum()),1)
 def test_final_ties_are_excluded_but_period_ties_retained(self):
  r={'status':{'short':'FT'},'teams':{'home':{'id':1,'name':'H'},'away':{'id':2,'name':'A'}},'timestamp':1,'id':1,'scores':{'home':2,'away':2},'periods':{'first':'0-0'}}
  self.assertIsNone(parse('hockey',r,'full'))
  self.assertEqual(parse('hockey',r,'first_period')['status'],{'home':0.,'away':0.})
 def test_missing_period_scores_are_not_fabricated(self):
  self.assertIsNone(parse('nba',{'status':{'short':3},'league':'standard'},'first_half'))
if __name__=='__main__':unittest.main()
