"""Deterministic diagnostics; intervals describe evidence, never future guarantees."""
import math
import random


def reliability(pairs, bins=10):
    groups = [[] for _ in range(bins)]
    for probability, outcome in pairs:
        if not math.isfinite(probability) or not 0 <= probability <= 1 or outcome not in (0, 1):
            raise ValueError('Expected finite binary forecasts and outcomes')
        groups[min(bins - 1, int(probability * bins))].append((probability, outcome))
    result = []
    for index, group in enumerate(groups):
        if not group:
            continue
        n = len(group)
        observed = sum(y for _, y in group) / n
        z = 1.959963984540054
        denominator = 1 + z*z/n
        centre = (observed + z*z/(2*n)) / denominator
        radius = z * math.sqrt(observed*(1-observed)/n + z*z/(4*n*n)) / denominator
        result.append({'from': index/bins, 'to': (index+1)/bins, 'n': n,
                       'meanForecast': sum(p for p, _ in group)/n, 'observedRate': observed,
                       'observedRate95': [max(0., centre-radius), min(1., centre+radius)]})
    return result


def paired_block_interval(differences, block_size=7, repeats=1000):
    """Resample consecutive fixture blocks, keeping correlated options together.

    Input is one mean loss difference per chronologically ordered fixture.
    Negative means candidate better. This is an approximate percentile interval,
    not a correction for repeatedly selecting challengers or all temporal dependence.
    """
    if any(not math.isfinite(x) for x in differences):
        raise ValueError('Non-finite paired loss difference')
    blocks = [differences[i:i+block_size] for i in range(0, len(differences), block_size)]
    result = {'nFixtures': len(differences), 'blocks': len(blocks), 'blockSize': block_size,
              'meanDifference': sum(differences)/len(differences) if differences else None,
              'interval95': None, 'sufficient': len(blocks) >= 8,
              'method': 'Fixed-seed consecutive-fixture block bootstrap; candidate minus incumbent loss'}
    if not result['sufficient']:
        return result
    generator = random.Random(20261017)
    means = []
    for _ in range(repeats):
        sample = [value for _ in blocks for value in generator.choice(blocks)]
        means.append(sum(sample)/len(sample))
    means.sort()
    result['interval95'] = [means[int(.025*repeats)], means[min(repeats-1, int(.975*repeats))]]
    return result


def selected_direction_diagnostics(rows, minimum=40):
    """Candidate-selected sides, with serving probabilities on the SAME fixtures.

    One row per fixture/family; these are score-model diagnostics, not priced ROI.
    Selection uses pre-result candidate win probability >= .55. Calibration here
    is a diagnostic only; no calibrator is fitted on this holdout.
    """
    pairs = [(p, y) for p, _, y in rows]
    serving = [(q, y) for _, q, y in rows]
    bins = reliability(pairs)
    reliability(serving)  # Validate the paired serving forecasts too.
    n = len(rows)
    score = lambda values: sum((p-y)**2 for p,y in values)/n if n else None
    loss = lambda values: -sum(math.log(max(1e-12,p if y else 1-p)) for p,y in values)/n if n else None
    candidate_brier, serving_brier = score(pairs), score(serving)
    candidate_loss, serving_loss = loss(pairs), loss(serving)
    return {'nFixtures': n, 'minimumFixtures': minimum, 'sufficient': n >= minimum,
            'meanForecast': sum(p for p,_ in pairs)/n if n else None,
            'observedWinRate': sum(y for _,y in pairs)/n if n else None,
            'candidateBrier': candidate_brier, 'incumbentBrier': serving_brier,
            'candidateLogLoss': candidate_loss, 'incumbentLogLoss': serving_loss,
            'calibrationError': sum(b['n']*abs(b['meanForecast']-b['observedRate']) for b in bins)/n if n else None,
            'reliability': bins,
            'nonRegressing': n < minimum or (candidate_brier <= serving_brier*1.02 and candidate_loss <= serving_loss*1.02),
            'basis': 'Pre-outcome candidate-selected >=55% outright win probability; same-line serving comparison. No prices or ROI.'}
