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
