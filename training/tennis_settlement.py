"""Explicit tennis settlement contract; unknown rules never become wins or losses."""
import math

def completed_set(a,b):
    return type(a) is int and type(b) is int and min(a,b)>=0 and ((max(a,b)==6 and min(a,b)<=4) or (max(a,b)==7 and min(a,b) in (5,6)))

def settle_tennis(result,market,side,line=None,*,best_of=3,retirement_policy=None):
    if best_of not in (3,5) or retirement_policy not in ('void_all','completed_markets_stand'):return 'pending'
    status=result.get('status')
    if status in ('cancelled','walkover'):return 'void'
    if status not in ('completed','retired'):return 'pending'
    sets=result.get('sets',[])
    first=sets[0] if sets else {}
    first_complete=completed_set(first.get('a'),first.get('b'))
    partial=status=='retired'
    if partial and (retirement_policy=='void_all' or not market.startswith('first_set_')):return 'void'
    if market.startswith('first_set_'):
        if not first_complete:return 'void' if partial else 'pending'
        selected=[first]
    else:
        if not sets or not all(completed_set(s.get('a'),s.get('b')) for s in sets):return 'pending'
        needed=best_of//2+1;wins_a=wins_b=0
        for i,s in enumerate(sets):
            wins_a+=int(s['a']>s['b']);wins_b+=int(s['b']>s['a'])
            if max(wins_a,wins_b)==needed and i<len(sets)-1:return 'pending'
        if max(wins_a,wins_b)!=needed or min(wins_a,wins_b)>=needed:return 'pending'
        selected=sets
    if market in ('match_winner','first_set_winner'):
        if side not in ('a','b'):return 'pending'
        a_wins=first['a']>first['b'] if market.startswith('first_set') else wins_a>wins_b
        return 'won' if a_wins==(side=='a') else 'lost'
    if market not in ('total_games','first_set_total_games','games_handicap','first_set_games_handicap') or not isinstance(line,(int,float)) or not math.isfinite(line) or abs(line*4-round(line*4))>1e-8:return 'pending'
    a=sum(s['a'] for s in selected);b=sum(s['b'] for s in selected)
    handicap='handicap' in market
    if side not in (('a','b') if handicap else ('over','under')):return 'pending'
    lines=[line] if abs(line*2-round(line*2))<1e-8 else [math.floor(line*2)/2,math.floor(line*2)/2+.5]
    outcomes=[]
    for part in lines:
        margin=(a-b if side=='a' else b-a)+part if handicap else (a+b-part)*(1 if side=='over' else -1)
        outcomes.append((margin>0)-(margin<0))
    avg=sum(outcomes)/len(outcomes)
    return {1:'won',.5:'half-won',0:'push',-.5:'half-lost',-1:'lost'}[avg]
