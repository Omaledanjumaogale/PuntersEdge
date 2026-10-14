"""Fit/evaluate user-supplied real football results; requires scipy for fitting.

CSV required: fixture_id,league,home,away,kickoff,available_at,home_goals,
away_goals. available_at is when the FINAL result became available, not the
fixture announcement. Optional odds_snapshot_at must precede kickoff.
Timezone-aware ISO timestamps required. One league per fit. No invented data,
automatic tuning, or advertised accuracy. Latest holdout evaluates fixed
hyperparameters via expanding-window refits; validation/calibration must be
separate earlier windows chosen by the operator. No calibrator is fitted here.
"""
import csv
import math
from datetime import datetime, timezone, timedelta
try:
    from .engine import football
except ImportError:
    from engine import football


def timestamp(value):
    d = datetime.fromisoformat(value.replace('Z','+00:00'))
    if d.tzinfo is None: raise ValueError('timezone-aware timestamp required')
    return d.astimezone(timezone.utc)


def load_csv(path):
    required={'fixture_id','league','home','away','kickoff','available_at',
              'home_goals','away_goals'}
    rows=[]; seen=set()
    with open(path,encoding='utf-8-sig',newline='') as f:
        reader=csv.DictReader(f)
        if not required <= set(reader.fieldnames or []):
            raise ValueError('missing required CSV columns')
        for raw in reader:
            if not all(raw[k].strip() for k in required): raise ValueError('empty field')
            if raw['fixture_id'] in seen: raise ValueError('duplicate fixture ID')
            seen.add(raw['fixture_id'])
            row={k:raw[k] for k in ('fixture_id','league','home','away')}
            if row['home']==row['away']: raise ValueError('same team on both sides')
            for k in ('kickoff','available_at'): row[k]=timestamp(raw[k])
            if row['available_at']<=row['kickoff']:
                raise ValueError('final result availability must follow kickoff')
            for k in ('home_goals','away_goals'):
                row[k]=int(raw[k])
                if row[k]<0: raise ValueError('negative goals')
            if raw.get('odds_snapshot_at'):
                row['odds_snapshot_at']=timestamp(raw['odds_snapshot_at'])
                if row['odds_snapshot_at']>=row['kickoff']:
                    raise ValueError('post-kickoff odds leak into pre-match evaluation')
            rows.append(row)
    return sorted(rows,key=lambda x:x['kickoff'])


def fit(rows, cutoff, penalty=1.0, half_life_days=180.0):
    """Identified attack/defence effects sum to zero; fixed L2 regularization."""
    from scipy.optimize import minimize
    if cutoff.tzinfo is None: raise ValueError('aware cutoff required')
    if penalty<0 or not math.isfinite(penalty) or half_life_days<=0 or not math.isfinite(half_life_days):
        raise ValueError('invalid fixed hyperparameters')
    if not rows: raise ValueError('no training results')
    if any(r['kickoff']>=cutoff or r['available_at']>=cutoff for r in rows):
        raise ValueError('training data not strictly available before cutoff')
    if len({r['league'] for r in rows})!=1: raise ValueError('fit one league at a time')
    teams=sorted({r[k] for r in rows for k in ('home','away')})
    if len(teams)<2: raise ValueError('need at least two teams')
    n=len(teams); ids={t:i for i,t in enumerate(teams)}
    def unpack(v):
        attack=list(v[3:3+n-1]); attack.append(-sum(attack))
        defense=list(v[3+n-1:]); defense.append(-sum(defense))
        return attack,defense
    def rates(v,h,a):
        at,de=unpack(v)
        return math.exp(v[0]+v[1]+at[ids[h]]+de[ids[a]]), math.exp(v[0]+at[ids[a]]+de[ids[h]])
    def objective(v):
        at,de=unpack(v)
        loss=penalty*(sum(x*x for x in at)+sum(x*x for x in de)+v[1]**2+v[2]**2)
        try:
            for r in rows:
                lh,la=rates(v,r['home'],r['away'])
                # All low-score cells must remain positive, not only observed one.
                corr={(0,0):1-lh*la*v[2],(0,1):1+lh*v[2],
                      (1,0):1+la*v[2],(1,1):1-v[2]}
                if min(corr.values())<=0 or max(lh,la)>100: return 1e100
                h,a=r['home_goals'],r['away_goals']
                logp=h*math.log(lh)-lh-math.lgamma(h+1)+a*math.log(la)-la-math.lgamma(a+1)+math.log(corr.get((h,a),1))
                age=(cutoff-r['kickoff']).total_seconds()/86400
                loss-=math.exp(-math.log(2)*age/half_life_days)*logp
            return loss
        except (OverflowError,ValueError): return 1e100
    avg=sum(r['home_goals']+r['away_goals'] for r in rows)/(2*len(rows))
    initial=[math.log(max(avg,0.1)),0.1,0.0]+[0.0]*(2*(n-1))
    result=minimize(objective,initial,method='L-BFGS-B',
                    bounds=[(-4,3),(-2,2),(-0.5,0.5)]+[(-2,2)]*(2*(n-1)))
    if not result.success or not math.isfinite(result.fun) or result.fun>=1e99:
        raise ValueError('fit failed: '+str(result.message))
    at,de=unpack(result.x)
    return {'league':rows[0]['league'],'teams':teams,'attack':dict(zip(teams,at)),
            'defense':dict(zip(teams,de)),'intercept':float(result.x[0]),
            'home_advantage':float(result.x[1]),'rho':float(result.x[2]),
            'training_cutoff':cutoff,'training_count':len(rows),
            'penalty':penalty,'half_life_days':half_life_days}


def predict(model,home,away):
    if home not in model['attack'] or away not in model['attack']:
        raise ValueError('unseen team; no invented fallback')
    at,de=model['attack'],model['defense']
    lh=math.exp(model['intercept']+model['home_advantage']+at[home]+de[away])
    la=math.exp(model['intercept']+at[away]+de[home])
    return football(lh,la,model['rho'])


def walk_forward(rows, holdout_start, *, min_training=50, penalty=1.0,
                 half_life_days=180.0, horizon_minutes=60):
    """Refit only with results available before each fixture. No odds-based ROI."""
    if holdout_start.tzinfo is None: raise ValueError('aware holdout boundary required')
    if min_training<1: raise ValueError('invalid minimum sample')
    if not math.isfinite(horizon_minutes) or horizon_minutes<=0:
        raise ValueError('pre-kickoff horizon must be positive minutes')
    scored=[]; skipped=[]
    for r in sorted(rows,key=lambda x:x['kickoff']):
        if r['kickoff']<holdout_start: continue
        prediction_at=r['kickoff']-timedelta(minutes=horizon_minutes)
        if r.get('odds_snapshot_at') and r['odds_snapshot_at']>prediction_at:
            raise ValueError('odds snapshot occurs after prediction horizon')
        train=[x for x in rows if x['league']==r['league'] and
               x['kickoff']<prediction_at and x['available_at']<prediction_at]
        if len(train)<min_training:
            skipped.append((r['fixture_id'],'insufficient_training')); continue
        try:
            model=fit(train,prediction_at,penalty,half_life_days)
            m=predict(model,r['home'],r['away'])['markets']
        except ValueError as e:
            skipped.append((r['fixture_id'],str(e))); continue
        probs=[m[k] for k in ('home','draw','away')]
        actual=0 if r['home_goals']>r['away_goals'] else 1 if r['home_goals']==r['away_goals'] else 2
        scored.append({'fixture_id':r['fixture_id'],'probabilities':probs,
                       'actual':actual,'brier':sum((p-int(i==actual))**2 for i,p in enumerate(probs)),
                       'log_loss':-math.log(max(probs[actual],1e-15)),
                       'training_count':len(train),'prediction_at':prediction_at.isoformat()})
    return {'count':len(scored),'skipped':skipped,'predictions':scored,
            'brier':sum(x['brier'] for x in scored)/len(scored) if scored else None,
            'log_loss':sum(x['log_loss'] for x in scored)/len(scored) if scored else None,
            'warning':'unvalidated until compared to baselines and calibrated in separate earlier windows'}


def export_artifact(model, version='candidate-1'):
    """Unvalidated JS-compatible parameters, no tuple-key probability grid."""
    if not isinstance(version,str) or not version.strip(): raise ValueError('version is required')
    return {'version':version,'sport':'football','modelType':'dixon_coles',
            'trainedThrough':model['training_cutoff'].isoformat(),
            'league':model['league'],'intercept':model['intercept'],
            'homeAdvantage':model['home_advantage'],'rho':model['rho'],
            'teams':{k:{'attack':float(model['attack'][k]),
                        'defence':float(model['defense'][k])} for k in model['teams']},
            'trainingCount':model['training_count'],'validated':False,'calibrated':False,
            'penalty':model['penalty'],'halfLifeDays':model['half_life_days'],
            'inferenceRule':'trainedThrough must be strictly before predictionAt'}


def main(argv=None):
    import argparse
    import json
    parser=argparse.ArgumentParser(description=__doc__)
    sub=parser.add_subparsers(dest='command',required=True)
    for name in ('train','evaluate'):
        p=sub.add_parser(name)
        p.add_argument('--csv',required=True)
        p.add_argument('--output',required=True)
        p.add_argument('--league',required=True)
        p.add_argument('--penalty',type=float,default=1.0)
        p.add_argument('--half-life-days',type=float,default=180.0)
        if name=='train':
            p.add_argument('--cutoff',required=True)
            p.add_argument('--version',required=True)
        else:
            p.add_argument('--holdout-start',required=True)
            p.add_argument('--min-training',type=int,default=50)
            p.add_argument('--horizon-minutes',type=float,default=60)
    args=parser.parse_args(argv)
    try:
        rows=[r for r in load_csv(args.csv) if r['league']==args.league]
        if not rows: raise ValueError('requested league has no results')
        if args.command=='train':
            cutoff=timestamp(args.cutoff)
            eligible=[r for r in rows if r['kickoff']<cutoff and r['available_at']<cutoff]
            result=export_artifact(fit(eligible,cutoff,args.penalty,args.half_life_days),args.version)
        else:
            result=walk_forward(rows,timestamp(args.holdout_start),
                                min_training=args.min_training,penalty=args.penalty,
                                half_life_days=args.half_life_days,
                                horizon_minutes=args.horizon_minutes)
        with open(args.output,'w',encoding='utf-8') as f:
            json.dump(result,f,indent=2,allow_nan=False)
            f.write('\n')
    except (ValueError,OSError,ImportError) as e:
        parser.error(str(e))


if __name__=='__main__': main()
