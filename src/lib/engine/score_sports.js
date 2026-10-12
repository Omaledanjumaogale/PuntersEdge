/**
 * Score-sport engine: ice hockey and baseball.
 *
 * Both are low-to-mid scoring head-to-head games where a regulation tie is
 * broken by extra play (hockey: overtime/shootout, baseball: extra innings).
 * Each team's score is modelled independently from its expected mean:
 *   hockey   Poisson (goals are close to Poisson)
 *   baseball negative binomial (runs are over-dispersed: variance ≈ 2× mean)
 * The regulation score grid is then resolved into final-result markets:
 * a tie becomes a one-goal/one-run win for the side that wins extra play,
 * which is how books settle moneyline, run/puck line and totals.
 */

import { poissonPmf, round, fairOdds } from './math.js';
import { fairProbabilities } from './vig_removal.js';
import { calculateKellyStake, gradeSelection } from './decision_screener.js';

/**
 * @typedef {Object} ScoreSportConfig
 * @property {'hockey' | 'baseball'} family
 * @property {'poisson' | 'negbin'} distribution
 * @property {number} dispersion negative-binomial r (ignored for Poisson)
 * @property {number} maxScore grid size per team
 * @property {number} extraHomeWin probability home wins extra play
 * @property {number[]} totalLines totals ladder
 * @property {number[]} teamLines team-total lines
 * @property {number[]} spreadLines home handicaps offered (both sides priced)
 * @property {string} unit 'goals' | 'runs'
 * @property {{ spread: string, total: string, team: string, extra: string }} labels
 */

/** @type {Record<'hockey' | 'baseball', ScoreSportConfig>} */
export const SCORE_SPORTS = {
  hockey: {
    family: 'hockey',
    distribution: 'poisson',
    dispersion: Infinity,
    maxScore: 12,
    extraHomeWin: 0.52,
    totalLines: [4.5, 5.5, 6.5, 7.5],
    teamLines: [2.5, 3.5],
    spreadLines: [-1.5, 1.5],
    unit: 'goals',
    labels: { spread: 'Puck line', total: 'Total goals', team: 'Team goals', extra: 'overtime or a shootout' }
  },
  baseball: {
    family: 'baseball',
    distribution: 'negbin',
    dispersion: 3.8,
    maxScore: 25,
    extraHomeWin: 0.52,
    totalLines: [6.5, 7.5, 8.5, 9.5, 10.5],
    teamLines: [3.5, 4.5],
    spreadLines: [-1.5, 1.5],
    unit: 'runs',
    labels: { spread: 'Run line', total: 'Total runs', team: 'Team runs', extra: 'extra innings' }
  }
};

/**
 * Negative binomial PMF with mean m and dispersion r (variance m + m²/r),
 * computed iteratively for stability.
 * @param {number} m
 * @param {number} r
 * @param {number} n max k
 */
function negbinPmf(m, r, n) {
  const p = r / (r + m);
  const out = new Array(n + 1);
  out[0] = Math.pow(p, r);
  for (let k = 1; k <= n; k++) out[k] = (out[k - 1] * (k - 1 + r) * (1 - p)) / k;
  return out;
}

/**
 * @param {number} mean
 * @param {ScoreSportConfig} cfg
 */
function scorePmf(mean, cfg) {
  const m = Math.max(0.05, mean);
  const raw =
    cfg.distribution === 'negbin'
      ? negbinPmf(m, cfg.dispersion, cfg.maxScore)
      : Array.from({ length: cfg.maxScore + 1 }, (_, k) => poissonPmf(k, m));
  const s = raw.reduce((a, b) => a + b, 0);
  return raw.map((x) => x / s);
}

/**
 * Full final-result distribution for a game.
 * @param {number} homeMean expected regulation score, home
 * @param {number} awayMean expected regulation score, away
 * @param {ScoreSportConfig} cfg
 */
export function scoreDistribution(homeMean, awayMean, cfg) {
  const hp = scorePmf(homeMean, cfg);
  const ap = scorePmf(awayMean, cfg);
  const N = cfg.maxScore;
  const w = cfg.extraHomeWin;

  /** @type {number[][]} */
  const matrix = [];
  let regHome = 0, regDraw = 0, regAway = 0;
  /** final margin (home − away) → probability */
  const margin = new Map();
  /** final total → probability */
  const total = new Map();
  const homeFinal = new Array(N + 2).fill(0);
  const awayFinal = new Array(N + 2).fill(0);
  const add = (/** @type {Map<number, number>} */ m, /** @type {number} */ k, /** @type {number} */ p) => m.set(k, (m.get(k) ?? 0) + p);

  for (let x = 0; x <= N; x++) {
    matrix[x] = [];
    for (let y = 0; y <= N; y++) {
      const p = hp[x] * ap[y];
      matrix[x][y] = p;
      if (x > y) regHome += p;
      else if (x < y) regAway += p;
      else regDraw += p;

      if (x !== y) {
        add(margin, x - y, p);
        add(total, x + y, p);
        homeFinal[x] += p;
        awayFinal[y] += p;
      } else {
        // Tie resolved by extra play: winner gets one more.
        add(margin, 1, p * w);
        add(margin, -1, p * (1 - w));
        add(total, x + y + 1, p);
        homeFinal[x + 1] += p * w;
        homeFinal[x] += p * (1 - w);
        awayFinal[y] += p * w;
        awayFinal[y + 1] += p * (1 - w);
      }
    }
  }

  const sumWhere = (/** @type {Map<number, number>} */ m, /** @type {(k: number) => boolean} */ f) => {
    let s = 0;
    for (const [k, p] of m) if (f(k)) s += p;
    return s;
  };

  /** P(home covers handicap L) on the final margin; half-lines never push. */
  const cover = (/** @type {number} */ L) => sumWhere(margin, (d) => d + L > 0);
  const over = (/** @type {number} */ L) => sumWhere(total, (t) => t > L);
  const teamOver = (/** @type {number[]} */ dist, /** @type {number} */ L) => dist.reduce((a, p, k) => (k > L ? a + p : a), 0);

  const scorelines = [];
  for (let x = 0; x <= Math.min(N, 12); x++) for (let y = 0; y <= Math.min(N, 12); y++) scorelines.push({ home: x, away: y, prob: matrix[x][y] });
  scorelines.sort((a, b) => b.prob - a.prob);

  return {
    matrix,
    homeMean,
    awayMean,
    regulation: { home: regHome, draw: regDraw, away: regAway },
    moneyline: { home: regHome + regDraw * w, away: regAway + regDraw * (1 - w) },
    cover,
    over,
    teamOver: { home: (/** @type {number} */ L) => teamOver(homeFinal, L), away: (/** @type {number} */ L) => teamOver(awayFinal, L) },
    topScorelines: scorelines.slice(0, 8)
  };
}

/**
 * Fit home/away means so the distribution reproduces a moneyline probability
 * and an over probability at a line. Used to read a bookmaker's own view.
 * @param {{ homeWin: number, over?: { line: number, prob: number } }} target
 * @param {ScoreSportConfig} cfg
 * @param {{ home: number, away: number }} start fallback means
 */
export function fitMeans(target, cfg, start) {
  const totalGuess = start.home + start.away;
  const loss = (/** @type {number} */ h, /** @type {number} */ a) => {
    const d = scoreDistribution(h, a, cfg);
    let e = (d.moneyline.home - target.homeWin) ** 2;
    if (target.over) e += (d.over(target.over.line) - target.over.prob) ** 2;
    else e += 0.02 * ((h + a - totalGuess) / totalGuess) ** 2;
    return e;
  };
  let best = { h: start.home, a: start.away, e: loss(start.home, start.away) };
  let step = Math.max(0.25, totalGuess * 0.08);
  while (step > 0.004) {
    let improved = false;
    for (const [dh, da] of [[step, 0], [-step, 0], [0, step], [0, -step], [step, -step], [-step, step]]) {
      const h = best.h + dh;
      const a = best.a + da;
      if (h < 0.1 || a < 0.1) continue;
      const e = loss(h, a);
      if (e < best.e) {
        best = { h, a, e };
        improved = true;
      }
    }
    if (!improved) step /= 2;
  }
  return { home: best.h, away: best.a, residual: best.e };
}

const fmtLine = (/** @type {number} */ l) => (l > 0 ? `+${l}` : `${l}`);
const bookPrice = (/** @type {number} */ p, /** @type {number} */ margin) => Math.max(1.01, round(1 / (p * (1 + margin)), 2));

/**
 * @typedef {Object} ScoreSportInput
 * @property {string} fixtureId
 * @property {string} homeTeam
 * @property {string} awayTeam
 * @property {string} league
 * @property {string} [kickoffTime]
 * @property {number} [kickoffOffsetHours]
 * @property {{ homeMean: number, awayMean: number, source?: string }} ratings
 * @property {Record<string, { homeMoneyline?: number, awayMoneyline?: number, totalLine?: number, overOdds?: number, underOdds?: number, spreadLine?: number, homeSpreadOdds?: number, awaySpreadOdds?: number }>} odds
 * @property {{ state: 'scheduled' | 'live' | 'finished', home?: number, away?: number, detail?: string }} [status]
 */

/**
 * Build a complete hockey or baseball prediction.
 * @param {ScoreSportInput} input
 * @param {'hockey' | 'baseball'} family
 * @param {{ modelWeight?: number, kellyFraction?: number, now?: Date | number, sport?: string }} [options]
 */
export function buildScoreSportPrediction(input, family, options = {}) {
  const cfg = SCORE_SPORTS[family];
  const w = options.modelWeight ?? 0.6;
  const kf = options.kellyFraction ?? 0.25;
  const H = input.homeTeam;
  const A = input.awayTeam;
  const matchTitle = `${H} vs ${A}`;
  const model = scoreDistribution(input.ratings.homeMean, input.ratings.awayMean, cfg);

  // Each book's own view, fitted from its quoted moneyline and main total.
  const books = Object.entries(input.odds ?? {})
    .filter(([, o]) => (o.homeMoneyline ?? 0) > 1 && (o.awayMoneyline ?? 0) > 1)
    .map(([book, o]) => {
      const [ph] = fairProbabilities([/** @type {number} */ (o.homeMoneyline), /** @type {number} */ (o.awayMoneyline)]);
      const hasTotal = (o.overOdds ?? 0) > 1 && (o.underOdds ?? 0) > 1 && typeof o.totalLine === 'number';
      const po = hasTotal ? fairProbabilities([/** @type {number} */ (o.overOdds), /** @type {number} */ (o.underOdds)])[0] : undefined;
      const fit = fitMeans(
        { homeWin: ph, over: hasTotal ? { line: /** @type {number} */ (o.totalLine), prob: /** @type {number} */ (po) } : undefined },
        cfg,
        { home: input.ratings.homeMean, away: input.ratings.awayMean }
      );
      const d = scoreDistribution(fit.home, fit.away, cfg);
      const mML = 1 / /** @type {number} */ (o.homeMoneyline) + 1 / /** @type {number} */ (o.awayMoneyline) - 1;
      const mTot = hasTotal ? 1 / /** @type {number} */ (o.overOdds) + 1 / /** @type {number} */ (o.underOdds) - 1 : mML;
      return { book, o, ph, po, hasTotal, d, mML, mTot };
    });

  /** Most common quoted main total and spread across books. */
  const mode = (/** @type {(number | undefined)[]} */ xs) => {
    const c = new Map();
    for (const x of xs) if (typeof x === 'number') c.set(x, (c.get(x) ?? 0) + 1);
    return [...c.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  };
  const projTotal = model.homeMean + model.awayMean;
  const mainTotal = mode(books.map((b) => b.o.totalLine)) ?? Math.round(projTotal - 0.5) + 0.5;

  const ctx = { fixtureId: input.fixtureId, sport: /** @type {any} */ (options.sport ?? family), matchTitle, league: input.league };

  /**
   * @param {string} key @param {string} market @param {string} label @param {number} modelP
   * @param {(b: typeof books[number]) => { odds: number, prob: number, quoted?: boolean } | null} quote
   * @param {'quoted' | 'derived'} pricing
   */
  const cand = (key, market, label, modelP, quote, pricing) => {
    /** @type {Record<string, { odds: number, prob: number, quoted?: boolean }>} */
    let quotes = {};
    for (const b of books) {
      const q = quote(b);
      if (q && q.odds > 1 && Number.isFinite(q.odds)) quotes[b.book] = { ...q, quoted: q.quoted ?? pricing === 'quoted' };
    }
    // When any book hangs this exact line, only real quotes compete for best price.
    const real = Object.entries(quotes).filter(([, q]) => q.quoted);
    if (real.length) quotes = Object.fromEntries(real);
    return { key, market, label, model: modelP, quotes, pricing: real.length ? /** @type {const} */ ('quoted') : /** @type {const} */ ('derived') };
  };

  /** @param {ReturnType<typeof cand>[]} cands */
  const price = (cands) =>
    cands.flatMap((c) => {
      const entries = Object.entries(c.quotes);
      if (entries.length === 0) return [];
      const marketProb = entries.reduce((a, [, q]) => a + q.prob, 0) / entries.length;
      const prob = w * c.model + (1 - w) * marketProb;
      const [bookmaker, best] = entries.reduce((a, b) => (b[1].odds > a[1].odds ? b : a));
      const edge = prob * best.odds - 1;
      const edgePercent = round(edge * 100, 2);
      if (edgePercent > 25) return [];
      return [{
        id: `${ctx.fixtureId}:${c.key}`,
        ...ctx,
        market: c.market,
        selection: c.label,
        bookmaker,
        bestOdds: best.odds,
        fairOdds: round(fairOdds(prob), 2),
        modelProb: prob,
        marketProb,
        pushProb: 0,
        edgePercent,
        kellyStakePercent: edge > 0 ? calculateKellyStake(prob, best.odds, kf).recommendedStakePct : 0,
        grade: /** @type {'A+' | 'A' | 'B' | 'C' | 'PASS'} */ (edge > 0 ? gradeSelection(edgePercent, Math.abs(prob - marketProb) * 100) : 'PASS'),
        pricing: c.pricing
      }];
    });

  const groups = [];
  groups.push({
    key: 'ml', title: 'Moneyline', emoji: '💵', blurb: `Who wins, ${cfg.labels.extra} included.`,
    selections: price([
      cand('homeMl', 'Moneyline', `${H} ML`, model.moneyline.home, (b) => ({ odds: /** @type {number} */ (b.o.homeMoneyline), prob: b.ph }), 'quoted'),
      cand('awayMl', 'Moneyline', `${A} ML`, model.moneyline.away, (b) => ({ odds: /** @type {number} */ (b.o.awayMoneyline), prob: 1 - b.ph }), 'quoted')
    ])
  });

  if (family === 'hockey') {
    const reg = model.regulation;
    groups.push({
      key: 'reg', title: 'Regulation result', emoji: '🏆', blurb: '60 minutes only; a tie is a draw.',
      selections: price([
        cand('regH', 'Regulation 1X2', `${H} in regulation`, reg.home, (b) => ({ odds: bookPrice(b.d.regulation.home, b.mML * 1.5), prob: b.d.regulation.home }), 'derived'),
        cand('regX', 'Regulation 1X2', 'Draw after 60 min', reg.draw, (b) => ({ odds: bookPrice(b.d.regulation.draw, b.mML * 1.5), prob: b.d.regulation.draw }), 'derived'),
        cand('regA', 'Regulation 1X2', `${A} in regulation`, reg.away, (b) => ({ odds: bookPrice(b.d.regulation.away, b.mML * 1.5), prob: b.d.regulation.away }), 'derived')
      ])
    });
  }

  const spreads = [];
  for (const L of cfg.spreadLines) {
    spreads.push(
      cand(`sph${L}`, cfg.labels.spread, `${H} ${fmtLine(L)}`, model.cover(L), (b) => {
        if (b.o.spreadLine === L && (b.o.homeSpreadOdds ?? 0) > 1 && (b.o.awaySpreadOdds ?? 0) > 1) {
          const [p] = fairProbabilities([/** @type {number} */ (b.o.homeSpreadOdds), /** @type {number} */ (b.o.awaySpreadOdds)]);
          return { odds: /** @type {number} */ (b.o.homeSpreadOdds), prob: p, quoted: true };
        }
        const p = b.d.cover(L);
        return { odds: bookPrice(p, b.mML), prob: p, quoted: false };
      }, books.some((b) => b.o.spreadLine === L) ? 'quoted' : 'derived'),
      cand(`spa${-L}`, cfg.labels.spread, `${A} ${fmtLine(-L)}`, 1 - model.cover(L), (b) => {
        if (b.o.spreadLine === L && (b.o.homeSpreadOdds ?? 0) > 1 && (b.o.awaySpreadOdds ?? 0) > 1) {
          const [, p] = fairProbabilities([/** @type {number} */ (b.o.homeSpreadOdds), /** @type {number} */ (b.o.awaySpreadOdds)]);
          return { odds: /** @type {number} */ (b.o.awaySpreadOdds), prob: p, quoted: true };
        }
        const p = 1 - b.d.cover(L);
        return { odds: bookPrice(p, b.mML), prob: p, quoted: false };
      }, books.some((b) => b.o.spreadLine === L) ? 'quoted' : 'derived')
    );
  }
  groups.push({ key: 'spread', title: cfg.labels.spread, emoji: '⚖️', blurb: `A ${cfg.unit === 'goals' ? 'goal' : 'run'} and a half head start or deficit.`, selections: price(spreads) });

  const totalLines = [...new Set([...cfg.totalLines, mainTotal])].sort((a, b) => a - b);
  const totals = [];
  for (const T of totalLines) {
    const isQuoted = (/** @type {typeof books[number]} */ b) => b.hasTotal && b.o.totalLine === T;
    totals.push(
      cand(`o${T}`, cfg.labels.total, `Over ${T} ${cfg.unit}`, model.over(T), (b) =>
        isQuoted(b) ? { odds: /** @type {number} */ (b.o.overOdds), prob: /** @type {number} */ (b.po), quoted: true } : { odds: bookPrice(b.d.over(T), b.mTot), prob: b.d.over(T), quoted: false }, books.some(isQuoted) ? 'quoted' : 'derived'),
      cand(`u${T}`, cfg.labels.total, `Under ${T} ${cfg.unit}`, 1 - model.over(T), (b) =>
        isQuoted(b) ? { odds: /** @type {number} */ (b.o.underOdds), prob: 1 - /** @type {number} */ (b.po), quoted: true } : { odds: bookPrice(1 - b.d.over(T), b.mTot), prob: 1 - b.d.over(T), quoted: false }, books.some(isQuoted) ? 'quoted' : 'derived')
    );
  }
  groups.push({ key: 'total', title: cfg.labels.total, emoji: '🎯', blurb: `${cfg.unit === 'goals' ? 'Goals' : 'Runs'} by both teams, ${cfg.labels.extra} included.`, selections: price(totals) });

  const team = [];
  for (const L of cfg.teamLines) {
    team.push(
      cand(`th${L}`, cfg.labels.team, `${H} over ${L}`, model.teamOver.home(L), (b) => ({ odds: bookPrice(b.d.teamOver.home(L), b.mTot), prob: b.d.teamOver.home(L) }), 'derived'),
      cand(`ta${L}`, cfg.labels.team, `${A} over ${L}`, model.teamOver.away(L), (b) => ({ odds: bookPrice(b.d.teamOver.away(L), b.mTot), prob: b.d.teamOver.away(L) }), 'derived')
    );
  }
  groups.push({ key: 'team', title: cfg.labels.team, emoji: family === 'hockey' ? '🥅' : '🧢', blurb: 'One team only.', selections: price(team) });

  const all = groups.flatMap((g) => g.selections);
  const valueBets = all.filter((s) => s.pricing === 'quoted').sort((a, b) => b.edgePercent - a.edgePercent);

  const consensusML = books.length ? books.reduce((a, b) => a + b.ph, 0) / books.length : model.moneyline.home;
  const overBooks = books.filter((b) => b.hasTotal && b.o.totalLine === mainTotal);
  const consensusOver = overBooks.length ? overBooks.reduce((a, b) => a + /** @type {number} */ (b.po), 0) / overBooks.length : model.over(mainTotal);
  const modelProbs = { homeWin: model.moneyline.home, awayWin: model.moneyline.away, overTotal: model.over(mainTotal), spreadCoverHome: model.cover(-1.5) };
  const marketProbs = { homeWin: consensusML, awayWin: 1 - consensusML, overTotal: consensusOver, spreadCoverHome: modelProbs.spreadCoverHome };
  const blend = (/** @type {number} */ m, /** @type {number} */ k) => w * m + (1 - w) * k;
  const probabilities = {
    homeWin: blend(modelProbs.homeWin, marketProbs.homeWin),
    awayWin: blend(modelProbs.awayWin, marketProbs.awayWin),
    overTotal: blend(modelProbs.overTotal, marketProbs.overTotal),
    underTotal: 1 - blend(modelProbs.overTotal, marketProbs.overTotal),
    spreadCoverHome: modelProbs.spreadCoverHome,
    draw: family === 'hockey' ? model.regulation.draw : 0
  };

  const kickoffTime =
    input.kickoffTime ??
    new Date(Math.round(((typeof options.now === 'number' ? options.now : options.now?.getTime() ?? Date.now()) + (input.kickoffOffsetHours ?? 24) * 3600_000) / 900_000) * 900_000).toISOString();

  const top = model.topScorelines[0];
  return {
    sport: /** @type {any} */ (options.sport ?? family),
    family,
    fixtureId: input.fixtureId,
    homeTeam: H,
    awayTeam: A,
    matchTitle,
    league: input.league,
    kickoffTime,
    status: input.status ?? { state: 'scheduled' },
    modelWeight: w,
    ratings: input.ratings,
    projectedScore: { home: round(model.homeMean, 2), away: round(model.awayMean, 2), total: round(projTotal, 2), spread: round(model.homeMean - model.awayMean, 2) },
    marketLines: { total: mainTotal, spread: -1.5 },
    matrix: model.matrix.slice(0, 7).map((r) => r.slice(0, 7)),
    topScorelines: model.topScorelines,
    probabilities,
    modelProbabilities: modelProbs,
    marketProbabilities: marketProbs,
    odds: input.odds ?? {},
    bookmakers: books.map((b) => b.book),
    margins: Object.fromEntries(books.map((b) => [b.book, round(b.mML * 100, 2)])),
    valueBets,
    bestValue: valueBets[0],
    markets: groups,
    movement: null,
    marketSteamAlert: false,
    absences: [],
    lineupAlert: input.ratings.source ? `Team strength from ${input.ratings.source}.` : 'Team strength from recent scoring.',
    summary: {
      scoreline: `${top.home}–${top.away}`,
      caption: `Most likely regulation score (expected ${round(model.homeMean, 1)}–${round(model.awayMean, 1)} ${cfg.unit})`,
      unit: cfg.unit
    }
  };
}
