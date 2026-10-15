"""Daily fixed-parameter refits. Temporal holdout comparisons never use post-cutoff results.
No provider API calls; no profit, accuracy guarantee or automatic betting approval.
"""
import json,sys,math,hashlib
from pathlib import Path
from datetime import datetime,timezone
import numpy as np
from benchmark import fit
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
 states=['win','half_win','push','half_loss','loss']
 for r in rows:
  cm,im=parameters(candidate,r),parameters(incumbent,r)
  if cm is None or im is None:continue
  # Identical lines for both models, chosen from the incumbent before seeing outcomes.
  cd,idist=distributions(candidate,*cm,scope),distributions(incumbent,*im,scope)
  values={'total':r['status']['home']+r['status']['away'],'home':r['status']['home'],'away':r['status']['away'],'margin':r['status']['home']-r['status']['away']}
  for kind,mean in [('total',sum(im)),('home',im[0]),('away',im[1]),('margin',im[0]-im[1])]:
   line=(math.floor(mean)+.5)if kind!='margin'else -(math.floor(mean)+.5)
   for side in (['home','away']if kind=='margin'else ['over','under']):
    actual=states.index(settlement(values[kind],line,kind,side));cp=outcomes(cd[kind],line,kind,side);ip=outcomes(idist[kind],line,kind,side)
    for prefix,probs in [('candidate',cp),('incumbent',ip)]:
     totals[prefix+'Brier']+=sum((float(p)-int(j==actual))**2 for j,p in enumerate(probs));totals[prefix+'LogLoss']+=-math.log(max(1e-12,float(probs[actual])))
    counts+=1
  totals['n']+=1
  for prefix,means in [('candidate',cm),('incumbent',im)]:totals[prefix+'Mae']+=(abs(means[0]-r['status']['home'])+abs(means[1]-r['status']['away']))/2
 if totals['n']:
  for k in ['candidateBrier','incumbentBrier','candidateLogLoss','incumbentLogLoss']:totals[k]/=counts
  for k in ['candidateMae','incumbentMae']:totals[k]/=totals['n']
 else:
  for k in list(totals):
   if k!='n':totals[k]=None
 return totals

def run(data):
 reports=[];candidates=[]
 for record in data.get('incumbents',[]):
  old=record['artifact'];sport,league,scope=old['sport'],old['league'],old.get('scope','full');rows=sorted([r for r in data['rows']if key(r)==(sport,league,scope)],key=lambda r:r['kickoff'])
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
   eligible=score['n']>=40 and score['newTrainingRows']>=20 and score['candidateCutoff']<test_start and incumbent_cutoff<test_start and score['candidateBrier']<score['incumbentBrier']*.99 and score['candidateLogLoss']<=score['incumbentLogLoss'] and score['candidateMae']<=score['incumbentMae']*1.02 and not record.get('approved')
   if eligible:
    final=prepare(fit(rows,sport),scope);final['trainedThrough']=stamp(max(r['availableAt']for r in rows));identity=hashlib.sha256(json.dumps(rows,sort_keys=True).encode()).hexdigest()[:12];final['version']=f'{sport}-{scope}-continuous-{identity}';final['availabilityBasis']='Observed result times; historical seeds explicitly assume kickoff +48h';final['validated']=False;final['calibrated']=False
    candidates.append({'artifact':final,'evaluation':score,'incumbentVersion':old['version']});summary['status']='Qualified for unapproved serving update'
  except Exception as e:summary.update(status='Training failed; serving model retained',error=str(e)[:250])
 return {'report':{'status':'Evaluation complete','evaluatedAt':datetime.now(timezone.utc).isoformat(),'segments':reports,'qualifiedUpdates':len(candidates),'policy':'Chronological split reserves latest30% of new results (at least40), 48h availability gap; >=40 unseen fixtures, >=20 new training results, >=1% Brier improvement, no log-loss regression, MAE within2%; never automatic betting approval'},'candidates':candidates,'fingerprint':data['fingerprint']}
if __name__=='__main__':
 data=json.loads(Path(sys.argv[1]).read_text());result=run(data);Path(sys.argv[2]).write_text(json.dumps(result,allow_nan=False));print(json.dumps(result['report'],allow_nan=False))
