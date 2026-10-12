"use node";
/**
 * Live-data ingest: Convex's built-in fetching (actions + cron) and file
 * storage acting as the app's data backend.
 *
 * Every 30 minutes `tick`:
 *   1. claims a lock and reads quota ledgers (one tiny document),
 *   2. loads the gzipped ingest store from file storage,
 *   3. runs only the provider calls that are due and within quota,
 *   4. settles finished games into the pick ledger,
 *   5. writes a new gzipped feed file only when its content changed.
 *
 * API keys live in Convex environment variables, never in the repo:
 *   API_SPORTS_KEY (or API_FOOTBALL_KEY), ODDSPAPI_KEY, THE_ODDS_API_KEY
 */
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { gzipSync, gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import type { Id } from "./_generated/dataModel";
import { runTick, type Fetcher } from "../src/lib/feeds/runner.js";
import { reviveStore } from "../src/lib/feeds/store.js";
import { buildFeed, updateRecord } from "../src/lib/feeds/build.js";
import { usageSummary } from "../src/lib/feeds/budget.js";

/** Hosts this action may call. */
const ALLOWED = new Set([
  "v3.football.api-sports.io",
  "v1.basketball.api-sports.io",
  "v2.nba.api-sports.io",
  "v1.hockey.api-sports.io",
  "v1.baseball.api-sports.io",
  "api.the-odds-api.com",
  "api.oddspapi.io",
]);

function keys() {
  return {
    apiSports: process.env.API_SPORTS_KEY || process.env.API_FOOTBALL_KEY || "",
    oddsApi: process.env.THE_ODDS_API_KEY || "",
    oddspapi: process.env.ODDSPAPI_KEY || "",
  };
}

/** The metered network layer handed to the runner. */
function makeFetcher(k: ReturnType<typeof keys>): Fetcher {
  // Testing only: route provider calls to a local mock (never set in production).
  const override = process.env.FEED_BASE_OVERRIDE;
  return async (provider, url) => {
    const u = new URL(url);
    if (!ALLOWED.has(u.host)) throw new Error(`Host not allowed: ${u.host}`);
    const headers: Record<string, string> = { accept: "application/json" };
    if (provider === "api-sports") headers["x-apisports-key"] = k.apiSports;
    else u.searchParams.set("apiKey", provider === "the-odds-api" ? k.oddsApi : k.oddspapi);
    const target = override ? `${override.replace(/\/$/, "")}/${u.host}${u.pathname}${u.search}` : u.toString();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 25_000);
    try {
      const res = await fetch(target, { headers, signal: ctrl.signal });
      const text = await res.text();
      let body: unknown = null;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = { message: text.slice(0, 200) };
      }
      return { status: res.status, body, headers: res.headers };
    } finally {
      clearTimeout(timer);
    }
  };
}

async function readGz(ctx: { storage: { get(id: Id<"_storage">): Promise<Blob | null> } }, id: Id<"_storage"> | null) {
  if (!id) return null;
  const blob = await ctx.storage.get(id);
  if (!blob) return null;
  try {
    return JSON.parse(gunzipSync(Buffer.from(await blob.arrayBuffer())).toString("utf8"));
  } catch {
    return null;
  }
}

type ClaimState = {
  ledgers: Record<string, any>;
  lastRun: Record<string, number>;
  storeId: Id<"_storage"> | null;
  lookupsId: Id<"_storage"> | null;
  feedVersion: string | null;
};

const gz = (value: unknown) => new Blob([gzipSync(Buffer.from(JSON.stringify(value)), { level: 9 })], { type: "application/gzip" });

export const tick = internalAction({
  args: {},
  handler: async (ctx): Promise<Record<string, unknown>> => {
    const k = keys();
    const configured = { apiSports: Boolean(k.apiSports), oddsApi: Boolean(k.oddsApi), oddspapi: Boolean(k.oddspapi) };
    if (!configured.apiSports && !configured.oddsApi && !configured.oddspapi) {
      return { skipped: "No provider keys set (API_SPORTS_KEY, THE_ODDS_API_KEY, ODDSPAPI_KEY)." };
    }
    const now = Date.now();
    const state: ClaimState | null = await ctx.runMutation(internal.feed.claim, { now });
    if (!state) return { skipped: "Another tick is running." };

    let ledgers: unknown = undefined;
    try {
      const store = reviveStore(await readGz(ctx, state.storeId));
      const lookups = (await readGz(ctx, state.lookupsId)) ?? {};

      const r = await runTick({
        store,
        lookups,
        ledgers: state.ledgers,
        lastRun: state.lastRun,
        now,
        fetcher: makeFetcher(k),
        keys: configured,
        reserve: async (reserved) => {
          await ctx.runMutation(internal.feed.reserve, { ledgers: reserved });
        },
      });
      ledgers = r.ledgers;

      updateRecord(store, now);
      const usage = usageSummary(r.ledgers, now);
      const feed = buildFeed(store, now, usage);
      const { generatedAt, usage: _u, ...content } = feed;
      const version = createHash("sha1").update(JSON.stringify(content)).digest("hex").slice(0, 16);

      // Writes happen only when something changed.
      const storeId = r.storeChanged || !state.storeId ? await ctx.storage.store(gz(store)) : undefined;
      const lookupsId = r.lookupsChanged ? await ctx.storage.store(gz(lookups)) : undefined;
      let feedArg;
      if (version !== state.feedVersion) {
        const feedId = await ctx.storage.store(gz(feed));
        const counts = Object.fromEntries(Object.entries(feed.inputs).map(([s, xs]) => [s, (xs as unknown[]).length]));
        feedArg = { storageId: feedId, version, generatedAt, counts: { ...counts, games: feed.games.length } };
      }
      await ctx.runMutation(internal.feed.commit, { now, ledgers: r.ledgers, lastRun: r.lastRun, log: r.log, storeId, lookupsId, feed: feedArg, usage });
      return { ran: r.ran, skipped: r.skipped.length, log: r.log, feedUpdated: Boolean(feedArg) };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await ctx.runMutation(internal.feed.release, { ledgers, error: msg, now });
      throw err;
    }
  },
});
