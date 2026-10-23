"""Daily fixed-parameter refits. Temporal holdout comparisons never use post-cutoff results.
No provider API calls; no profit, accuracy guarantee or automatic betting approval.
"""
import json,sys,math,hashlib
from pathlib import Path
from datetime import datetime,timezone
import numpy as np
from benchmark import fit
from evaluation_diagnostics import paired_block_interval,selected_direction_diagnostics
from market_benchmark import parameters,distributions,outcomes,settlement

def stamp(t):return datetime.fromtimestamp(t/1000,timezone.utc).isoformat()
def key(r):return (r['sport'],r['league'],r.get('scope','full'))
def prepare(a,scope):
 a['scope']=scope
 if a['sport']in ('nba','basketball'):a['teamSd']=math.sqrt((a['marginSd']**2+a['totalSd']**2)/4)
 if a.get('scoreConfig'):a['scoreConfig']['finalScoreModel']=scope=='full'
 return a

def compare(candidate,incumbent,rows,scope):
 totals={'n':0,'candidateBrier':0.,'incumbentBrier':0.,'candidateLogLoss':0.,'incumbentLogLoss':0.,'candidateMae':0.,'incumbentMae':0.};counts=0
 states=['win','half_win','push','half_loss','loss'];markets={};paired=[];selected={f'{kind}:{side}':[] for kind in ('total','home','away')for side in ('over','under')}
 for r in rows:
  cm,im=parameters(candidate,r),parameters(incumbent,r)
  if cm is None or im is None:continue
  # Identical lines for both models, chosen from the incumbent before seeing outcomes.
  cd,idist=distributions(candidate,*cm,scope),distributions(incumbent,*im,scope)
  fixture_differences=[]
  values={'total':r['status']['home']+r['status']['away'],'home':r['status']['home'],'away':r['status']['away'],'margin':r['status']['home']-r['status']['away']}
  for kind,mean in [('total',sum(im)),('home',im[0]),('away',im[1]),('margin',im[0]-im[1])]:
   line=(math.floor(mean)+.5)if kind!='margin'else -(math.floor(mean)+.5)
   for side in (['home','away']if kind=='margin'else ['over','under']):
    actual=states.index(settlement(values[kind],line,kind,side));cp=outcomes(cd[kind],line,kind,side);ip=outcomes(idist[kind],line,kind,side)
    if kind!='margin' and float(cp[0])>=.55:selected[f'{kind}:{side}'].append((float(cp[0]),float(ip[0]),int(actual==0)))
    market=markets.setdefault(kind,{'nOptions':0,'candidateBrier':0.,'incumbentBrier':0.,'candidateLogLoss':0.,'incumbentLogLoss':0.});market['nOptions']+=1
    losses={}
    for prefix,probs in [('candidate',cp),('incumbent',ip)]:
     brier=sum((float(p)-int(j==actual))**2 for j,p in enumerate(probs));loss=-math.log(max(1e-12,float(probs[actual])))
     totals[prefix+'Brier']+=brier;totals[prefix+'LogLoss']+=loss
     market[prefix+'Brier']+=brier;market[prefix+'LogLoss']+=loss;losses[prefix]=brier
    fixture_differences.append(losses['candidate']-losses['incumbent'])
    counts+=1
  # Goal dependence changes also affect BTTS; totals-only gains cannot hide BTTS regressions.
  if isinstance(cd.get('btts'),(int,float)) and isinstance(idist.get('btts'),(int,float)):
   market=markets.setdefault('btts',{'nOptions':0,'candidateBrier':0.,'incumbentBrier':0.,'candidateLogLoss':0.,'incumbentLogLoss':0.})
   y=int(r['status']['home']>0 and r['status']['away']>0)
   for side in ('yes','no'):
    market['nOptions']+=1;losses={};actual=y if side=='yes' else 1-y
    for prefix,distribution in [('candidate',cd),('incumbent',idist)]:
     p=max(1e-12,min(1-1e-12,distribution['btts'] if side=='yes' else 1-distribution['btts']))
     brier=2*(p-actual)**2;logloss=-(actual*math.log(p)+(1-actual)*math.log(1-p))
     totals[prefix+'Brier']+=brier;totals[prefix+'LogLoss']+=logloss
     market[prefix+'Brier']+=brier;market[prefix+'LogLoss']+=logloss;losses[prefix]=brier
    fixture_differences.append(losses['candidate']-losses['incumbent']);counts+=1
  paired.append(sum(fixture_differences)/len(fixture_differences))
  totals['n']+=1
  for prefix,means in [('candidate',cm),('incumbent',im)]:totals[prefix+'Mae']+=(abs(means[0]-r['status']['home'])+abs(means[1]-r['status']['away']))/2
 if totals['n']:
  for k in ['candidateBrier','incumbentBrier','candidateLogLoss','incumbentLogLoss']:totals[k]/=counts
  for k in ['candidateMae','incumbentMae']:totals[k]/=totals['n']
 else:
  for k in list(totals):
   if k!='n':totals[k]=None
 for market in markets.values():
  for metric in ('candidateBrier','incumbentBrier','candidateLogLoss','incumbentLogLoss'):market[metric]/=market['nOptions']
 totals['selectedDirections']={name:selected_direction_diagnostics(values)for name,values in selected.items()}
 totals['selectedDirectionsNonRegressing']=all(m['nonRegressing']for m in totals['selectedDirections'].values())
 totals['markets']=markets;totals['pairedBrier']=paired_block_interval(paired)
 totals['allMarketFamiliesNonRegressing']=bool(markets) and all(m['candidateBrier']<=m['incumbentBrier']*1.02 and m['candidateLogLoss']<=m['incumbentLogLoss']*1.02 for m in markets.values())
 return totals

def qualifies_update(score,approved=False):
 return score['n']>=40 and score['newTrainingRows']>=20 and score['candidateCutoff']<score['testStart'] and score['incumbentCutoff']<score['testStart'] and score['candidateBrier']<score['incumbentBrier']*.99 and score['candidateLogLoss']<=score['incumbentLogLoss'] and score['candidateMae']<=score['incumbentMae']*1.02 and score.get('allMarketFamiliesNonRegressing',False) and score.get('selectedDirectionsNonRegressing',False) and score.get('pairedBrier',{}).get('sufficient',False) and score['pairedBrier']['interval95'][1]<0 and not approved

def run(data):
 reports=[];candidates=[];retained=[];seen=set();excluded=0
 for row in data.get('rows',[]):
  identity=(*key(row),str(row.get('id','')))
  times=[row.get('kickoff'),row.get('availableAt')]
  valid=bool(row.get('id')) and all(isinstance(t,(int,float)) and math.isfinite(t) for t in times) and row['kickoff']<row['availableAt']<=data['collectedAt']
  if not valid or identity in seen:excluded+=1;continue
  seen.add(identity);retained.append(row)
 for record in data.get('incumbents',[]):
  old=record['artifact'];sport,league,scope=old['sport'],old['league'],old.get('scope','full');rows=sorted([r for r in retained if key(r)==(sport,league,scope)],key=lambda r:r['kickoff'])
  summary={'sport':sport,'league':league,'scope':scope,'rows':len(rows),'status':'Waiting for sufficient results'};reports.append(summary)
  if len(rows)<200:continue
  incumbent_cutoff=datetime.fromisoformat(old['trainedThrough'].replace('Z','+00:00')).timestamp()*1000
  unseen=[i for i,r in enumerate(rows)if r['kickoff']>incumbent_cutoff]
  split=unseen[max(0,len(unseen)-max(40,math.ceil(len(unseen)*.3)))]if unseen else int(len(rows)*.7)
  test_start=rows[split]['kickoff'];train=[r for r in rows[:split]if r['availableAt']<test_start and r['kickoff']+48*3600000<test_start]
  if len(train)<100:continue
  try:
   fitted=prepare(fit(train,sport),scope);fitted['trainedThrough']=stamp(max(r['availableAt']for r in train));incumbent=prepare(dict(old),scope)
   test=[r for r in rows[split:]if r['kickoff']>incumbent_cutoff and r['availableAt']<=data['collectedAt']]
   score=compare(fitted,incumbent,test,scope);score.update(candidateCutoff=max(r['availableAt']for r in train),incumbentCutoff=incumbent_cutoff,testStart=test_start,newTrainingRows=sum(r['kickoff']>incumbent_cutoff for r in train))
   summary.update(evaluation=score,status='Refitted; waiting for unseen results'if score['n']<40 else'Refitted; serving model retained')
   eligible=qualifies_update(score,record.get('approved',False))
   if eligible:
    final=prepare(fit(rows,sport),scope);final['trainedThrough']=stamp(max(r['availableAt']for r in rows));identity=hashlib.sha256(json.dumps(rows,sort_keys=True).encode()).hexdigest()[:12];final['version']=f'{sport}-{scope}-continuous-{identity}';final['availabilityBasis']='Observed result times; historical seeds explicitly assume kickoff +48h';final['validated']=False;final['calibrated']=False
    candidates.append({'artifact':final,'evaluation':score,'incumbentVersion':old['version']});summary['status']='Qualified for unapproved serving update'
  except Exception as e:summary.update(status='Training failed; serving model retained',error=str(e)[:250])
 return {'report':{'status':'Evaluation complete','evaluatedAt':datetime.now(timezone.utc).isoformat(),'segments':reports,'qualifiedUpdates':len(candidates),'excludedUnavailableOrDuplicateRows':excluded,'policy':'Chronological split reserves latest30% of new results (at least40), 48h availability gap; >=40 unseen fixtures, >=20 new training results, >=1% Brier improvement, no log-loss regression, MAE within2%; each market family and candidate-selected total/team Over/Under cohort with >=40 fixtures Brier/log-loss within2%, paired fixture-block Brier interval upper bound below0; never automatic betting approval'},'candidates':candidates,'fingerprint':data['fingerprint']}
if __name__=='__main__':
 data=json.loads(Path(sys.argv[1]).read_text());result=run(data);Path(sys.argv[2]).write_text(json.dumps(result,allow_nan=False));print(json.dumps(result['report'],allow_nan=False))
