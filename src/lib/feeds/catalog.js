/**
 * What we track, and where it comes from.
 *
 * Five sports, each with its own API-Sports host (separate 100/day quotas),
 * plus the two odds providers. Competitions are matched by country + name
 * patterns rather than hard-coded ids, so a provider renumbering a league
 * doesn't silently drop it.
 */

/** @typedef {'football' | 'basketball' | 'nba' | 'hockey' | 'baseball'} SportKey */
/** @typedef {'football' | 'basketball' | 'hockey' | 'baseball'} Family */

/**
 * @typedef {Object} CompetitionRule
 * @property {string} label shown in the app
 * @property {RegExp} name league-name pattern
 * @property {RegExp} [country] country-name pattern
 * @property {number} [tier] lower first when budgets are tight
 */

/**
 * @typedef {Object} SportDef
 * @property {SportKey} key
 * @property {Family} family
 * @property {string} host API-Sports host
 * @property {string} gamesPath
 * @property {'fixtures' | 'games' | 'nba'} shape API-Sports response shape
 * @property {CompetitionRule[]} competitions
 * @property {string[]} theOddsApi The Odds API sport keys
 * @property {string} oddsApiMarkets markets requested from The Odds API
 * @property {RegExp} oddspapiSport OddsPapi sport name
 * @property {Array<{ name: RegExp, category?: RegExp }>} oddspapiTournaments
 * @property {boolean} apiSportsOdds whether API-Sports odds are worth fetching
 * @property {(d: Date) => string | number} season season parameter for a date
 */

const year = (/** @type {Date} */ d) => d.getUTCFullYear();
const month = (/** @type {Date} */ d) => d.getUTCMonth() + 1;
/** Seasons that start in late summer/autumn: 2026-27 → "2026" or "2026-2027". */
const splitStart = (/** @type {Date} */ d, /** @type {number} */ startMonth) => (month(d) >= startMonth ? year(d) : year(d) - 1);

/** @type {Record<SportKey, SportDef>} */
export const SPORTS = {
  football: {
    key: 'football',
    family: 'football',
    host: 'v3.football.api-sports.io',
    gamesPath: '/fixtures',
    shape: 'fixtures',
    competitions: [
      { label: 'Premier League', name: /^premier league$/i, country: /^england$/i, tier: 1 },
      { label: 'La Liga', name: /^la liga$/i, country: /^spain$/i, tier: 1 },
      { label: 'Serie A', name: /^serie a$/i, country: /^italy$/i, tier: 1 },
      { label: 'Bundesliga', name: /^bundesliga$/i, country: /^germany$/i, tier: 1 },
      { label: 'Ligue 1', name: /^ligue 1$/i, country: /^france$/i, tier: 1 },
      { label: 'Champions League', name: /^uefa champions league$/i, country: /^world$/i, tier: 1 },
      { label: 'Europa League', name: /^uefa europa league$/i, country: /^world$/i, tier: 2 },
      { label: 'NPFL', name: /^(npfl|premier league|nigeria premier (football )?league)$/i, country: /^nigeria$/i, tier: 2 },
      { label: 'Championship', name: /^championship$/i, country: /^england$/i, tier: 3 }
    ],
    theOddsApi: [
      'soccer_epl',
      'soccer_spain_la_liga',
      'soccer_italy_serie_a',
      'soccer_germany_bundesliga',
      'soccer_france_ligue_one',
      'soccer_uefa_champs_league',
      'soccer_uefa_europa_league',
      'soccer_efl_champ'
    ],
    oddsApiMarkets: 'h2h,totals',
    oddspapiSport: /^(soccer|football)$/i,
    oddspapiTournaments: [
      { name: /^premier league$/i, category: /^england$/i },
      { name: /^la ?liga$/i, category: /^spain$/i },
      { name: /^serie a$/i, category: /^italy$/i },
      { name: /^bundesliga$/i, category: /^germany$/i },
      { name: /^ligue 1$/i, category: /^france$/i },
      { name: /champions league$/i, category: /^(international clubs|europe|international)$/i },
      { name: /europa league$/i, category: /^(international clubs|europe|international)$/i },
      { name: /(npfl|premier (football )?league)/i, category: /^nigeria$/i },
      { name: /.+/ }
    ],
    apiSportsOdds: true,
    season: (d) => splitStart(d, 7)
  },
  basketball: {
    key: 'basketball',
    family: 'basketball',
    host: 'v1.basketball.api-sports.io',
    gamesPath: '/games',
    shape: 'games',
    competitions: [
      { label: 'EuroLeague', name: /^euroleague$/i, tier: 1 },
      { label: 'EuroCup', name: /^eurocup$/i, tier: 2 },
      { label: 'Liga ACB', name: /^(acb|liga acb|liga endesa)$/i, country: /^spain$/i, tier: 2 },
      { label: 'Lega A', name: /^(lega a|serie a)$/i, country: /^italy$/i, tier: 3 },
      { label: 'NBL', name: /^nbl$/i, country: /^australia$/i, tier: 3 },
      { label: 'WNBA', name: /^wnba$/i, country: /^usa$/i, tier: 2 }
    ],
    theOddsApi: ['basketball_euroleague', 'basketball_nbl', 'basketball_wnba'],
    oddsApiMarkets: 'h2h,spreads,totals',
    oddspapiSport: /^basketball$/i,
    oddspapiTournaments: [{ name: /^euroleague$/i }, { name: /^eurocup$/i }, { name: /^(acb|liga acb|liga endesa)$/i, category: /^spain$/i }, { name: /^(?!nba(?:$|[ -]preseason)).+/i }],
    apiSportsOdds: true,
    season: (d) => `${splitStart(d, 8)}-${splitStart(d, 8) + 1}`
  },
  nba: {
    key: 'nba',
    family: 'basketball',
    host: 'v2.nba.api-sports.io',
    gamesPath: '/games',
    shape: 'nba',
    competitions: [{ label: 'NBA', name: /.*/, tier: 1 }],
    theOddsApi: ['basketball_nba'],
    oddsApiMarkets: 'h2h,spreads,totals',
    oddspapiSport: /^basketball$/i,
    oddspapiTournaments: [{ name: /^nba$/i, category: /^(usa|united states)$/i }],
    apiSportsOdds: false,
    season: (d) => splitStart(d, 8)
  },
  hockey: {
    key: 'hockey',
    family: 'hockey',
    host: 'v1.hockey.api-sports.io',
    gamesPath: '/games',
    shape: 'games',
    competitions: [
      { label: 'NHL', name: /^nhl$/i, country: /^usa$/i, tier: 1 },
      { label: 'KHL', name: /^khl$/i, tier: 2 },
      { label: 'SHL', name: /^shl$/i, country: /^sweden$/i, tier: 3 }
    ],
    theOddsApi: ['icehockey_nhl', 'icehockey_sweden_hockey_league'],
    oddsApiMarkets: 'h2h,spreads,totals',
    oddspapiSport: /^(ice hockey|hockey|icehockey)$/i,
    oddspapiTournaments: [{ name: /.+/ }],
    apiSportsOdds: true,
    season: (d) => splitStart(d, 8)
  },
  baseball: {
    key: 'baseball',
    family: 'baseball',
    host: 'v1.baseball.api-sports.io',
    gamesPath: '/games',
    shape: 'games',
    competitions: [
      { label: 'MLB', name: /^mlb$/i, country: /^usa$/i, tier: 1 },
      { label: 'NPB', name: /^npb$/i, country: /^japan$/i, tier: 2 },
      { label: 'KBO', name: /^kbo$/i, country: /^(south )?korea$/i, tier: 2 }
    ],
    theOddsApi: ['baseball_mlb', 'baseball_npb', 'baseball_kbo'],
    oddsApiMarkets: 'h2h,spreads,totals',
    oddspapiSport: /^baseball$/i,
    oddspapiTournaments: [{ name: /.+/ }],
    apiSportsOdds: true,
    season: (d) => year(d)
  }
};

export const SPORT_KEYS = /** @type {SportKey[]} */ (Object.keys(SPORTS));

/**
 * The competition rule a league belongs to, if we track it.
 * @param {SportKey} sport
 * @param {string} league
 * @param {string} [country]
 */
export function competitionFor(sport, league, country) {
  // NBA regulation is 48 minutes and has its own provider/dashboard.
  if (sport === 'basketball' && /^nba(?:$|[ -]preseason)/i.test(league ?? '')) return undefined;
  const known = SPORTS[sport].competitions.find((c) => c.name.test(league ?? '') && (!c.country || !country || c.country.test(country)));
  return known ?? (typeof league === 'string' && league.trim() ? { label: league.trim(), name: /.*/, tier: 4 } : undefined);
}

/** Map a The Odds API sport key back to our sport. */
export function sportForOddsApiKey(/** @type {string} */ key) {
  return SPORT_KEYS.find((s) => SPORTS[s].theOddsApi.includes(key))
    ?? (key.startsWith('soccer_') ? 'football' : key.startsWith('basketball_') ? (key === 'basketball_nba' ? 'nba' : 'basketball') : key.startsWith('icehockey_') ? 'hockey' : key.startsWith('baseball_') ? 'baseball' : undefined);
}

/** Readable league name for a The Odds API key (used when an event has no API-Sports match). */
export const ODDS_API_LEAGUES = /** @type {Record<string, string>} */ ({
  soccer_epl: 'Premier League',
  soccer_spain_la_liga: 'La Liga',
  soccer_italy_serie_a: 'Serie A',
  soccer_germany_bundesliga: 'Bundesliga',
  soccer_france_ligue_one: 'Ligue 1',
  soccer_uefa_champs_league: 'Champions League',
  soccer_uefa_europa_league: 'Europa League',
  soccer_efl_champ: 'Championship',
  basketball_nba: 'NBA',
  basketball_euroleague: 'EuroLeague',
  basketball_nbl: 'NBL',
  basketball_wnba: 'WNBA',
  icehockey_nhl: 'NHL',
  icehockey_sweden_hockey_league: 'SHL',
  baseball_mlb: 'MLB',
  baseball_npb: 'NPB',
  baseball_kbo: 'KBO'
});

/**
 * Bookmakers we ask The Odds API for: ≤ 10 keeps every call at one region's
 * cost. 1xBet is the one Nigerian punters use; Pinnacle is the sharp anchor.
 */
export const ODDS_API_BOOKMAKERS = ['onexbet', 'pinnacle', 'betfair_ex_eu', 'williamhill', 'unibet_eu', 'marathonbet', 'betsson', 'sport888', 'nordicbet', 'betonlineag'];

/** Display names for The Odds API bookmaker keys. */
export const ODDS_API_BOOK_NAMES = /** @type {Record<string, string>} */ ({
  onexbet: '1xBet',
  pinnacle: 'Pinnacle',
  betfair_ex_eu: 'Betfair',
  williamhill: 'William Hill',
  unibet_eu: 'Unibet',
  marathonbet: 'Marathonbet',
  betsson: 'Betsson',
  sport888: '888sport',
  nordicbet: 'NordicBet',
  betonlineag: 'BetOnline'
});

/** OddsPapi bookmakers (max 3 per call): the three Nigerian favourites. */
export const ODDSPAPI_BOOKMAKERS = [
  { name: 'SportyBet', match: /sporty/i },
  { name: '1xBet', match: /^1x ?bet$/i },
  { name: '22Bet', match: /^22 ?bet$/i }
];

/** API-Sports bookmaker names we keep (others are dropped to keep the feed small). */
export const API_SPORTS_BOOKS = [/^1xbet$/i, /^pinnacle$/i, /^bet365$/i, /^betway$/i, /^marathonbet$/i, /^unibet$/i, /^william hill$/i, /^10bet$/i];

/** Normalise a bookmaker name to the app's display form. */
export function displayBook(/** @type {string} */ name) {
  if (/^1x ?bet$/i.test(name)) return '1xBet';
  if (/^22 ?bet$/i.test(name)) return '22Bet';
  if (/sporty/i.test(name)) return 'SportyBet';
  return name;
}
