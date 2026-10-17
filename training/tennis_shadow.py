"""Offline tennis shadow evaluation. No provider requests and no live-market activation."""
import json, math, hashlib, sys
from pathlib import Path
from datetime import datetime, timezone
from model.engine import tennis_match, tennis_set

RULES='standard_singles_7_point_tiebreak_each_set'
def logit(p): return math.log(p/(1-p))
def sigmoid(x): return 1/(1+math.exp(-max(-30,min(30,x))))
def valid_rows(data):
    license=data.get('license',{})
    if license.get('commercialUseApproved') is not True or not license.get('source') or not license.get('name'):
        raise ValueError('An identified source and operator-approved commercial-use license are required')
    if not isinstance(data.get('rows'),list) or len(data['rows'])>5000: raise ValueError('Use at most 5000 match rows')
    rows=[]; seen=set()
    for r in data.get('rows',[]):
        if not isinstance(r,dict): raise ValueError('Each match must be an object')
        if not isinstance(r.get('id'),str) or not all(isinstance(r.get(k),str) for k in ('playerA','playerB')): raise ValueError('Stable string match and player identifiers are required')
        if r.get('id') in seen: raise ValueError('Duplicate match IDs')
        seen.add(r.get('id'))
        if r.get('status')!='completed': continue
        if r.get('rules')!=RULES or r.get('surface') not in ('hard','clay','grass') or r.get('tour') not in ('ATP','WTA') or r.get('bestOf') not in (3,5): continue
        if not all(isinstance(r.get(k),(int,float)) and math.isfinite(r[k]) for k in ('startedAt','completedAt','availableAt')) or not r['startedAt']<r['completedAt']<=r['availableAt']:
            raise ValueError('Result availability must follow the actual completed match time')
        if not r.get('id') or not r.get('playerA') or not r.get('playerB') or r['playerA']==r['playerB'] or r.get('winner') not in ('a','b'): raise ValueError('Invalid player identity or winner')
        if r.get('firstServer') not in (None,0,1): raise ValueError('Invalid first server')
        for k in ('serveA','serveB'):
            p=r.get(k,{})
            if not all(type(p.get(x)) is int for x in ('won','total')) or not 0<=p['won']<=p['total'] or p['total']<=0: raise ValueError('Invalid service point counts')
        if r.get('firstSetWinner') not in (None,'a','b'): raise ValueError('Invalid first set outcome')
        if r['playerA']>r['playerB']:
            r={**r,'playerA':r['playerB'],'playerB':r['playerA'],'serveA':r['serveB'],'serveB':r['serveA'],'winner':'b' if r['winner']=='a' else 'a','firstSetWinner':None if not r.get('firstSetWinner') else ('b' if r['firstSetWinner']=='a' else 'a'),'firstServer':None if r.get('firstServer') is None else 1-r['firstServer']}
        rows.append(r)
    return sorted(rows,key=lambda r:(r['startedAt'],r['id']))

def fit(rows,cutoff,surface,tour='ATP'):
    history=[r for r in rows if r['availableAt']<cutoff and r.get('tour','ATP')==tour]
    if len(history)<50: return None
    players={};won=total=0.
    for r in history:
        weight=2**(-(cutoff-r['availableAt'])/(180*86400000))*(1 if r['surface']==surface else .25)
        for side,other in [('A','B'),('B','A')]:
            stats=players.setdefault(r['player'+side],[0.,0.,0.,0.]);own,op=r['serve'+side],r['serve'+other]
            stats[0]+=weight*own['won'];stats[1]+=weight*own['total'];stats[2]+=weight*(op['total']-op['won']);stats[3]+=weight*op['total']
            won+=weight*own['won'];total+=weight*own['total']
    base=won/total
    if not .4<base<.85: return None
    return {'players':players,'base':base,'trainedThrough':max(r['availableAt'] for r in history),'trainingCount':len(history),'surface':surface,'tour':tour}

def forecast(artifact,fixture,predicted_at):
    if not artifact or not artifact['trainedThrough']<predicted_at<fixture['startedAt'] or fixture.get('rules')!=RULES or fixture.get('bestOf') not in (3,5): return None
    if artifact['surface']!=fixture['surface'] or artifact.get('tour','ATP')!=fixture.get('tour','ATP'): return None
    a,b=(artifact['players'].get(fixture[k]) for k in ('playerA','playerB'))
    if not a or not b or min(a[1],a[3],b[1],b[3])<300: return None
    base=artifact['base'];prior=80
    def point(own,opponent):
        serving=(own[0]+prior*base)/(own[1]+prior)
        allowed=(opponent[3]-opponent[2]+prior*base)/(opponent[3]+prior)
        return sigmoid(logit(serving)+logit(allowed)-logit(base))
    pa,pb=point(a,b),point(b,a);servers=[fixture['firstServer']] if fixture.get('firstServer') in (0,1) and isinstance(fixture.get('firstServerKnownAt'),(int,float)) and fixture['firstServerKnownAt']<predicted_at else [0,1]
    match=sum(tennis_match(pa,pb,fixture['bestOf'],s)['a_win'] for s in servers)/len(servers)
    first=sum(sum(p for (winner,_),p in tennis_set(pa,pb,s).items() if winner==0) for s in servers)/len(servers)
    return {'match_winner':match,'first_set_winner':first,'serveA':pa,'serveB':pb,'mode':'shadow','liveEligible':False}

def calibrator(rows):
    if len(rows)<100 or min(sum(y for _,y in rows),sum(1-y for _,y in rows))<20: return None
    a,b=0.,1.
    for _ in range(600):
        da=db=0.
        for p,y in rows:
            x=logit(max(1e-6,min(1-1e-6,p)));d=sigmoid(a+b*x)-y;da+=d;db+=d*x
        a-=.05*da/len(rows);b-=.05*(db/len(rows)+.01*(b-1))
    return {'intercept':a,'slope':b,'n':len(rows)}

def metrics(rows,cal=None):
    if not rows:return {'n':0,'brier':None,'logLoss':None,'accuracy':None}
    ps=[(sigmoid(cal['intercept']+cal['slope']*logit(max(1e-6,min(1-1e-6,p)))) if cal else p,y) for p,y in rows]
    return {'n':len(ps),'brier':sum((p-y)**2 for p,y in ps)/len(ps),'logLoss':-sum(y*math.log(max(1e-12,p))+(1-y)*math.log(max(1e-12,1-p)) for p,y in ps)/len(ps),'accuracy':sum((p>=.5)==bool(y) for p,y in ps)/len(ps)}

def evaluate(data):
    now=int(datetime.now(timezone.utc).timestamp()*1000)
    report={'at':now,'mode':'shadow','liveEnabled':False,'status':'Waiting for licensed point-stat history','rows':0,'markets':[],'reasons':[]}
    if not data.get('rows'):return {'report':report,'artifacts':[]}
    try:rows=valid_rows(data)
    except ValueError as e:report.update(status='Dataset rejected',reasons=[str(e)]);return {'report':report,'artifacts':[]}
    rows=[r for r in rows if r['availableAt']<=now]
    report['source']={k:str(data['license'].get(k,''))[:200] for k in ('source','name')}
    report['rows']=len(rows);split=int(len(rows)*.7)
    if len(rows)<250:report.update(status='Waiting for sufficient completed history',reasons=['At least 250 eligible completed matches are required']);return {'report':report,'artifacts':[]}
    boundary=rows[split]['startedAt'];past={tour+':'+market:[] for tour in ('ATP','WTA') for market in ('match_winner','first_set_winner')};test={k:[] for k in past}
    for r in rows:
        cutoff=r['startedAt']-60000;artifact=fit(rows,cutoff,r['surface'],r['tour']);p=forecast(artifact,r,cutoff)
        if p is None:continue
        if r['startedAt']<boundary and r['availableAt']>=boundary: continue
        group=past if r['startedAt']<boundary else test
        group[r['tour']+':match_winner'].append((p['match_winner'],int(r['winner']=='a')))
        if r.get('firstSetWinner'):group[r['tour']+':first_set_winner'].append((p['first_set_winner'],int(r['firstSetWinner']=='a')))
    artifacts=[]
    for market in past:
        cal=calibrator(past[market]);raw=metrics(test[market]);adjusted=metrics(test[market],cal) if cal else None
        base=sum(y for _,y in past[market])/len(past[market]) if past[market] else .5
        baseline=metrics([(base,y) for _,y in test[market]])
        enough=cal is not None and raw['n']>=100
        report['markets'].append({'market':market.split(':')[1],'tour':market.split(':')[0],'calibrationRows':len(past[market]),'raw':raw,'calibrated':adjusted,'frozenBaseRate':baseline,'evaluationSufficient':enough,'bettingApproved':False})
        if cal:artifacts.append({'market':market.split(':')[1],'tour':market.split(':')[0],'calibrator':cal,'calibrationCutoff':boundary-1})
    for tour in ('ATP','WTA'):
        for surface in ('hard','clay','grass'):
            art=fit(rows,now,surface,tour)
            if art:artifacts.append({'surface':surface,'tour':tour,'parameters':art,'mode':'shadow','liveEnabled':False})
    report.update(status='Shadow evaluation complete; live markets disabled',testStart=boundary,policy='Chronological point-stat fits, first 70% calibration only, final 30% evaluation; no profit claim; retirements and unsupported rules excluded')
    digest=hashlib.sha256(json.dumps(data,sort_keys=True).encode()).hexdigest()
    return {'report':report,'artifacts':artifacts,'fingerprint':digest,'provenance':data.get('license')}

if __name__=='__main__':
    data=json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'));result=evaluate(data);Path(sys.argv[2]).write_text(json.dumps(result,allow_nan=False),encoding='utf-8');print(json.dumps(result['report']))
