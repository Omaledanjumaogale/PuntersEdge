"""Normalize existing licensed historical exports. No new provider requests."""
import json
from pathlib import Path
from market_benchmark import scopes,parse
root=Path(__file__).parent;unique={}
for sport in ['football','nba','basketball','hockey','baseball']:
 for path in (root/'private').glob(f'{sport}*provider.json'):
  for raw in json.loads(path.read_text()).get('response',[]):
   for scope in scopes(sport):
    r=parse(sport,raw,scope)
    if r:
     r.update(sport=sport,scope=scope,availableAt=r['kickoff']+48*3600000,availabilityBasis='Retrospective historical seed; availability assumed kickoff +48h')
     unique[(sport,r['league'],scope,r['id'])]=r
(root/'private'/'continuous-seed.json').write_text(json.dumps(list(unique.values())))
print(json.dumps({'normalizedHistoricalRows':len(unique)}))
