/**
 * Market book: every market we can price for a fixture, at every bookmaker.
 *
 * Bookmakers quote a few headline markets (1X2, total 2.5, BTTS; moneyline,
 * main spread and total). Their other markets are derived from those, and
 * that is what we reproduce: for each book we invert its de-vigged headline
 * prices into the book's own implied model, price the ladder from it and
 * apply that book's margin. Quoted prices are always used as quoted; derived
 * prices are flagged so the UI can say so.
 *
 * Our side of every selection is the blended model probability, so edges on
 * derived markets are consistent with edges on the headline ones.
 */

import { generateScoreMatrix, fitGoalParametersFromProbabilities } from './football_model.js';
import { fairProbabilities } from './vig_removal.js';
import { calculateKellyStake, gradeSelection } from './decision_screener.js';
import { normalCdf, probit, round, fairOdds } from './math.js';

/** Ignore edges above this — almost always stale prices or data errors. */
const MAX_CREDIBLE_EDGE = 25;

/**
 * @typedef {Object} MarketSelection
 * @property {string} id
 * @property {string} fixtureId
 * @property {'football' | 'basketball'} sport
 * @property {string} matchTitle
 * @property {string} league
 * @property {string} market
 * @property {string} selection
 * @property {string} bookmaker
 * @property {number} bestOdds
 * @property {number} fairOdds
 * @property {number} modelProb   blended probability (conditional on no push for handicaps)
 * @property {number} marketProb  de-vigged consensus probability (same basis)
 * @property {number} pushProb    chance the stake is returned (whole-number handicaps)
 * @property {number} edgePercent expected profit per 100 staked, pushes included
 * @property {number} kellyStakePercent
 * @property {'A+' | 'A' | 'B' | 'C' | 'PASS'} grade
 * @property {'quoted' | 'derived'} pricing
 */

/**
 * @typedef {Object} MarketGroup
 * @property {string} key
 * @property {string} title
 * @property {string} emoji
 * @property {string} blurb
 * @property {MarketSelection[]} selections
 */

/** Price a probability with a bookmaker margin, rounded like a real price. */
const bookPrice = (/** @type {number} */ p, /** @type {number} */ margin) => Math.max(1.01, round(1 / (p * (1 + margin)), 2));

const fmtLine = (/** @type {number} */ l) => (l > 0 ? `+${l}` : l === 0 ? '0' : `${l}`);

/** Small memo so book-side fits are not repeated when only settings change. */
const fitCache = new Map();

/**
 * @typedef {{ key: string, market: string, label: string, model: number, push?: number,
 *             quotes: Record<string, { odds: number, prob: number, push?: number }>, pricing: 'quoted' | 'derived' }} Candidate
 */

/**
 * Turn candidates into priced selections.
 * @param {{ fixtureId: string, sport: 'football' | 'basketball', matchTitle: string, league: string }} ctx
 * @param {Candidate[]} candidates
 * @param {number} w model weight
 * @param {number} kellyFraction
 * @returns {MarketSelection[]}
 */
function price(ctx, candidates, w, kellyFraction) {
  /** @type {MarketSelection[]} */
  const out = [];
  for (const c of candidates) {
    const books = Object.entries(c.quotes);
    if (books.length === 0) continue;
    const marketProb = books.reduce((a, [, q]) => a + q.prob, 0) / books.length;
    const prob = w * c.model + (1 - w) * marketProb;
    const push = c.push ?? 0;
    const [bookmaker, best] = books.reduce((a, b) => (b[1].odds > a[1].odds ? b : a));
    // EV with pushes: the stake comes back on a push, so only (1 - push) of it is at risk.
    const edge = (1 - push) * (prob * best.odds - 1);
    const edgePercent = round(edge * 100, 2);
    if (edgePercent > MAX_CREDIBLE_EDGE) continue;
    const stake = calculateKellyStake(prob, best.odds, kellyFraction);
    out.push({
      id: `${ctx.fixtureId}:${c.key}`,
      ...ctx,
      market: c.market,
      selection: c.label,
      bookmaker,
      bestOdds: best.odds,
      fairOdds: round(fairOdds(prob), 2),
      modelProb: prob,
      marketProb,
      pushProb: push,
      edgePercent,
      kellyStakePercent: edge > 0 ? round(stake.recommendedStakePct * (1 - push), 2) : 0,
      grade: edge > 0 ? gradeSelection(edgePercent, Math.abs(prob - marketProb) * 100) : 'PASS',
      pricing: c.pricing
    });
  }
  return out;
}

// ─── Football ─────────────────────────────────────────────────────────────

/**
 * @param {import('./prediction_pipeline.js').FootballInput} input
 * @param {ReturnType<typeof generateScoreMatrix>['probabilities']} mp our model's probabilities
 * @param {number} rho
 * @param {{ modelWeight: number, kellyFraction: number }} opts
 * @returns {MarketGroup[]}
 */
export function buildFootballMarkets(input, mp, rho, opts) {
  const ctx = { fixtureId: input.fixtureId, sport: /** @type {const} */ ('football'), matchTitle: `${input.homeTeam} vs ${input.awayTeam}`, league: input.league };
  const H = input.homeTeam;
  const A = input.awayTeam;

  // Each book's implied world: fair 1X2, fair totals, fitted goal model, margins.
  const books = Object.entries(input.odds).map(([book, o]) => {
    const [ph, pd, pa] = fairProbabilities([o.home, o.draw, o.away]);
    const [po] = fairProbabilities([o.over25, o.under25]);
    const key = `${input.fixtureId}:${book}:${o.home}:${o.draw}:${o.away}:${o.over25}:${o.under25}`;
    let fit = fitCache.get(key);
    if (!fit) {
      fit = fitGoalParametersFromProbabilities({ home: ph, away: pa, over2_5: po }, rho);
      fitCache.set(key, fit);
    }
    const m = generateScoreMatrix(fit.lambdaHome, fit.muAway, rho, 10).probabilities;
    const m3 = 1 / o.home + 1 / o.draw + 1 / o.away - 1;
    const m2 = 1 / o.over25 + 1 / o.under25 - 1;
    return { book, o, ph, pd, pa, m, m3, m2 };
  });

  /**
   * @param {string} key @param {string} market @param {string} label @param {number} model
   * @param {(b: typeof books[number]) => { odds: number, prob: number, push?: number } | null} quote
   * @param {'quoted' | 'derived'} pricing @param {number} [push]
   * @returns {Candidate}
   */
  const cand = (key, market, label, model, quote, pricing, push) => {
    /** @type {Candidate['quotes']} */
    const quotes = {};
    for (const b of books) {
      const q = quote(b);
      if (q && q.odds > 1) quotes[b.book] = q;
    }
    return { key, market, label, model, quotes, pricing, push };
  };

  const { oneXTwo: x, overUnder: ou, btts, asianHandicap: ah, teamTotals: tt, cleanSheet: cs } = mp;

  /** @type {Array<[Omit<MarketGroup, 'selections'>, Candidate[]]>} */
  const groups = [];

  groups.push([
    { key: '1x2', title: 'Match result', emoji: '🏆', blurb: 'Who wins after 90 minutes.' },
    [
      cand('home', 'Match Result (1X2)', `${H} Win`, x.home, (b) => ({ odds: b.o.home, prob: b.ph }), 'quoted'),
      cand('draw', 'Match Result (1X2)', 'Draw', x.draw, (b) => ({ odds: b.o.draw, prob: b.pd }), 'quoted'),
      cand('away', 'Match Result (1X2)', `${A} Win`, x.away, (b) => ({ odds: b.o.away, prob: b.pa }), 'quoted')
    ]
  ]);

  groups.push([
    { key: 'dc', title: 'Double chance', emoji: '🛡️', blurb: 'Covers two of the three results. Safer, shorter prices.' },
    [
      cand('dc1x', 'Double Chance', `${H} or Draw (1X)`, x.home + x.draw, (b) => ({ odds: bookPrice(b.ph + b.pd, b.m3), prob: b.ph + b.pd }), 'derived'),
      cand('dc12', 'Double Chance', `${H} or ${A} (12)`, x.home + x.away, (b) => ({ odds: bookPrice(b.ph + b.pa, b.m3), prob: b.ph + b.pa }), 'derived'),
      cand('dcx2', 'Double Chance', `Draw or ${A} (X2)`, x.draw + x.away, (b) => ({ odds: bookPrice(b.pd + b.pa, b.m3), prob: b.pd + b.pa }), 'derived')
    ]
  ]);

  groups.push([
    { key: 'dnb', title: 'Draw no bet', emoji: '🤝', blurb: 'Stake returned if it’s a draw.' },
    [
      cand('dnbh', 'Draw No Bet', `${H} (DNB)`, x.home / (x.home + x.away), (b) => {
        const p = b.ph / (b.ph + b.pa);
        return { odds: bookPrice(p, b.m3), prob: p };
      }, 'derived', x.draw),
      cand('dnba', 'Draw No Bet', `${A} (DNB)`, x.away / (x.home + x.away), (b) => {
        const p = b.pa / (b.ph + b.pa);
        return { odds: bookPrice(p, b.m3), prob: p };
      }, 'derived', x.draw)
    ]
  ]);

  /** Asian handicap: our probabilities are conditional on no push. */
  const ahCands = [];
  for (const line of [-1.5, -1, -0.5, 0.5, 1, 1.5]) {
    const ours = ah[line];
    const home = ours.win / (ours.win + ours.lose);
    ahCands.push(
      cand(`ahh${line}`, 'Asian Handicap', `${H} ${fmtLine(line)}`, home, (b) => {
        const t = b.m.asianHandicap[line];
        const p = t.win / (t.win + t.lose);
        return { odds: bookPrice(p, b.m2), prob: p };
      }, 'derived', ours.push),
      cand(`aha${-line}`, 'Asian Handicap', `${A} ${fmtLine(-line)}`, 1 - home, (b) => {
        const t = b.m.asianHandicap[line];
        const p = t.lose / (t.win + t.lose);
        return { odds: bookPrice(p, b.m2), prob: p };
      }, 'derived', ours.push)
    );
  }
  groups.push([{ key: 'ah', title: 'Asian handicap', emoji: '⚖️', blurb: 'A goal head start or deficit. Whole lines refund on a tie.' }, ahCands]);

  const totals = [];
  for (const line of [1.5, 2.5, 3.5]) {
    const quoted = line === 2.5;
    totals.push(
      cand(`o${line}`, 'Total Goals', `Over ${line} goals`, ou[line].over, (b) =>
        quoted ? { odds: b.o.over25, prob: fairProbabilities([b.o.over25, b.o.under25])[0] } : { odds: bookPrice(b.m.overUnder[line].over, b.m2), prob: b.m.overUnder[line].over }, quoted ? 'quoted' : 'derived'),
      cand(`u${line}`, 'Total Goals', `Under ${line} goals`, ou[line].under, (b) =>
        quoted ? { odds: b.o.under25, prob: fairProbabilities([b.o.over25, b.o.under25])[1] } : { odds: bookPrice(b.m.overUnder[line].under, b.m2), prob: b.m.overUnder[line].under }, quoted ? 'quoted' : 'derived')
    );
  }
  groups.push([{ key: 'totals', title: 'Total goals', emoji: '⚽', blurb: 'Goals by both teams combined.' }, totals]);

  groups.push([
    { key: 'btts', title: 'Both teams to score', emoji: '🎯', blurb: 'Does each side find the net?' },
    [
      cand('bttsYes', 'Both Teams To Score', 'BTTS Yes', btts.yes, (b) =>
        b.o.bttsYes ? { odds: b.o.bttsYes, prob: fairProbabilities([b.o.bttsYes, b.o.bttsNo])[0] } : null, 'quoted'),
      cand('bttsNo', 'Both Teams To Score', 'BTTS No', btts.no, (b) =>
        b.o.bttsNo ? { odds: b.o.bttsNo, prob: fairProbabilities([b.o.bttsYes, b.o.bttsNo])[1] } : null, 'quoted')
    ]
  ]);

  groups.push([
    { key: 'team', title: 'Team goals', emoji: '🥅', blurb: 'One team’s goals only.' },
    [
      cand('h05', 'Team Goals', `${H} over 0.5`, tt.home.over0_5, (b) => ({ odds: bookPrice(b.m.teamTotals.home.over0_5, b.m2), prob: b.m.teamTotals.home.over0_5 }), 'derived'),
      cand('h15', 'Team Goals', `${H} over 1.5`, tt.home.over1_5, (b) => ({ odds: bookPrice(b.m.teamTotals.home.over1_5, b.m2), prob: b.m.teamTotals.home.over1_5 }), 'derived'),
      cand('a05', 'Team Goals', `${A} over 0.5`, tt.away.over0_5, (b) => ({ odds: bookPrice(b.m.teamTotals.away.over0_5, b.m2), prob: b.m.teamTotals.away.over0_5 }), 'derived'),
      cand('a15', 'Team Goals', `${A} over 1.5`, tt.away.over1_5, (b) => ({ odds: bookPrice(b.m.teamTotals.away.over1_5, b.m2), prob: b.m.teamTotals.away.over1_5 }), 'derived')
    ]
  ]);

  groups.push([
    { key: 'cs', title: 'Clean sheet', emoji: '🧤', blurb: 'Keeps the opponent to zero.' },
    [
      cand('csh', 'Clean Sheet', `${H} clean sheet`, cs.home, (b) => ({ odds: bookPrice(b.m.cleanSheet.home, b.m2), prob: b.m.cleanSheet.home }), 'derived'),
      cand('csa', 'Clean Sheet', `${A} clean sheet`, cs.away, (b) => ({ odds: bookPrice(b.m.cleanSheet.away, b.m2), prob: b.m.cleanSheet.away }), 'derived')
    ]
  ]);

  return groups.map(([meta, cands]) => ({ ...meta, selections: price(ctx, cands, opts.modelWeight, opts.kellyFraction) }));
}

// ─── Basketball ───────────────────────────────────────────────────────────

/**
 * @param {import('./prediction_pipeline.js').BasketballInput} input
 * @param {{ margin: number, total: number, marginSd: number, totalSd: number }} proj our projection
 * @param {{ modelWeight: number, kellyFraction: number }} opts
 * @returns {MarketGroup[]}
 */
export function buildBasketballMarkets(input, proj, opts) {
  const ctx = { fixtureId: input.fixtureId, sport: /** @type {const} */ ('basketball'), matchTitle: `${input.homeTeam} vs ${input.awayTeam}`, league: input.league };
  const H = input.homeTeam;
  const A = input.awayTeam;
  const { marginSd, totalSd } = proj;

  // Each book's implied mean margin and total, from its de-vigged main lines.
  const books = Object.entries(input.odds).map(([book, o]) => {
    const [pml] = fairProbabilities([o.homeMoneyline, o.awayMoneyline]);
    const [pcover] = fairProbabilities([o.homeSpreadOdds, o.awaySpreadOdds]);
    const [pover] = fairProbabilities([o.overOdds, o.underOdds]);
    // P(margin > -L) = pcover  →  mean = -L - σ·Φ⁻¹(1 - pcover)
    const mean = -o.spreadLine - marginSd * probit(1 - pcover);
    // P(total > T) = pover  →  mean = T - σ·Φ⁻¹(1 - pover)
    const total = o.totalLine - totalSd * probit(1 - pover);
    const mSpread = 1 / o.homeSpreadOdds + 1 / o.awaySpreadOdds - 1;
    const mTotal = 1 / o.overOdds + 1 / o.underOdds - 1;
    return { book, o, pml, pcover, pover, mean, total, mSpread, mTotal };
  });

  const n = books.length;
  const mainSpread = Math.round((books.reduce((a, b) => a + b.o.spreadLine, 0) / n) * 2) / 2;
  const mainTotal = Math.round((books.reduce((a, b) => a + b.o.totalLine, 0) / n) * 2) / 2;

  const coverModel = (/** @type {number} */ L) => 1 - normalCdf(-L, proj.margin, marginSd);
  const overModel = (/** @type {number} */ T) => 1 - normalCdf(T, proj.total, totalSd);

  /**
   * @param {string} key @param {string} market @param {string} label @param {number} model
   * @param {(b: typeof books[number]) => { odds: number, prob: number }} quote
   * @param {'quoted' | 'derived'} pricing
   * @returns {Candidate}
   */
  const cand = (key, market, label, model, quote, pricing) => ({
    key, market, label, model, pricing,
    quotes: Object.fromEntries(books.map((b) => [b.book, quote(b)]))
  });

  const spreads = [];
  for (const d of [-4, -2, 0, 2, 4]) {
    const L = mainSpread + d;
    const isMain = d === 0;
    spreads.push(
      cand(`sph${L}`, 'Point Spread', `${H} ${fmtLine(L)}`, coverModel(L), (b) => {
        if (isMain && b.o.spreadLine === L) return { odds: b.o.homeSpreadOdds, prob: b.pcover };
        const p = 1 - normalCdf(-L, b.mean, marginSd);
        return { odds: bookPrice(p, b.mSpread), prob: p };
      }, isMain ? 'quoted' : 'derived'),
      cand(`spa${-L}`, 'Point Spread', `${A} ${fmtLine(-L)}`, 1 - coverModel(L), (b) => {
        if (isMain && b.o.spreadLine === L) return { odds: b.o.awaySpreadOdds, prob: 1 - b.pcover };
        const p = normalCdf(-L, b.mean, marginSd);
        return { odds: bookPrice(p, b.mSpread), prob: p };
      }, isMain ? 'quoted' : 'derived')
    );
  }

  const totals = [];
  for (const d of [-6, -3, 0, 3, 6]) {
    const T = mainTotal + d;
    const isMain = d === 0;
    totals.push(
      cand(`o${T}`, 'Total Points', `Over ${T}`, overModel(T), (b) => {
        if (isMain && b.o.totalLine === T) return { odds: b.o.overOdds, prob: b.pover };
        const p = 1 - normalCdf(T, b.total, totalSd);
        return { odds: bookPrice(p, b.mTotal), prob: p };
      }, isMain ? 'quoted' : 'derived'),
      cand(`u${T}`, 'Total Points', `Under ${T}`, 1 - overModel(T), (b) => {
        if (isMain && b.o.totalLine === T) return { odds: b.o.underOdds, prob: 1 - b.pover };
        const p = normalCdf(T, b.total, totalSd);
        return { odds: bookPrice(p, b.mTotal), prob: p };
      }, isMain ? 'quoted' : 'derived')
    );
  }

  /** @type {Array<[Omit<MarketGroup, 'selections'>, Candidate[]]>} */
  const groups = [
    [
      { key: 'ml', title: 'Moneyline', emoji: '💵', blurb: 'Who wins, overtime included.' },
      [
        cand('homeMl', 'Moneyline', `${H} ML`, coverModel(0), (b) => ({ odds: b.o.homeMoneyline, prob: b.pml }), 'quoted'),
        cand('awayMl', 'Moneyline', `${A} ML`, 1 - coverModel(0), (b) => ({ odds: b.o.awayMoneyline, prob: 1 - b.pml }), 'quoted')
      ]
    ],
    [{ key: 'spread', title: 'Point spread', emoji: '⚖️', blurb: 'Win by more than the line, or lose by less.' }, spreads],
    [{ key: 'total', title: 'Total points', emoji: '🎯', blurb: 'Points by both teams combined.' }, totals]
  ];

  return groups.map(([meta, cands]) => ({ ...meta, selections: price(ctx, cands, opts.modelWeight, opts.kellyFraction) }));
}
