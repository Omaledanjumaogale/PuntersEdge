import unittest
from tennis_shadow import valid_rows,fit,forecast,evaluate,RULES
from tennis_settlement import settle_tennis

LICENSE={'commercialUseApproved':True,'source':'Synthetic unit-test fixture only','name':'Test fixture'}
def row(i):
    start=1700000000000+i*86400000
    return {'id':str(i),'status':'completed','tour':'ATP','rules':RULES,'surface':'hard','bestOf':3,'startedAt':start,'completedAt':start+3600000,'availableAt':start+7200000,'playerA':'a','playerB':'b','winner':'a','serveA':{'won':64,'total':100},'serveB':{'won':60,'total':100}}
class TennisShadowTests(unittest.TestCase):
 def test_missing_data_cannot_become_a_live_model(self):
    r=evaluate({'rows':[]});self.assertEqual(r['artifacts'],[]);self.assertFalse(r['report']['liveEnabled']);self.assertEqual(r['report']['markets'],[])
 def test_rights_timing_and_duplicate_guards(self):
    with self.assertRaises(ValueError):valid_rows({'rows':[row(0)]})
    with self.assertRaises(ValueError):valid_rows({'license':LICENSE,'rows':[row(0),row(0)]})
    r=row(0);r['availableAt']=r['startedAt'];self.assertEqual(evaluate({'license':LICENSE,'rows':[r]})['report']['status'],'Dataset rejected')
 def test_fit_uses_only_available_history_and_abstains_on_unknown_players(self):
    rows=[row(i) for i in range(70)];cutoff=rows[-1]['startedAt']-60000
    fitted=fit(rows,cutoff,'hard');self.assertLess(fitted['trainedThrough'],cutoff);p=forecast(fitted,rows[-1],cutoff);self.assertGreater(p['match_winner'],.5);self.assertFalse(p['liveEligible']);self.assertIsNone(forecast(fitted,{**rows[-1],'playerA':'unseen'},cutoff));self.assertIsNone(forecast(fitted,rows[-1],fitted['trainedThrough']))
 def test_retirements_and_unsupported_rules_are_excluded(self):
    r=row(0);r['status']='retired';self.assertEqual(valid_rows({'license':LICENSE,'rows':[r]}),[])
 def test_settlement_winners_games_quarters_and_retirements(self):
    r={'status':'completed','sets':[{'a':6,'b':4},{'a':7,'b':6}]};kw={'retirement_policy':'void_all'}
    self.assertEqual(settle_tennis(r,'match_winner','a',**kw),'won');self.assertEqual(settle_tennis(r,'first_set_winner','b',**kw),'lost');self.assertEqual(settle_tennis(r,'total_games','over',23,**kw),'push');self.assertEqual(settle_tennis(r,'total_games','over',22.75,**kw),'half-won');self.assertEqual(settle_tennis(r,'games_handicap','a',-3,**kw),'push');self.assertEqual(settle_tennis(r,'match_winner','a'),'pending')
    r['status']='retired';self.assertEqual(settle_tennis(r,'match_winner','a',**kw),'void');self.assertEqual(settle_tennis(r,'first_set_winner','a',retirement_policy='completed_markets_stand'),'won')
if __name__=='__main__':unittest.main()

class CalibrationContractTests(unittest.TestCase):
 def test_calibration_fits_on_earlier_samples_without_touching_test_rows(self):
    from tennis_shadow import calibrator,metrics
    fit=calibrator([(.8,i%2) for i in range(120)])
    self.assertIsNotNone(fit);self.assertEqual(fit['n'],120);self.assertLess(metrics([(.8,i%2) for i in range(100)],fit)['brier'],.3)
 def test_tours_and_post_cutoff_results_do_not_cross_parameter_history(self):
    rows=[row(i) for i in range(70)];cutoff=rows[-1]['startedAt']-60000
    baseline=fit(rows,cutoff,'hard','ATP');intruder={**row(0),'id':'future','availableAt':cutoff+1,'serveA':{'won':99,'total':100}}
    other={**row(0),'id':'other-tour','tour':'WTA','serveA':{'won':99,'total':100}}
    self.assertEqual(fit(rows+[intruder,other],cutoff,'hard','ATP'),baseline)
