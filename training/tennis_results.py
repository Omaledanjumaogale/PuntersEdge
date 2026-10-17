"""Results-only tennis challenger. Source CSVs never masquerade as point statistics.

Publicly licensed downloads and retrospective, delayed-label evaluation; no live
activation and no claim that an export contains historical availability times.
"""
import csv
import hashlib
import heapq
import json
import math
import re
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen
from tennis_shadow import calibrator, metrics

SOURCE = 'https://www.valuebetennis.com/donnees.htm'
LICENSE = 'https://creativecommons.org/licenses/by/4.0/'
ATTRIBUTION = 'Valuebetennis, Résultats et cotes de tennis depuis 2021, ' + SOURCE
DELAY = 7 * 86400
CURRENT_YEAR = datetime.now(timezone.utc).year
SURFACES = {'dur': 'hard', 'dur intérieur': 'hard_indoor', 'terre battue': 'clay', 'gazon': 'grass'}


def download(folder, refresh_current=False):
    folder.mkdir(parents=True, exist_ok=True)
    files = []
    targets = [(f'valuebetennis-matchs-{year}.csv', f'https://www.valuebetennis.com/datasets/valuebetennis-matchs-{year}.csv') for year in range(2021, CURRENT_YEAR + 1)]
    targets += [('source-license.html', SOURCE), ('CC-BY-4.0.html', LICENSE)]
    for name, url in targets:
        path = folder / name
        if not path.exists() or (refresh_current and name == f'valuebetennis-matchs-{CURRENT_YEAR}.csv'):
            request = Request(url, headers={'User-Agent': 'PuntersEdge-DatasetResearch/1.0'})
            with urlopen(request, timeout=60) as response:
                data = response.read(25 * 1024 * 1024 + 1)
                if len(data) > 25 * 1024 * 1024:
                    raise ValueError('Dataset exceeds download bound')
            temporary = path.with_suffix(path.suffix + '.tmp')
            temporary.write_bytes(data)
            temporary.replace(path)
        data = path.read_bytes()
        files.append({'name': name, 'url': url, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
    manifest = {'at': datetime.now(timezone.utc).isoformat(), 'source': SOURCE, 'license': LICENSE, 'attribution': ATTRIBUTION, 'files': files}
    (folder / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    return manifest


def parse_row(raw):
    """Accept completed standard singles scorelines only; never invent formats."""
    a, b = raw.get('joueur1_id', ''), raw.get('joueur2_id', '')
    winner = raw.get('vainqueur_id', '')
    if not a or not b or a == b or winner not in (a, b) or raw.get('genre') not in ('atp', 'wta'):
        return None
    if raw.get('surface') not in SURFACES or not raw.get('match_id'):
        return None
    text = raw.get('score', '').strip()
    if not re.fullmatch(r'\d+-\d+(?:\(\d+\))?(?:\s+\d+-\d+(?:\(\d+\))?){1,4}', text):
        return None
    scores = [(int(x), int(y)) for x, y in re.findall(r'(\d+)-(\d+)', text)]
    if any(not ((max(x, y) == 6 and min(x, y) <= 4) or (max(x, y) == 7 and min(x, y) in (5, 6))) for x, y in scores):
        return None
    wins = [sum(x > y for x, y in scores), sum(y > x for x, y in scores)]
    needed = max(wins)
    if needed not in (2, 3) or wins[0] == wins[1] or (winner == a) != (wins[0] > wins[1]):
        return None
    running = [0, 0]
    for index, (x, y) in enumerate(scores):
        running[int(y > x)] += 1
        if max(running) == needed and index < len(scores) - 1:
            return None
    try:
        start = datetime.strptime(raw['date'], '%Y-%m-%d %H:%M:%S').replace(tzinfo=timezone.utc).timestamp()
    except (KeyError, ValueError):
        return None
    if not 1609459200 <= start <= datetime.now(timezone.utc).timestamp():
        return None
    def decimal(key):
        try:
            value = float(raw.get(key, '').replace(',', '.'))
            return value if math.isfinite(value) and 1 < value < 1000 else None
        except ValueError:
            return None
    opening = [decimal('cote1_ouverture'), decimal('cote2_ouverture')]
    first = a if scores[0][0] > scores[0][1] else b
    if a > b:
        a, b = b, a
        opening.reverse()
    book = None
    if all(opening):
        book = (1 / opening[0]) / (1 / opening[0] + 1 / opening[1])
    return {'id': raw['match_id'], 'start': start, 'year': datetime.fromtimestamp(start, timezone.utc).year,
            'a': a, 'b': b, 'tour': raw['genre'].upper(), 'surface': SURFACES[raw['surface']],
            'category': raw.get('categorie', ''), 'match_winner': int(winner == a),
            'first_set_winner': int(first == a), 'openingBenchmark': book}


class Ratings:
    def __init__(self):
        self.global_ratings = {}
        self.surface_ratings = {}
        self.counts = Counter()
        self.trained_through_assumed = None

    def probability(self, row):
        a, b, surface = row['a'], row['b'], row['surface']
        if min(self.counts[a], self.counts[b]) < 10:
            return None
        def rating(player):
            return .5 * self.global_ratings.get(player, 1500) + .5 * self.surface_ratings.get((player, surface), 1500)
        return 1 / (1 + 10 ** ((rating(b) - rating(a)) / 400))

    def update(self, row, target):
        for store, a, b in ((self.global_ratings, row['a'], row['b']),
                            (self.surface_ratings, (row['a'], row['surface']), (row['b'], row['surface']))):
            ra, rb = store.get(a, 1500), store.get(b, 1500)
            expectation = 1 / (1 + 10 ** ((rb - ra) / 400))
            change = 24 * (row[target] - expectation)
            store[a], store[b] = ra + change, rb - change
        self.counts[row['a']] += 1
        self.counts[row['b']] += 1
        self.trained_through_assumed = row['start'] + DELAY


def forecasts(rows):
    """Queue labels behind a stated seven-day assumption, not invented timestamps."""
    models = {(tour, target): Ratings() for tour in ('ATP', 'WTA') for target in ('match_winner', 'first_set_winner')}
    pending = []
    output = []
    for index, row in enumerate(sorted(rows, key=lambda r: (r['start'], r['id']))):
        while pending and pending[0][0] < row['start']:
            _, _, prior = heapq.heappop(pending)
            for target in ('match_winner', 'first_set_winner'):
                models[(prior['tour'], target)].update(prior, target)
        for target in ('match_winner', 'first_set_winner'):
            p = models[(row['tour'], target)].probability(row)
            if p is not None:
                output.append({**row, 'target': target, 'p': p, 'y': row[target]})
        heapq.heappush(pending, (row['start'] + DELAY, index, row))
    return output, models


def calibration_error(pairs, cal=None):
    from tennis_shadow import sigmoid, logit
    bins = [[] for _ in range(10)]
    for p, y in pairs:
        if cal:
            p = sigmoid(cal['intercept'] + cal['slope'] * logit(p))
        bins[min(9, int(p * 10))].append((p, y))
    return sum(abs(sum(p-y for p, y in group)) for group in bins) / len(pairs) if pairs else None


def train(folder):
    rows, seen, skipped = [], set(), 0
    raw_counts = {}
    for path in sorted(folder.glob('valuebetennis-matchs-*.csv')):
        count = 0
        with path.open(encoding='utf-8-sig', newline='') as file:
            reader = csv.DictReader(file, delimiter=';')
            if 'joueur1_id' not in (reader.fieldnames or []):
                raise ValueError('Unexpected CSV schema')
            for raw in reader:
                count += 1
                row = parse_row(raw)
                if row and row['id'] not in seen:
                    rows.append(row)
                    seen.add(row['id'])
                else:
                    skipped += 1
        raw_counts[path.name] = count
    predicted, models = forecasts(rows)
    segments = []
    calibrators = {}
    for tour in ('ATP', 'WTA'):
        for target in ('match_winner', 'first_set_winner'):
            calibration = [(r['p'], r['y']) for r in predicted if r['tour'] == tour and r['target'] == target and r['year'] == 2024]
            fitted = calibrator(calibration)
            calibrators[f'{tour}:{target}'] = fitted
            for year in range(2025, CURRENT_YEAR + 1):
                test = [r for r in predicted if r['tour'] == tour and r['target'] == target and r['year'] == year]
                pairs = [(r['p'], r['y']) for r in test]
                matched = [r for r in test if target == 'match_winner' and r['openingBenchmark'] is not None]
                segments.append({'tour': tour, 'market': target, 'year': year, 'calibrationRows': len(calibration),
                                 'raw': metrics(pairs), 'calibrated': metrics(pairs, fitted) if fitted else None,
                                 'calibrationError': calibration_error(pairs, fitted),
                                 'openingOddsBenchmark': metrics([(r['openingBenchmark'], r['y']) for r in matched]),
                                 'modelOnSameQuotedMatches': metrics([(r['p'], r['y']) for r in matched], fitted) if fitted else None,
                                 'bettingApproved': False})
    report = {'at': datetime.now(timezone.utc).isoformat(), 'mode': 'retrospective_shadow', 'liveEnabled': False,
              'source': SOURCE, 'license': LICENSE, 'attribution': ATTRIBUTION,
              'model': 'Results-only global/surface Elo, K=24, 50/50 surface blend, minimum 10 prior matches per player',
              'split': '2021–2023 initial history; 2024 calibration; 2025–2026 sequential out-of-sample evaluation',
              'rawFiles': raw_counts, 'eligibleRows': len(rows), 'excludedRows': skipped, 'segments': segments,
              'limitations': ['Results-only model; no fabricated service-point statistics.',
                  'Export lacks actual completion/publication and quote-observation times. A seven-day label delay is a retrospective assumption, not verified historical availability.',
                  'Opening odds are a retrospective comparison; no executable-price, ROI or profitability claim.',
                  'Unsupported, incomplete and retirement scorelines excluded. Event formats and cross-provider identity mapping remain unverified.',
                  'Public source advertises CC BY 4.0; retain attribution and source license snapshots. No third-party non-commercial point corpus is included.',
                  'Live activation requires prospective forecasts, fresh quotes, provider/rule acceptance and independent validation.']}
    artifacts = {f'{tour}:{target}': {'global': model.global_ratings,
                 'surface': {player + ':' + surface: rating for (player, surface), rating in model.surface_ratings.items()},
                 'counts': dict(model.counts), 'calibrator': calibrators[f'{tour}:{target}'],
                 'trainedThroughAssumed': model.trained_through_assumed,
                 'liveEnabled': False} for (tour, target), model in models.items()}
    return report, artifacts


if __name__ == '__main__':
    folder = Path('training/private/valuebetennis')
    if len(sys.argv) > 1 and sys.argv[1] == 'fetch':
        manifest = download(folder, refresh_current='--refresh-current' in sys.argv)
        print(json.dumps({'files': len(manifest['files']), 'bytes': sum(f['bytes'] for f in manifest['files'])}))
    elif len(sys.argv) > 1 and sys.argv[1] == 'train':
        report, artifacts = train(folder)
        Path('training/reports/tennis-results-research.json').write_text(json.dumps(report, indent=2, allow_nan=False), encoding='utf-8')
        (folder / 'fitted-ratings.json').write_text(json.dumps(artifacts, allow_nan=False), encoding='utf-8')
        print(json.dumps(report, allow_nan=False))
    else:
        raise SystemExit('Use fetch or train')
