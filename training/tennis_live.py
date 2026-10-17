"""Publish bounded, auditable informational estimates from real discovered events.

Unknown surface means global Elo only, with its own frozen 2024 calibrator and
chronological evaluation. No bookmaker odds, service stats, or verified edge.
"""
import csv
import json
import heapq
import math
import re
import sys
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from tennis_results import Ratings, parse_row, DELAY
from tennis_shadow import calibrator, metrics, sigmoid, logit


def fit_global(folder):
    """Same historical delay convention as the results challenger; distinct model."""
    rows, seen = [], set()
    for path in sorted(folder.glob('valuebetennis-matchs-*.csv')):
        with path.open(encoding='utf-8-sig', newline='') as file:
            for raw in csv.DictReader(file, delimiter=';'):
                row = parse_row(raw)
                if row and row['id'] not in seen:
                    rows.append(row)
                    seen.add(row['id'])
    models = {(tour, market): Ratings() for tour in ('ATP', 'WTA') for market in ('match_winner', 'first_set_winner')}
    pairs = {key: {2024: [], 'test': []} for key in models}
    pending = []
    for i, row in enumerate(sorted(rows, key=lambda item: (item['start'], item['id']))):
        while pending and pending[0][0] < row['start']:
            _, _, prior = heapq.heappop(pending)
            for market in ('match_winner', 'first_set_winner'):
                models[(prior['tour'], market)].update(prior, market)
        for market in ('match_winner', 'first_set_winner'):
            key = (row['tour'], market)
            model = models[key]
            if min(model.counts[row['a']], model.counts[row['b']]) < 10:
                continue
            p = 1/(1+10**((model.global_ratings.get(row['b'], 1500)-model.global_ratings.get(row['a'], 1500))/400))
            if row['year'] == 2024:
                pairs[key][2024].append((p, row[market]))
            elif row['year'] >= 2025:
                pairs[key]['test'].append((p, row[market]))
        heapq.heappush(pending, (row['start']+DELAY, i, row))
    artifacts, segments = {}, []
    for (tour, market), model in models.items():
        data = pairs[(tour, market)]
        fitted = calibrator(data[2024])
        artifacts[tour+':'+market] = {'global': model.global_ratings, 'counts': dict(model.counts), 'calibrator': fitted,
                                    'trainedThroughAssumed': model.trained_through_assumed}
        segments.append({'tour': tour, 'market': market, 'calibrationRows': len(data[2024]),
                         'raw': metrics(data['test']), 'calibrated': metrics(data['test'], fitted) if fitted else None})
    report = {'model': 'Global Elo K=24, minimum 10 prior matches; independent frozen 2024 Platt calibrators',
              'split': '2021–2023 history; 2024 calibration; 2025 onward sequential delayed-label evaluation',
              'limitations': ['Seven-day label availability is assumed, not verified by the export.',
                             'No prospective ROI or bookmaker outperformance has been demonstrated.',
                             'Global ratings omit surface, injuries, current form details and match-format effects.'],
              'evaluatedAt': datetime.now(timezone.utc).isoformat(), 'eligibleHistoricalRows':len(rows),
              'historicalStart':datetime.fromtimestamp(min(r['start'] for r in rows), timezone.utc).isoformat() if rows else None,
              'historicalEnd':datetime.fromtimestamp(max(r['start'] for r in rows), timezone.utc).isoformat() if rows else None,
              'segments': segments, 'bettingApproved': False}
    return artifacts, report


def name_key(name):
    text = unicodedata.normalize('NFKD', name).encode('ascii', 'ignore').decode().lower()
    return ' '.join(sorted(re.findall(r'[a-z]+', text)))


def identities(folder):
    index = {}
    for path in sorted(folder.glob('valuebetennis-matchs-*.csv')):
        with path.open(encoding='utf-8-sig', newline='') as file:
            for row in csv.DictReader(file, delimiter=';'):
                tour = row.get('genre', '').upper()
                if tour not in ('ATP', 'WTA'):
                    continue
                try:
                    at = datetime.strptime(row['date'], '%Y-%m-%d %H:%M:%S').replace(tzinfo=timezone.utc).timestamp()
                except (KeyError, ValueError):
                    continue
                for side in ('1', '2'):
                    player, name = row.get('joueur'+side+'_id'), row.get('joueur'+side, '')
                    key = name_key(name)
                    if player and key:
                        bucket = index.setdefault((tour, key), {})
                        bucket[player] = max(bucket.get(player, 0), at)
    return index


def project(coverage, artifacts, index):
    at = coverage.get('at', 0)
    output = {'v': 1, 'at': at, 'mode': 'experimental_information', 'model': 'Global results Elo K=24; minimum 10 prior matches; frozen 2024 calibration',
              'bettingApproved': False, 'source': 'https://www.valuebetennis.com/donnees.htm',
              'license': 'https://creativecommons.org/licenses/by/4.0/', 'fixtures': [], 'withheld': {},
              'coverageErrors': coverage.get('errors', []), 'chargedCredits': coverage.get('chargedCredits', 0)}
    competitions = {row['key']: row['title'] for row in coverage.get('competitions', [])}
    def skip(reason):
        output['withheld'][reason] = output['withheld'].get(reason, 0) + 1
    for event in coverage.get('events', [])[:200]:
        key = event.get('sportKey', '')
        tour = 'ATP' if key.startswith('tennis_atp_') else 'WTA' if key.startswith('tennis_wta_') else None
        kickoff = event.get('startedAt', 0)
        if not tour or not at < kickoff <= at + 72*3600000:
            skip('Outside supported pre-match window')
            continue
        names = [event.get('playerA', ''), event.get('playerB', '')]
        mapped = [index.get((tour, name_key(name)), {}) for name in names]
        if any(len(found) != 1 for found in mapped) or any('/' in name or '&' in name for name in names):
            skip('Player identity unresolved or ambiguous')
            continue
        players = [next(iter(found)) for found in mapped]
        if players[0] == players[1] or any(not 0 <= at/1000-next(iter(found.values())) <= 365*86400 for found in mapped):
            skip('Player history missing or stale')
            continue
        markets = []
        # Canonical player ordering matches the retrospective model orientation.
        a, b = sorted(players)
        for market in ('match_winner', 'first_set_winner'):
            model = artifacts.get(tour+':'+market, {})
            ratings, counts = model.get('global', {}), model.get('counts', {})
            if min(counts.get(a, 0), counts.get(b, 0)) < 10 or any(not math.isfinite(ratings.get(p, float('nan'))) for p in (a, b)):
                continue
            trained = model.get('trainedThroughAssumed')
            fitted = model.get('calibrator')
            if not fitted or not isinstance(trained, (int, float)) or trained >= at/1000:
                continue
            p = 1 / (1 + 10 ** ((ratings[b]-ratings[a])/400))
            p = sigmoid(fitted['intercept']+fitted['slope']*logit(p))
            home = p if a == players[0] else 1-p
            options = [{'side': 'a', 'selection': names[0], 'modelProb': home}, {'side': 'b', 'selection': names[1], 'modelProb': 1-home}]
            markets.append({'key': market, 'title': 'Match winner' if market == 'match_winner' else 'First-set winner',
                            'options': sorted(options, key=lambda option: -option['modelProb'])})
        if not markets:
            skip('Insufficient pre-match fitted history')
            continue
        output['fixtures'].append({'id': 'tennis-oddsapi-'+event['id'], 'league': competitions.get(key, key), 'tour': tour,
                                   'playerA': names[0], 'playerB': names[1], 'kickoff': kickoff, 'publishedAt': at,
                                   'surface': 'Unverified; global ratings used', 'trainedThroughAssumed':max(artifacts[tour+':'+m['key']]['trainedThroughAssumed'] for m in markets)*1000, 'markets': markets})
    return output


if __name__ == '__main__':
    root = Path('training/private/valuebetennis')
    if len(sys.argv)>1 and sys.argv[1]=='train':
        artifacts, report = fit_global(root)
        (root/'global-ratings.json').write_text(json.dumps(artifacts, allow_nan=False), encoding='utf-8')
        Path('training/reports/tennis-global-information.json').write_text(json.dumps(report, indent=2, allow_nan=False), encoding='utf-8')
        print(json.dumps(report))
    else:
        coverage = json.loads(Path('training/private/tennis-coverage.json').read_text(encoding='utf-8'))
        snapshot = project(coverage, json.loads((root/'global-ratings.json').read_text(encoding='utf-8')), identities(root))
        snapshot['evaluation'] = json.loads(Path('training/reports/tennis-global-information.json').read_text(encoding='utf-8'))
        Path('training/private/tennis-live.json').write_text(json.dumps(snapshot, allow_nan=False), encoding='utf-8')
        print(json.dumps({'publishedInformationalFixtures': len(snapshot['fixtures']), 'withheld': snapshot['withheld'], 'bettingApproved': False}))
