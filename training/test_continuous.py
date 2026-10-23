import unittest
from unittest.mock import patch
from continuous import run
from continuous import compare
class ChronologicalTrainingTests(unittest.TestCase):
 def test_correlated_options_are_counted_as_fixtures_and_market_regressions_exposed(self):
  rows=[{'status':{'home':1,'away':1}} for _ in range(70)]
  def distribution(artifact,*args):return {kind:(artifact,kind)for kind in ('total','home','away','margin')}
  def probabilities(dist,line,kind,side):
   # Constant observed loss state; candidate improves totals but harms team totals.
   probability=.9 if dist[0]=='candidate' and kind=='total' else .2 if dist[0]=='candidate' and kind=='home' else .7
   return [1-probability,0,0,0,probability]
  with patch('continuous.parameters',return_value=(1.,1.)),patch('continuous.distributions',side_effect=distribution),patch('continuous.settlement',return_value='loss'),patch('continuous.outcomes',side_effect=probabilities):
   report=compare('candidate','incumbent',rows,'full')
  self.assertEqual(report['n'],70)
  self.assertEqual(report['pairedBrier']['nFixtures'],70)
  self.assertEqual(report['markets']['total']['nOptions'],140)
  self.assertLess(report['markets']['total']['candidateBrier'],report['markets']['total']['incumbentBrier'])
  self.assertGreater(report['markets']['home']['candidateBrier'],report['markets']['home']['incumbentBrier'])
  self.assertFalse(report['allMarketFamiliesNonRegressing'])
 def test_btts_regression_cannot_be_hidden_by_other_goal_markets(self):
  rows=[{'status':{'home':1,'away':1}} for _ in range(70)]
  def distribution(artifact,*args):return {**{kind:(artifact,kind)for kind in ('total','home','away','margin')},'btts':.1 if artifact=='candidate' else .8}
  with patch('continuous.parameters',return_value=(1.,1.)),patch('continuous.distributions',side_effect=distribution),patch('continuous.settlement',return_value='loss'),patch('continuous.outcomes',return_value=[.3,0,0,0,.7]):
   report=compare('candidate','incumbent',rows,'full')
  self.assertEqual(report['markets']['btts']['nOptions'],140)
  self.assertGreater(report['markets']['btts']['candidateBrier'],report['markets']['btts']['incumbentBrier'])
  self.assertFalse(report['allMarketFamiliesNonRegressing'])
 def test_duplicate_or_unavailable_results_cannot_inflate_training(self):
  base={'id':'one','sport':'football','league':'L','scope':'full','kickoff':1,'availableAt':2}
  old={'sport':'football','league':'L','scope':'full','trainedThrough':'1970-01-01T00:00:00Z'}
  data={'rows':[base]*250+[{**base,'id':'future','availableAt':999}], 'fingerprint':'f','collectedAt':10,'incumbents':[{'artifact':old}]}
  with patch('continuous.fit')as fit:
   result=run(data)
  fit.assert_not_called()
  self.assertEqual(result['report']['segments'][0]['rows'],1)
  self.assertEqual(result['report']['excludedUnavailableOrDuplicateRows'],250)
 def test_insufficient_results_cannot_promote(self):
  result=run({'rows':[],'fingerprint':'f','collectedAt':10,'incumbents':[{'artifact':{'sport':'football','league':'L','scope':'full','trainedThrough':'1970-01-01T00:00:00Z'}}]})
  self.assertEqual(result['candidates'],[]);self.assertEqual(result['report']['segments'][0]['status'],'Waiting for sufficient results')
 def test_observed_results_cannot_leak_before_their_availability(self):
  rows=[{'id':str(i),'sport':'football','league':'L','scope':'full','kickoff':i*86400000,'availableAt':10**14,'homeId':1,'awayId':2,'status':{'home':1,'away':0}}for i in range(250)]
  with patch('continuous.fit')as fit:
   result=run({'rows':rows,'fingerprint':'f','collectedAt':10**14+1,'incumbents':[{'artifact':{'sport':'football','league':'L','scope':'full','trainedThrough':'1970-01-01T00:00:00Z'}}]})
   fit.assert_not_called();self.assertEqual(result['candidates'],[])
 def test_completed_refit_without_unseen_holdout_does_not_promote(self):
  rows=[{'id':str(i),'sport':'football','league':'L','scope':'full','kickoff':(10000+i)*86400000,'availableAt':(10002+i)*86400000,'homeId':1,'awayId':2,'status':{'home':1,'away':0}}for i in range(250)]
  old={'sport':'football','league':'L','scope':'full','version':'old','trainedThrough':'2025-01-01T00:00:00Z'}
  with patch('continuous.fit',return_value=old.copy()),patch('continuous.compare',return_value={'n':0}):
   result=run({'rows':rows,'fingerprint':'f','collectedAt':10**14,'incumbents':[{'artifact':old}]})
   self.assertEqual(result['candidates'],[])
if __name__=='__main__':unittest.main()


class DirectionCohortTests(unittest.TestCase):
 def test_directions_use_only_candidate_selected_sides_and_do_not_double_fixture_counts(self):
  rows=[{'status':{'home':3,'away':2}}for _ in range(60)]
  def probs(dist,line,kind,side):return [.8,0,0,0,.2]if side=='over'else[.2,0,0,0,.8]
  with patch('continuous.parameters',return_value=(1.,1.)),patch('continuous.distributions',return_value={k:None for k in ('total','home','away','margin')}),patch('continuous.settlement',return_value='win'),patch('continuous.outcomes',side_effect=probs):
   r=compare('candidate','incumbent',rows,'full')
  self.assertEqual(r['selectedDirections']['total:over']['nFixtures'],60)
  self.assertEqual(r['selectedDirections']['total:under']['nFixtures'],0)
  self.assertEqual(r['selectedDirections']['home:over']['nFixtures'],60)
  self.assertTrue(r['selectedDirectionsNonRegressing'])


class DirectionPromotionTests(unittest.TestCase):
 def test_an_over_under_regression_blocks_even_an_aggregate_improvement(self):
  from continuous import qualifies_update
  score={'n':70,'newTrainingRows':25,'candidateCutoff':1,'incumbentCutoff':1,'testStart':2,'candidateBrier':.1,'incumbentBrier':.2,'candidateLogLoss':.3,'incumbentLogLoss':.4,'candidateMae':1,'incumbentMae':1,'allMarketFamiliesNonRegressing':True,'selectedDirectionsNonRegressing':False,'pairedBrier':{'sufficient':True,'interval95':[-.12,-.05]}}
  self.assertFalse(qualifies_update(score));score['selectedDirectionsNonRegressing']=True;self.assertTrue(qualifies_update(score));self.assertFalse(qualifies_update(score,True))
