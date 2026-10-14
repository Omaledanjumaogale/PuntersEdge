"""Train scope-specific score models and evaluate fixture-dependent market lines.
No odds or ROI claims. Publication availability assumed kickoff + 48 hours.
"""
import json,math,re,copy,sys
from pathlib import Path
import numpy as np
from scipy.stats import poisson,nbinom,norm
from benchmark import fit,ROOT

def scopes(sport):
 return {'football':['full','first_half'],'nba':['full','first_half','first_quarter'],'basketball':['full','first_half','first_quarter'],'hockey':['full','first_period','regulation'],'baseball':['full','first_five','first_inning']}[sport]
def parse(sport,raw,scope):
 try:
  if sport=='football':
   if raw['fixture']['status']['short']!='FT':return None
   key='fulltime'if scope=='full'else'halftime';h,a=raw['score'][key]['home'],raw['score'][key]['away'];home,away=raw['teams']['home'],raw['teams']['away'];kick=raw['fixture']['timestamp']*1000;league='Premier League';fid=str(raw['fixture']['id'])
  elif sport=='nba':
   if raw['status']['short']!=3 or raw['league']!='standard':return None
   from datetime import datetime
   kick=datetime.fromisoformat(raw['date']['start'].replace('Z','+00:00')).timestamp()*1000;home,away=raw['teams']['home'],raw['teams']['visitors'];league='NBA';fid=str(raw['id']);s=raw['scores']
   if scope=='full':h,a=s['home']['points'],s['visitors']['points']
   else:
    n=2 if scope=='first_half'else 1;h=sum(float(x)for x in s['home']['linescore'][:n]);a=sum(float(x)for x in s['visitors']['linescore'][:n]);
    if len(s['home']['linescore'])<n or len(s['visitors']['linescore'])<n:return None
  else:
   if raw['status']['short'] not in ('FT','AOT','AP'):return None
   home,away=raw['teams']['home'],raw['teams']['away'];kick=raw['timestamp']*1000;league={'basketball':'EuroLeague','hockey':'NHL','baseball':'MLB'}[sport];fid=str(raw['id']);s=raw['scores']
   if sport=='hockey':
    if scope=='full':h,a=s['home'],s['away']
    else:
     periods=['first']if scope=='first_period'else['first','second','third'];pairs=[re.fullmatch(r'(\d+)\s*-\s*(\d+)',str(raw['periods'].get(p,'')))for p in periods]
     if not all(pairs):return None
     h=sum(int(p[1])for p in pairs);a=sum(int(p[2])for p in pairs)
   elif sport=='basketball':
    if scope=='full':h,a=s['home']['total'],s['away']['total']
    else:
     periods=['quarter_1','quarter_2']if scope=='first_half'else['quarter_1'];h=sum(s['home'][p]for p in periods);a=sum(s['away'][p]for p in periods)
   else:
    if scope=='full':h,a=s['home']['total'],s['away']['total']
    else:
     n=5 if scope=='first_five'else 1;h=sum(s['home']['innings'][str(i)]for i in range(1,n+1));a=sum(s['away']['innings'][str(i)]for i in range(1,n+1))
  if h is None or a is None or min(h,a)<0:return None
  if scope=='full'and sport in ('hockey','baseball')and h==a:return None
  return {'id':fid,'homeId':home['id'],'awayId':away['id'],'home':home['name'],'away':away['name'],'league':league,'kickoff':kick,'status':{'home':float(h),'away':float(a)}}
 except (KeyError,TypeError,ValueError):return None

def parameters(a,r):
 h=a['teams'].get(str(r['homeId']));w=a['teams'].get(str(r['awayId']));
 if not h or not w:return None
 home=a['intercept']+a['homeAdvantage']+h['attack']+w['defence'];away=a['intercept']+w['attack']+h['defence']
 if a['sport']not in ('nba','basketball'):home,away=math.exp(home),math.exp(away)
 return home,away
def distributions(a,h,w,scope):
 if a['sport'] in ('nba','basketball'):
  def rounded(mu,sd):
   lo=math.floor(mu-8*sd);hi=math.ceil(mu+8*sd);k=np.arange(lo,hi+1);p=norm.cdf(k+.5,mu,sd)-norm.cdf(k-.5,mu,sd);return k,p/p.sum()
  sd=a['teamSd'];return {'total':rounded(h+w,a['totalSd']),'margin':rounded(h-w,a['marginSd']),'home':rounded(h,sd),'away':rounded(w,sd)}
 n=max(30,math.ceil(max(h,w)+12*math.sqrt(max(h,w)+max(h,w)**2/a.get('scoreConfig',{}).get('dispersion',1e8))));k=np.arange(n+1);dis=a.get('scoreConfig',{}).get('dispersion',1e8)
 def pmf(m):return nbinom.pmf(k,dis,dis/(dis+m))if a['sport']=='baseball'else poisson.pmf(k,m)
 grid=np.outer(pmf(h),pmf(w))
 if scope=='full'and a['sport']in ('hockey','baseball'):np.fill_diagonal(grid,0)
 grid/=grid.sum();x,y=np.meshgrid(k,k,indexing='ij')
 def aggregate(v):
  lo=int(v.min());p=np.bincount((v-lo).ravel(),weights=grid.ravel());return np.arange(lo,lo+len(p)),p
 return {'total':aggregate(x+y),'margin':aggregate(x-y),'home':(k,grid.sum(axis=1)),'away':(k,grid.sum(axis=0)),'btts':float(grid[1:,1:].sum())}
def component_line(line):
 return [math.floor(line*2)/2,math.ceil(line*2)/2]if round(line*4)%2 else [line]
def settlement(value,line,kind,side):
 scores=[]
 for component in component_line(line):
  diff=value+component if kind=='margin' else value-component
  if side in ('under','away'):diff=-diff
  scores.append(1 if diff>1e-9 else -1 if diff< -1e-9 else 0)
 average=sum(scores)/len(scores);return {1:'win',.5:'half_win',0:'push',-.5:'half_loss',-1:'loss'}[average]
def outcomes(dist,line,kind,side):
 k,p=dist;states=['win','half_win','push','half_loss','loss'];vector=np.zeros(5)
 for value,mass in zip(k,p):vector[states.index(settlement(value,line,kind,side))]+=mass
 return vector
def add(groups,key,vector,actual):
 r=groups.setdefault(key,{'n':0,'wins':0,'halfWins':0,'pushes':0,'halfLosses':0,'losses':0,'brierTotal':0,'logLossTotal':0,'probabilityTotal':0,'highProbabilityN':0,'highProbabilityWins':0})
 states=['win','half_win','push','half_loss','loss'];index=states.index(actual);r['n']+=1;r[['wins','halfWins','pushes','halfLosses','losses'][index]]+=1;r['brierTotal']+=float(np.sum((vector-np.eye(5)[index])**2));r['logLossTotal']-=math.log(max(1e-12,vector[index]));r['probabilityTotal']+=float(vector[0]);
 if vector[0]>=.7:r['highProbabilityN']+=1;r['highProbabilityWins']+=int(actual=='win')
def main():
 ROOT.joinpath('market-reports').mkdir(exist_ok=True);ROOT.joinpath('period-artifacts').mkdir(exist_ok=True)
 summary=[]
 for target in sys.argv[1:]or['football','nba','basketball','hockey','baseball']:
  sport,_,only_scope=target.partition(':')
  raw=[]
  for path in ROOT.joinpath('private').glob(f'{sport}*provider.json'):raw+=json.loads(path.read_text()).get('response',[])
  for scope in ([only_scope]if only_scope else scopes(sport)):
   if scope not in scopes(sport):raise ValueError('Unsupported scope')
   mapped={r['id']:r for x in raw if(r:=parse(sport,x,scope))is not None};rows=sorted(mapped.values(),key=lambda r:r['kickoff'])
   if len(rows)<100:summary.append({'sport':sport,'scope':scope,'status':'insufficient_period_data','n':len(rows)});continue
   cut=rows[int(.6*len(rows))]['kickoff'];hold=rows[int(.8*len(rows))]['kickoff'];train=[r for r in rows if r['kickoff']+48*3600000<cut];test=[r for r in rows if r['kickoff']>=hold]
   a=fit(train,sport);a['scope']=scope;a['version']=f'{sport}-{scope}-candidate-2026-10';a['teamSd']=math.sqrt((a.get('marginSd',1)**2+a.get('totalSd',1)**2)/4);groups={};skipped=0
   for r in test:
    params=parameters(a,r)
    if params is None:skipped+=1;continue
    h,w=params;dist=distributions(a,h,w,scope)
    # Lines are anchored to this fixture's earlier-fitted expectation, not its result.
    total=math.floor(h+w)+.5;teamH=math.floor(h)+.5;teamA=math.floor(w)+.5
    scale=3 if sport in ('nba','basketball')else 1
    for kind,center in [('total',total),('home',teamH),('away',teamA)]:
     actual=r['status']['home']+r['status']['away']if kind=='total'else r['status'][kind]
     for offset in (-2,-1,0,1,2):
      line=max(.5,center+offset*scale)
      for side in ('over','under'):add(groups,f'{kind} {side} offset {offset*scale:+}',outcomes(dist[kind],line,kind,side),settlement(actual,line,kind,side))
    for line in ([-6.5,-3.5,0,3.5,6.5]if sport in ('nba','basketball')else[-2,-1.5,-1,-.75,-.5,-.25,0,.25,.5,.75,1,1.5,2]):
     actual=r['status']['home']-r['status']['away']
     for side in ('home','away'):add(groups,f'handicap {side} {(line if side=="home" else -line):+}',outcomes(dist['margin'],line,'margin',side),settlement(actual,line,'margin',side))
    if sport=='football':
     p=dist['btts'];y=r['status']['home']>0 and r['status']['away']>0
     add(groups,'BTTS yes',np.array([p,0,0,0,1-p]),'win'if y else'loss');add(groups,'BTTS no',np.array([1-p,0,0,0,p]),'loss'if y else'win')
   for g in groups.values():
    g['strikeRate']=g['wins']/g['n'];g['nonPushFullResultStrikeRate']=g['wins']/max(1,g['wins']+g['losses']);g['brier']=g.pop('brierTotal')/g['n'];g['logLoss']=g.pop('logLossTotal')/g['n'];g['meanOutrightWinProbability']=g.pop('probabilityTotal')/g['n'];g['highProbabilityStrikeRate']=g['highProbabilityWins']/g['highProbabilityN']if g['highProbabilityN']else None
   report={'sport':sport,'scope':scope,'train':len(train),'holdout':len(test),'skipped':skipped,'markets':groups,'approved':False,'availabilityAssumption':'kickoff+48h','linePolicy':'Fixture-specific predicted mean floor + 0.5; fixed offsets. Handicaps use fixed lines. No result-dependent selection.','limits':['No bookmaker period quotes or executable odds; no ROI or advantage claim','Five-state Brier for whole/quarter settlement, not directly comparable with binary Brier','Repeated markets within fixture are dependent','No learned lineup, injury, goalie or pitcher features','Raw distribution calibration only; no held-out calibration improvement claimed']}
   ROOT.joinpath('market-reports',f'{sport}-{scope}.json').write_text(json.dumps(report,indent=2));
   shadow=fit(rows,sport);shadow.update(scope=scope,version=a['version']);shadow['teamSd']=math.sqrt((shadow.get('marginSd',1)**2+shadow.get('totalSd',1)**2)/4)
   if scope!='full'and'scoreConfig'in shadow:shadow['scoreConfig']['finalScoreModel']=False
   ROOT.joinpath('period-artifacts',f'{sport}-{scope}.json').write_text(json.dumps(shadow,indent=2));summary.append({'sport':sport,'scope':scope,'train':len(train),'holdout':len(test),'skipped':skipped,'marketGroups':len(groups)});print(json.dumps(summary[-1]),flush=True)
 summary_path=ROOT.joinpath('market-reports','summary.json')
 previous=json.loads(summary_path.read_text())if summary_path.exists()else[]
 merged={(r['sport'],r['scope']):r for r in previous+summary}
 summary_path.write_text(json.dumps(list(merged.values()),indent=2))
if __name__=='__main__':main()
