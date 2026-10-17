"""Research benchmark from the attributed UCI 2013 archive. Never a live artifact.
Tournament blocks separate training/calibration/test; no match-time claim is made.
"""
import csv,io,zipfile,json
from pathlib import Path
from tennis_shadow import fit,forecast,calibrator,metrics,RULES

def run(path):
    z=zipfile.ZipFile(path);blocks={'train':[],'calibration':[],'test':[]};skipped=0
    for name in z.namelist():
        if not name.endswith('.csv'):continue
        group='test' if name.startswith('USOpen') else 'calibration' if name.startswith('Wimbledon') else 'train'
        text=z.read(name).decode('utf-8-sig').replace('\r\r\n','\n');delimiter=';' if ';' in text.splitlines()[0] else ','
        for i,r in enumerate(csv.DictReader(io.StringIO(text),delimiter=delimiter)):
            try:
                get=lambda k:float(r.get(k,r.get(k.replace('FNL','FNL.'),'')))
                sa=get('FSW.1')+get('SSW.1');sb=get('FSW.2')+get('SSW.2');ta=sa+get('TPW.2')-sb;tb=sb+get('TPW.1')-sa
                if not(0<sa<ta and 0<sb<tb):raise ValueError()
                best=5 if '-men-' in name else 3
                if max(get('FNL1'),get('FNL2'))!=best//2+1:raise ValueError()
                a=r.get('Player1') or r.get('Player 1');b=r.get('Player2') or r.get('Player 2')
                if not a or not b:raise ValueError()
                firstA=get('ST1.1');firstB=get('ST1.2') if 'ST1.2' in r else None
                if firstB is not None and firstA==firstB:raise ValueError()
                blocks[group].append({'id':name+':'+str(i),'playerA':a,'playerB':b,'serveA':{'won':int(sa),'total':int(ta)},'serveB':{'won':int(sb),'total':int(tb)},'winner':'a' if get('Result')==1 else 'b','firstSetWinner':None if firstB is None else ('a' if firstA>firstB else 'b'),'rules':RULES,'bestOf':best,'tour':'ATP' if best==5 else 'WTA','surface':'grass' if name.startswith('Wimbledon') else 'clay' if name.startswith('French') else 'hard','sex':'men' if best==5 else 'women'})
            except (KeyError,ValueError,TypeError):skipped+=1
    segments=[]
    for sex in ('men','women'):
        # Artificial ordering tokens identify disjoint tournament blocks, not historical dates.
        train=[{**r,'availableAt':1} for r in blocks['train'] if r['sex']==sex]
        cal={k:[] for k in ('match_winner','first_set_winner')};test={k:[] for k in cal}
        for group,out in [('calibration',cal),('test',test)]:
            for r in blocks[group]:
                if r['sex']!=sex:continue
                art=fit(train,10,r['surface'],r['tour']);p=forecast(art,{**r,'startedAt':30},20)
                if p:
                    out['match_winner'].append((p['match_winner'],int(r['winner']=='a')))
                    if r['firstSetWinner'] is not None:out['first_set_winner'].append((p['first_set_winner'],int(r['firstSetWinner']=='a')))
        for market in cal:
            fitted=calibrator(cal[market]);segments.append({'sex':sex,'market':market,'trainingMatches':len(train),'calibrationMatches':len(cal[market]),'test':metrics(test[market]),'calibratedTest':metrics(test[market],fitted) if fitted else None,'calibrationFit':fitted})
    return {'mode':'research_only','liveEnabled':False,'source':{'name':'UCI Tennis Major Tournament Match Statistics','authors':'Shruti Jauhari, Aniket Morankar, Ernest Fokoue (2014)','doi':'10.24432/C54C7K','license':'CC BY 4.0','url':'https://archive.ics.uci.edu/dataset/300/tennis+major+tournament+match+statistics'},'split':'2013 Australian/French training, Wimbledon calibration, US Open test; tournament blocks, not timestamped pre-match validation','blocks':{k:len(v) for k,v in blocks.items()},'skipped':skipped,'segments':segments,'limitations':['2013 data cannot establish current player strength or live accuracy','Service-point totals reconstructed from serve points won and opponent total points won','Wimbledon total-points fields are blank; first-set column labels also contain duplicates in some files; calibration unavailable', 'Unknown precise match timestamps and event-specific final-set rules prevent production validation','No bookmaker prices, ROI or market-edge validation available']}
if __name__=='__main__':
    r=run('training/private/uci-tennis.zip');Path('training/reports/tennis-uci-research.json').write_text(json.dumps(r,allow_nan=False),encoding='utf-8');print(json.dumps(r))
