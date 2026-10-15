import unittest
from unittest.mock import patch
from continuous import run
class ChronologicalTrainingTests(unittest.TestCase):
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
