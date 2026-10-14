"""Untrained probability primitives, not betting recommendations.

Football uses independent Poisson with Dixon-Coles low-score corrections;
counts use independent negative binomials. Basketball assumes independent normal
margin/total summaries with caller-estimated standard deviations. Tennis assumes
constant independent serve-point probabilities, advantage games, 7-point win-by-2
tiebreaks at 6-all in every set. No retirement, overtime, shootout, or special
tennis formats are modeled. Parameter estimation/calibration is external.
"""
import math
from functools import lru_cache


def positive(x, name):
    if not isinstance(x, (int, float)) or not math.isfinite(x) or x <= 0:
        raise ValueError(name + ' must be finite and positive')
    return x


def probability(p):
    if not isinstance(p, (int, float)) or not math.isfinite(p) or not 0 < p < 1:
        raise ValueError('point probabilities must be strictly between zero and one')
    return p


def devig(odds):
    if len(odds) < 2 or any(not math.isfinite(o) or o <= 1 for o in odds):
        raise ValueError('need complete mutually exclusive decimal odds above one')
    inv = [1 / o for o in odds]
    return [v / sum(inv) for v in inv]


def _poisson(rate, tol=1e-12):
    positive(rate, 'rate')
    if rate > 100:
        raise ValueError('Poisson rate exceeds supported numerical range')
    out = [math.exp(-rate)]
    while len(out) < 2 or sum(out) < 1 - tol:
        out.append(out[-1] * rate / len(out))
    return out


def _markets(grid):
    h = sum(p for (i, j), p in grid.items() if i > j)
    d = sum(p for (i, j), p in grid.items() if i == j)
    a = sum(p for (i, j), p in grid.items() if i < j)
    return {'home': h, 'draw': d, 'away': a,
            'home_or_draw': h + d, 'away_or_draw': a + d,
            'home_or_away': h + a,
            'btts': sum(p for (i, j), p in grid.items() if i and j),
            'dnb_home_conditional': h / (h + a),
            'dnb_away_conditional': a / (h + a), 'dnb_push': d}


def totals(grid, line):
    if not math.isfinite(line) or line < 0 or line * 2 != int(line * 2):
        raise ValueError('only nonnegative integer or half-integer lines supported')
    return {name: sum(p for (i, j), p in grid.items() if compare(i + j, line))
            for name, compare in [('over', lambda x, y: x > y),
                                  ('under', lambda x, y: x < y),
                                  ('push', lambda x, y: x == y)]}


def football(home_rate, away_rate, rho=0.0):
    hp, ap = _poisson(home_rate), _poisson(away_rate)
    if not math.isfinite(rho):
        raise ValueError('rho must be finite')
    corrections = {(0, 0): 1 - home_rate * away_rate * rho,
                   (0, 1): 1 + home_rate * rho,
                   (1, 0): 1 + away_rate * rho, (1, 1): 1 - rho}
    if min(corrections.values()) <= 0:
        raise ValueError('Dixon-Coles correction must remain positive')
    grid = {(i, j): x * y * corrections.get((i, j), 1)
            for i, x in enumerate(hp) for j, y in enumerate(ap)}
    z = sum(grid.values())
    grid = {k: v / z for k, v in grid.items()}
    return {'grid': grid, 'markets': _markets(grid), 'truncated_mass': max(0, 1-z)}


def negative_binomial(mean, dispersion, tol=1e-12):
    positive(mean, 'mean'); positive(dispersion, 'dispersion')
    if mean > 100 or not 0.1 <= dispersion <= 1000000:
        raise ValueError('count parameters exceed supported numerical range')
    r, q = dispersion, mean / (mean + dispersion)
    out = [(1-q)**r]
    mass = out[0]
    while len(out) < 2 or mass < 1 - tol:
        n = len(out)
        out.append(out[-1] * (n-1+r) / n * q)
        mass += out[-1]
        if n > 100000:
            raise ValueError('count tail failed to converge')
    return out


def count_sport(home_mean, away_mean, home_dispersion, away_dispersion,
                sport='hockey'):
    if sport not in ('hockey', 'baseball'):
        raise ValueError('supported count sports: hockey and baseball')
    hp = negative_binomial(home_mean, home_dispersion)
    ap = negative_binomial(away_mean, away_dispersion)
    z = sum(hp) * sum(ap)
    grid = {(i, j): x*y/z for i, x in enumerate(hp) for j, y in enumerate(ap)}
    return {'grid': grid, 'markets': _markets(grid), 'scope': 'regulation_only',
            'tie_is_not_final_game_winner': True, 'truncated_mass': max(0, 1-z)}


def basketball(mean_margin, sigma_margin, mean_total, sigma_total,
               spread=0, total_line=200):
    positive(sigma_margin, 'estimated sigma margin')
    positive(sigma_total, 'estimated sigma total')
    if any(not math.isfinite(v) for v in (mean_margin, mean_total, spread, total_line)):
        raise ValueError('normal parameters must be finite')
    cdf = lambda x: (1 + math.erf(x/math.sqrt(2))) / 2
    return {'home_win': cdf(mean_margin/sigma_margin),
            'home_cover': cdf((mean_margin + spread)/sigma_margin),
            'total_over': cdf((mean_total-total_line)/sigma_total),
            'integer_line_push_modeled': False,
            'limitation': 'continuous approximation; no discrete push or joint markets'}


def service_game(p):
    probability(p)
    q = 1-p
    return p**4*(1+4*q+10*q*q) + 20*p**3*q**3*p*p/(p*p+q*q)


def tiebreak(pa, pb, first_server=0):
    probability(pa); probability(pb)
    if first_server not in (0, 1):
        raise ValueError('server must be 0 or 1')
    def point(n):
        server = first_server if n == 0 or ((n+1)//2) % 2 == 0 else 1-first_server
        return pa if server == 0 else 1-pb
    @lru_cache(None)
    def win(a, b):
        if a >= 7 and a-b >= 2: return 1.0
        if b >= 7 and b-a >= 2: return 0.0
        if a == b and a >= 6:
            x, y = point(a+b), point(a+b+1)
            return x*y / (x*y + (1-x)*(1-y))
        p = point(a+b)
        return p*win(a+1, b)+(1-p)*win(a, b+1)
    return win(0, 0)


def tennis_set(pa, pb, first_server=0):
    probability(pa); probability(pb)
    if first_server not in (0, 1): raise ValueError('invalid first server')
    ga, gb = service_game(pa), service_game(pb)
    @lru_cache(None)
    def dist(a, b, server):
        if max(a,b) >= 6 and abs(a-b) >= 2:
            return {(int(b>a), server): 1.0}
        if a == b == 6:
            p = tiebreak(pa, pb, server)
            return {(0, 1-server): p, (1, 1-server): 1-p}
        p = ga if server == 0 else 1-gb
        out = {}
        for score, weight in [((a+1,b), p), ((a,b+1),1-p)]:
            for key, val in dist(*score, 1-server).items():
                out[key] = out.get(key,0)+weight*val
        return out
    return dist(0,0,first_server)


def tennis_match(pa, pb, best_of=3, first_server=0):
    if best_of not in (3,5): raise ValueError('only standard best-of-3/5 supported')
    sets = {s: tennis_set(pa,pb,s) for s in (0,1)}
    if first_server not in (0,1): raise ValueError('invalid first server')
    needed = best_of//2+1
    @lru_cache(None)
    def win(a,b,server):
        if a == needed: return 1.0
        if b == needed: return 0.0
        return sum(p*win(a+(winner==0),b+(winner==1),next_server)
                   for (winner,next_server),p in sets[server].items())
    return {'a_win': win(0,0,first_server), 'format': f'best_of_{best_of}_6_all_tiebreak'}


def recommendation_gate(p, odds=None, *, validated=False, data_complete=False,
                        calibrated=False, lower_probability=None, min_edge=0.02):
    """Operational gate is external to forecast probability; defaults abstain."""
    probability(p)
    if lower_probability is not None and not 0 <= lower_probability <= p:
        raise ValueError('lower probability bound must lie between zero and forecast')
    if not math.isfinite(min_edge) or min_edge < 0: raise ValueError('invalid edge')
    reasons = []
    if not validated: reasons.append('unvalidated_model')
    if not calibrated: reasons.append('uncalibrated_market')
    if not data_complete: reasons.append('incomplete_or_stale_data')
    if lower_probability is None: reasons.append('uncertainty_bound_missing')
    if odds is None: reasons.append('odds_missing')
    elif not math.isfinite(odds) or odds <= 1: raise ValueError('invalid decimal odds')
    elif lower_probability is not None and lower_probability*odds-1 < min_edge:
        reasons.append('insufficient_conservative_edge')
    return {'recommend': not reasons, 'reasons': reasons, 'probability': p}
