/**
 * Matching the same game across providers.
 *
 * Providers spell teams differently ("Man Utd", "Manchester United FC",
 * "Manchester Utd"), so names are normalised to tokens and compared with a
 * containment-aware Jaccard score; candidates must also kick off within a few
 * hours of each other.
 */

const STOP = new Set(['fc', 'cf', 'afc', 'sc', 'ac', 'cd', 'sd', 'ud', 'fk', 'sk', 'bk', 'if', 'the', 'club', 'de', 'calcio', 'ssc', 'as', 'us', 'rc', 'bc', 'kk', 'hc', 'cfc', 'vfb', 'vfl', 'tsg', 'sv', '1', 'ii']);

/** Common abbreviations → canonical token(s). */
const EXPAND = /** @type {Record<string, string>} */ ({
  utd: 'united',
  man: 'manchester',
  st: 'saint',
  'st.': 'saint',
  ny: 'new york',
  la: 'los angeles',
  okc: 'oklahoma city',
  wolves: 'wolverhampton',
  spurs: 'tottenham',
  psg: 'paris saint germain',
  inter: 'internazionale',
  intl: 'international',
  nottm: 'nottingham',
  sheff: 'sheffield',
  bayern: 'bayern munchen',
  munich: 'munchen',
  athletic: 'athletic',
  atl: 'atletico',
  gladbach: 'monchengladbach',
  saints: 'southampton'
});

/**
 * Lower-case, strip accents and punctuation, expand abbreviations, drop filler.
 * @param {string} name
 * @returns {string[]}
 */
export function teamTokens(name) {
  const plain = (name ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9. ]+/g, ' ');
  const out = [];
  for (const raw of plain.split(/\s+/)) {
    const t = raw.replace(/\.$/, '');
    if (!t) continue;
    const exp = EXPAND[raw] ?? EXPAND[t];
    for (const x of (exp ?? t).split(' ')) if (!STOP.has(x)) out.push(x);
  }
  return out.length ? out : plain.split(/\s+/).filter(Boolean);
}

/** Canonical key for a team name (sorted tokens). */
export const teamKey = (/** @type {string} */ name) => [...new Set(teamTokens(name))].sort().join(' ');

/**
 * Similarity in [0, 1]. Exact token sets score 1; one name contained in the
 * other ("Arsenal" vs "Arsenal London") scores high; prefixes count ("Atl" ~ "Atletico").
 * @param {string} a
 * @param {string} b
 */
export function teamSimilarity(a, b) {
  const A = new Set(teamTokens(a));
  const B = new Set(teamTokens(b));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const x of A) {
    if (B.has(x)) inter++;
    else if (x.length >= 3 && [...B].some((y) => y.length >= 3 && (y.startsWith(x) || x.startsWith(y)))) inter += 0.8;
  }
  const union = A.size + B.size - inter;
  const jaccard = inter / union;
  const containment = inter / Math.min(A.size, B.size);
  return Math.max(jaccard, 0.85 * containment);
}

/**
 * @typedef {{ home: string, away: string, kickoff: number }} Matchable
 */

/**
 * Best match for `target` among candidates, or null.
 * @template {Matchable} T
 * @param {Matchable} target
 * @param {T[]} candidates
 * @param {{ windowMs?: number, minTeam?: number, allowSwap?: boolean }} [opts]
 * @returns {{ item: T, score: number, swapped: boolean } | null}
 */
export function bestMatch(target, candidates, opts = {}) {
  const windowMs = opts.windowMs ?? 3 * 3600_000;
  const minTeam = opts.minTeam ?? 0.6;
  /** @type {{ item: T, score: number, swapped: boolean } | null} */
  let best = null;
  for (const c of candidates) {
    if (Math.abs(c.kickoff - target.kickoff) > windowMs) continue;
    const h = teamSimilarity(target.home, c.home);
    const a = teamSimilarity(target.away, c.away);
    let score = h >= minTeam && a >= minTeam ? h + a : 0;
    let swapped = false;
    if (opts.allowSwap) {
      const hs = teamSimilarity(target.home, c.away);
      const as = teamSimilarity(target.away, c.home);
      if (hs >= minTeam && as >= minTeam && hs + as - 0.2 > score) {
        score = hs + as - 0.2;
        swapped = true;
      }
    }
    // Small tie-break for closer kickoffs.
    score -= Math.abs(c.kickoff - target.kickoff) / (windowMs * 50);
    if (score >= 1.2 && (!best || score > best.score)) best = { item: c, score, swapped };
  }
  return best;
}
