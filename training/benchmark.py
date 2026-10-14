"""Real provider-score benchmark. Does not establish historical executable odds or ROI.
Historical availability is reconstructed as kickoff+48h; report preserves this assumption.
Train/calibration/holdout are chronological. Hyperparameters are fixed, no holdout tuning.
"""
import json,math,hashlib
from pathlib import Path
from datetime import datetime,timezone,timedelta
import numpy as np
from scipy.optimize import minimize, minimize_scalar
from scipy.special import gammaln,ndtr
import sys
sys.path.insert(0,str(Path(__file__).parent/'model'))
from engine import football, count_sport

ROOT=Path(__file__).parent
def fit(rows,sport):
 teams=sorted({str(r[k]) for r in rows for k in ('homeId','awayId')}); ids={t:i for i,t in enumerate(teams)};n=len(teams)
 X=np.zeros((2*len(rows),2*n+2)); y=np.zeros(2*len(rows));weights=np.zeros(2*len(rows));cut=max(r['kickoff'] for r in rows)
 for i,r in enumerate(rows):
  h,a=ids[str(r['homeId'])],ids[str(r['awayId'])]
  X[2*i,[0,1,2+h,2+n+a]]=1;X[2*i+1,[0,2+a,2+n+h]]=1
  y[2*i:2*i+2]=[r['status']['home'],r['status']['away']]
  weights[2*i:2*i+2]=math.exp(-math.log(2)*(cut-r['kickoff'])/86400000/180)
 gaussian=sport in ('nba','basketball')
 def loss(v):
  eta=X@v;pen=3*np.sum(v[1:]**2)
  if gaussian:
   residual=eta-y;return np.sum(weights*residual**2)/2+pen,X.T@(weights*residual)+np.r_[0,6*v[1:]]
  rate=np.exp(np.clip(eta,-10,6));return np.sum(weights*(rate-y*eta))+pen,X.T@(weights*(rate-y))+np.r_[0,6*v[1:]]
 initial=np.zeros(X.shape[1]);initial[0]=np.mean(y) if gaussian else math.log(max(.1,np.mean(y)))
 result=minimize(loss,initial,jac=True,method='L-BFGS-B',options={'maxiter':1000})
 if not result.success:raise ValueError('fit failed: '+result.message)
 v=result.x;v[0]+=np.mean(v[2:2+n])+np.mean(v[2+n:]);v[2:2+n]-=np.mean(v[2:2+n]);v[2+n:]-=np.mean(v[2+n:])
 eta=X@v;means=eta if gaussian else np.exp(eta);residual=(y-means).reshape(-1,2)
 artifact={'sport':sport,'version':f'{sport}-score-candidate-2026-10','league':rows[0]['league'],'trainedThrough':datetime.fromtimestamp((cut+48*3600000)/1000,timezone.utc).isoformat(),'intercept':float(v[0]),'homeAdvantage':float(v[1]),'rho':0.0,'teams':{t:{'attack':float(v[2+ids[t]]),'defence':float(v[2+n+ids[t]])}for t in teams},'trainingCount':len(rows),'modelWeight':1,'validated':False,'calibrated':False}
 if gaussian:artifact.update(marginSd=float(np.std(residual[:,0]-residual[:,1],ddof=1)),totalSd=float(np.std(residual[:,0]+residual[:,1],ddof=1)))
 elif sport=='hockey':artifact['scoreConfig']={'distribution':'poisson','finalScoreModel':True}
 elif sport=='baseball':
  dispersion=max(.2,min(100,float(np.mean(means**2)/max(.01,np.mean((y-means)**2-means)))))
  artifact['scoreConfig']={'distribution':'negbin','dispersion':dispersion,'finalScoreModel':True}
 return artifact

def forecast(a,r):
 h=a['teams'].get(str(r['homeId']));w=a['teams'].get(str(r['awayId']));
 if not h or not w:return None
 home=a['intercept']+a['homeAdvantage']+h['attack']+w['defence'];away=a['intercept']+w['attack']+h['defence']
 if a['sport'] in ('nba','basketball'):p=float(ndtr((home-away)/a['marginSd']));return [p,1-p]
 home,away=math.exp(home),math.exp(away)
 if a['sport']=='football':m=football(home,away)['markets'];return [m['home'],m['draw'],m['away']]
 from scipy.stats import poisson,nbinom
 k=np.arange(80);dis=a.get('scoreConfig',{}).get('dispersion',1e8)
 def pmf(mean):return poisson.pmf(k,mean) if a['sport']=='hockey' else nbinom.pmf(k,dis,dis/(dis+mean))
 grid=np.outer(pmf(home),pmf(away));grid/=grid.sum();ph=float(np.tril(grid,-1).sum());pa=float(np.triu(grid,1).sum());tie=float(np.trace(grid))
 ph/=1-tie;pa/=1-tie
 return [ph,pa]

def actual(r,sport):
 h,a=r['status']['home'],r['status']['away'];return (0 if h>a else 1 if h==a else 2)if sport=='football' else (0 if h>a else 1)
def calibrated(p,t):
 v=np.array(p)**(1/t);return list(v/v.sum())
def metrics(rows):
 if not rows:return {'n':0,'strikeRate':None,'brier':None,'logLoss':None}
 return {'n':len(rows),'strikeRate':sum(np.argmax(r['p'])==r['actual'] for r in rows)/len(rows),'brier':float(np.mean([sum((p-int(i==r['actual']))**2 for i,p in enumerate(r['p'])) for r in rows])),'logLoss':float(np.mean([-math.log(max(1e-12,r['p'][r['actual']])) for r in rows]))}

def main():
 ROOT.joinpath('reports').mkdir(exist_ok=True);ROOT.joinpath('artifacts').mkdir(exist_ok=True)
 results=[]
 for sport in (sys.argv[1:] or ['football','nba','basketball','hockey','baseball']):
  unique={}
  for path in ROOT.joinpath('private').glob(f'{sport}*games.json'):
   for r in json.loads(path.read_text()):
    if r.get('homeId') is None or r.get('awayId') is None or not math.isfinite(r['kickoff']):continue
    if sport!='football'and r['status']['home']==r['status']['away']:continue
    unique[r['id']]=r
  rows=sorted(unique.values(),key=lambda r:r['kickoff'])
  if len(rows)<100:results.append({'sport':sport,'status':'insufficient_data','records':len(rows)});continue
  # Group same-day games; a conservative 48h availability rule excludes delayed results.
  b1=rows[int(len(rows)*.6)]['kickoff'];b2=rows[int(len(rows)*.8)]['kickoff']
  train=[r for r in rows if r['kickoff']+48*3600000<b1];validation=[r for r in rows if b1<=r['kickoff'] and r['kickoff']+48*3600000<b2];holdout=[r for r in rows if r['kickoff']>=b2]
  a=fit(train,sport)
  val=[{'p':p,'actual':actual(r,sport)}for r in validation if(p:=forecast(a,r))is not None]
  objective=lambda t:metrics([{'p':calibrated(r['p'],t),'actual':r['actual']}for r in val])['logLoss']
  t=float(minimize_scalar(objective,bounds=(.5,3),method='bounded').x)if len(val)>=30 else 1.
  a['calibration']={'type':'temperature','temperature':t,'trainedThrough':datetime.fromtimestamp((b2-1)/1000,timezone.utc).isoformat(),'market':'Match Result (1X2)' if sport=='football' else 'Moneyline'}
  prior=np.bincount([actual(r,sport)for r in train],minlength=3 if sport=='football'else 2)+1;prior=prior/prior.sum()
  raw=[];cal=[];baseline=[];predictions=[]
  for r in holdout:
   p=forecast(a,r)
   if p is None:continue
   y=actual(r,sport);c=calibrated(p,t);raw.append({'p':p,'actual':y});cal.append({'p':c,'actual':y});baseline.append({'p':list(prior),'actual':y});predictions.append({'fixtureId':r['id'],'kickoff':r['kickoff'],'probabilities':c,'actual':y})
  report={'sport':sport,'league':a['league'],'train':len(train),'calibration':len(val),'holdout':len(holdout),'skipped':len(holdout)-len(cal),'raw':metrics(raw),'calibrated':metrics(cal),'frequencyBaseline':metrics(baseline),'highProbability':metrics([r for r in cal if max(r['p'])>=.7]),'temperature':t,'availabilityAssumption':'kickoff + 48h; historical publication times unavailable','limitations':['No historical bookmaker quotes; no market-relative skill, executable ROI or CLV claim','Static chronological score-only model; injury/lineup/pitcher data absent','Fetched retrospectively; outcome correction history unavailable'],'predictions':predictions,'approved':False}
  # Refit all observed scores for future shadow forecasts; holdout remains reported on earlier parameters.
  shadow=fit(rows,sport);shadow['benchmark']= {k:v for k,v in report.items() if k!='predictions'}
  ROOT.joinpath('artifacts',sport+'.json').write_text(json.dumps(shadow,indent=2))
  ROOT.joinpath('reports',sport+'.json').write_text(json.dumps(report,indent=2));results.append({k:v for k,v in report.items()if k!='predictions'});print(json.dumps(results[-1]),flush=True)
 reports=[json.loads(p.read_text())for p in ROOT.joinpath('reports').glob('*.json')if p.name!='summary.json'];ROOT.joinpath('reports','summary.json').write_text(json.dumps([{k:v for k,v in r.items()if k!='predictions'}for r in reports],indent=2))
if __name__=='__main__':main()
