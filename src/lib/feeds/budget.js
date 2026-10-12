/**
 * Quota budgeting.
 *
 * Every paid call goes through a ledger so limits are never exceeded and the
 * allowance is spread evenly: daily quotas reset at 00:00 UTC; monthly quotas
 * are paced so each remaining day of the month gets an equal share. The
 * provider's own "remaining" header always wins when it is stricter (e.g. the
 * same key used elsewhere).
 *
 *   API-Sports    100 requests / day, separately per sport API → we use ≤ 90
 *   OddsPapi      250 requests / month                         → we use ≤ 240
 *   The Odds API  500 credits / month (markets × regions)      → we use ≤ 488
 */

/**
 * @typedef {Object} ProviderLimit
 * @property {'day' | 'month'} window
 * @property {number} limit the provider's hard limit
 * @property {number} reserve held back for manual checks, retries and lookups
 */

/** @type {Record<string, ProviderLimit>} */
export const LIMITS = {
  'api-sports': { window: 'day', limit: 100, reserve: 10 },
  oddspapi: { window: 'month', limit: 250, reserve: 10 },
  'the-odds-api': { window: 'month', limit: 500, reserve: 12 }
};

/**
 * @typedef {Object} LedgerEntry
 * @property {string} provider key into LIMITS
 * @property {string} window current window id: '2026-10-12' (day) or '2026-10' (month)
 * @property {number} used spent in this window (our count, reconciled with headers)
 * @property {string} day today's id, for monthly pacing
 * @property {number} dayUsed spent today
 * @property {number} [remoteRemaining] last remaining count the provider reported
 * @property {number} [remoteAt] when it was reported
 */

const dayId = (/** @type {number} */ now) => new Date(now).toISOString().slice(0, 10);
const monthId = (/** @type {number} */ now) => new Date(now).toISOString().slice(0, 7);

/** Days in the current UTC month. */
export function daysInMonth(/** @type {number} */ now) {
  const d = new Date(now);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
}

/**
 * Bring an entry into the current window (resets counts on rollover).
 * @param {string} ledgerKey e.g. 'api-sports:football', 'oddspapi'
 * @param {LedgerEntry | undefined} entry
 * @param {number} now
 * @returns {LedgerEntry}
 */
export function current(ledgerKey, entry, now) {
  const provider = ledgerKey.split(':')[0];
  const lim = LIMITS[provider];
  if (!lim) throw new Error(`Unknown provider ${provider}`);
  const window = lim.window === 'day' ? dayId(now) : monthId(now);
  const day = dayId(now);
  if (!entry || entry.window !== window) return { provider, window, used: 0, day, dayUsed: 0 };
  if (entry.day !== day) return { ...entry, day, dayUsed: 0, remoteRemaining: entry.remoteRemaining };
  return { ...entry };
}

/**
 * How much may still be spent right now.
 * @param {LedgerEntry} e (already `current`)
 * @param {number} now
 * @returns {{ today: number, window: number, cap: number }}
 */
export function allowance(e, now) {
  const lim = LIMITS[e.provider];
  const cap = lim.limit - lim.reserve;
  let windowLeft = cap - e.used;
  // Respect the provider's own count when it is stricter.
  if (typeof e.remoteRemaining === 'number') windowLeft = Math.min(windowLeft, e.remoteRemaining - lim.reserve);
  windowLeft = Math.max(0, windowLeft);
  if (lim.window === 'day') return { today: windowLeft, window: windowLeft, cap };

  // Monthly: equal share for each remaining day, including today.
  const d = new Date(now).getUTCDate();
  const daysLeft = daysInMonth(now) - d + 1;
  const leftAtStartOfToday = windowLeft + e.dayUsed;
  const share = Math.floor(leftAtStartOfToday / daysLeft);
  return { today: Math.max(0, Math.min(windowLeft, share - e.dayUsed)), window: windowLeft, cap };
}

/**
 * Record spend, optionally reconciling with the provider's headers.
 * @param {LedgerEntry} e
 * @param {number} cost
 * @param {{ remaining?: number, used?: number }} [remote]
 * @param {number} [now]
 * @returns {LedgerEntry}
 */
export function spend(e, cost, remote, now = Date.now()) {
  const next = { ...e, used: e.used + cost, dayUsed: e.dayUsed + cost };
  if (remote && Number.isFinite(remote.remaining)) {
    const lim = LIMITS[e.provider];
    next.remoteRemaining = /** @type {number} */ (remote.remaining);
    next.remoteAt = now;
    // If the provider says more has been used than we counted, believe it.
    const impliedUsed = lim.limit - /** @type {number} */ (remote.remaining);
    if (impliedUsed > next.used) {
      next.dayUsed += impliedUsed - next.used;
      next.used = impliedUsed;
    }
  }
  if (remote && Number.isFinite(remote.used) && /** @type {number} */ (remote.used) > next.used) {
    next.dayUsed += /** @type {number} */ (remote.used) - next.used;
    next.used = /** @type {number} */ (remote.used);
  }
  return next;
}

/**
 * @typedef {Object} Job
 * @property {string} id unique and stable, e.g. 'as:football:games:today'
 * @property {string} ledger ledger key it spends from
 * @property {number} cost expected units (requests or credits)
 * @property {number} priority lower runs first
 * @property {number} every minimum ms between runs
 * @property {boolean} [force] run even if `every` hasn't elapsed (e.g. first run of the day)
 * @property {boolean} [window] draw on the whole window's allowance (monthly lookups), not today's share
 * @property {any} [params]
 */

/**
 * Choose which jobs run this tick: due jobs in priority order, each only if
 * its ledger still has allowance for today after the jobs already chosen.
 * @param {Job[]} jobs
 * @param {Record<string, LedgerEntry>} ledgers (already `current`)
 * @param {Record<string, number>} lastRun job id → ms
 * @param {number} now
 * @param {{ maxPerLedger?: Record<string, number>, protect?: Record<string, number>, protectAbove?: number }} [opts]
 *   maxPerLedger: cap per tick, to spread work through the day;
 *   protect: units kept back for jobs with priority ≤ protectAbove (default 2)
 * @returns {{ run: Job[], skipped: Array<{ id: string, reason: string }> }}
 */
export function planJobs(jobs, ledgers, lastRun, now, opts = {}) {
  const allow = Object.fromEntries(Object.entries(ledgers).map(([k, e]) => [k, allowance(e, now)]));
  /** @type {Record<string, number>} */
  const spent = {};
  const run = [];
  const skipped = [];
  const protectAbove = opts.protectAbove ?? 2;
  for (const j of [...jobs].sort((a, b) => a.priority - b.priority)) {
    const due = j.force || now - (lastRun[j.id] ?? 0) >= j.every;
    if (!due) continue;
    const a = allow[j.ledger];
    if (!a) {
      skipped.push({ id: j.id, reason: 'no ledger' });
      continue;
    }
    const s = spent[j.ledger] ?? 0;
    let left = (j.window ? a.window : a.today) - s;
    if (j.priority > protectAbove) left -= opts.protect?.[j.ledger] ?? 0;
    left = Math.min(left, a.window - s);
    if (j.cost > left) {
      skipped.push({ id: j.id, reason: `budget (${Math.max(0, left)} left)` });
      continue;
    }
    const cap = opts.maxPerLedger?.[j.ledger.split(':')[0]];
    if (cap !== undefined && j.cost > 0 && s + j.cost > cap) {
      skipped.push({ id: j.id, reason: 'spread across ticks' });
      continue;
    }
    spent[j.ledger] = s + j.cost;
    run.push(j);
  }
  return { run, skipped };
}

/**
 * Public summary for the app's data-status panel.
 * @param {Record<string, LedgerEntry>} ledgers
 * @param {number} now
 */
export function usageSummary(ledgers, now) {
  return Object.fromEntries(
    Object.entries(ledgers).map(([k, raw]) => {
      const e = current(k, raw, now);
      const lim = LIMITS[e.provider];
      const a = allowance(e, now);
      return [k, { window: lim.window, limit: lim.limit, cap: a.cap, used: e.used, today: e.dayUsed, leftToday: a.today, remote: e.remoteRemaining ?? null }];
    })
  );
}
