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
