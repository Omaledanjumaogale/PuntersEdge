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
import { makeFunctionReference } from "convex/server";
import { internal } from "./_generated/api";
import { gzipSync, gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import type { Id } from "./_generated/dataModel";
import { runTick, type Fetcher } from "../src/lib/feeds/runner.js";
import { reviveStore } from "../src/lib/feeds/store.js";
import { SPORTS } from "../src/lib/feeds/catalog.js";
import { MODEL_VERSION } from "../src/lib/feeds/performance.js";
import { notificationCounts } from "../src/lib/notification-events.js";
import { buildBoardPreview } from "../src/lib/feeds/preview.js";
import { buildFeed, updateRecord, predict } from "../src/lib/feeds/build.js";
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

function redact(message: string, k: ReturnType<typeof keys>) {
  for (const value of Object.values(k)) if (value) message = message.split(value).join('[redacted]');
  return message.replace(/(apiKey=)[^&\s]+/gi, '$1[redacted]').slice(0, 300);
}

function keys() {
  return {
    apiSports: process.env.API_SPORTS_KEY || process.env.API_FOOTBALL_KEY || "",
    oddsApi: process.env.THE_ODDS_API_KEY || "",
    oddspapi: process.env.ODDSPAPI_KEY || "",
  };
}

/** The metered network layer handed to the runner. */
function makeFetcher(k: ReturnType<typeof keys>): Fetcher {
  return async (provider, url) => {
    const u = new URL(url);
    if (!ALLOWED.has(u.host)) throw new Error(`Host not allowed: ${u.host}`);
    const headers: Record<string, string> = { accept: "application/json", "User-Agent": "PuntersEdge/1.0" };
    if (provider === "api-sports") headers["x-apisports-key"] = k.apiSports;
    else u.searchParams.set("apiKey", provider === "the-odds-api" ? k.oddsApi : k.oddspapi);
    const target = u.toString();
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
      if (res.status >= 400 && body && typeof body === 'object' && 'message' in body) {
        body = { ...body, message: redact(String((body as { message: unknown }).message), k) };
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
  previewVersion:string|null;
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
      (store as any).modelArtifacts = await ctx.runQuery(makeFunctionReference<'query'>('models:serving'),{});
      const lookups = (await readGz(ctx, state.lookupsId)) ?? {};
      const previousGames=structuredClone(store.games);

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

      const projectionChanges = updateRecord(store, now);
      const fixtureStates = Object.values(store.games).map((g:any)=>({fixtureId:g.uid,kickoff:g.kickoff,status:g.status.state,family:SPORTS[g.sport as keyof typeof SPORTS].family,...(Number.isFinite(g.status.home)&&Number.isFinite(g.status.away)?{score:{home:g.status.home,away:g.status.away,...(g.status.regHome!==undefined?{regHome:g.status.regHome}:{}),...(g.status.regAway!==undefined?{regAway:g.status.regAway}:{})}}:{})}));
      await ctx.runMutation(makeFunctionReference<'mutation'>('betslip:resolveSavedFixtures'),{states:fixtureStates});
      const usage = usageSummary(r.ledgers, now);
      const feed = buildFeed(store, now, usage);
      const { generatedAt, usage: _u, ...content } = feed;
      const version = createHash("sha1").update(JSON.stringify(content)).digest("hex").slice(0, 16);

      // Writes happen only when something changed.
      const storeId = r.storeChanged || projectionChanges.length || !state.storeId ? await ctx.storage.store(gz(store)) : undefined;
      const lookupsId = r.lookupsChanged ? await ctx.storage.store(gz(lookups)) : undefined;
      let feedArg;
      if (version !== state.feedVersion) {
        const feedId = await ctx.storage.store(gz(feed));
        const counts = Object.fromEntries(Object.entries(feed.inputs).map(([s, xs]) => [s, (xs as unknown[]).length]));
        feedArg = { storageId: feedId, version, generatedAt, counts: { ...counts, games: feed.games.length } };
      }
      const previewFeed=buildBoardPreview(feed,now);
      const {generatedAt:_previewTime,...previewContent}=previewFeed;
      const previewVersion=createHash('sha1').update(JSON.stringify(previewContent)).digest('hex').slice(0,16);
      const preview=previewVersion!==state.previewVersion?{storageId:await ctx.storage.store(gz(previewFeed)),version:previewVersion}:undefined;
      await ctx.runMutation(internal.feed.commit, { now, ledgers: r.ledgers, lastRun: r.lastRun, log: r.log, storeId, lookupsId, preview, feed: feedArg, usage, coverage:{fixtures:feed.games.length,projected:feed.projections.length,unavailable:feed.games.filter((g:any)=>!g.priced).length,pending:Object.values(store.record.pending).length,modelVersion:MODEL_VERSION} });
      // Archive only snapshots that have now been committed to the subscriber feed.
      for(let offset=0;offset<projectionChanges.length;offset+=10) {
        const storageIds=[];for(const p of projectionChanges.slice(offset,offset+10))storageIds.push(await ctx.storage.store(gz(p)));
        await ctx.scheduler.runAfter(0,makeFunctionReference<'action'>('performanceArchive:storeBatch'),{storageIds});
      }
      const events=notificationCounts(previousGames,store.games,now);
      for(const [event,count] of Object.entries(events))if(count>0)await ctx.scheduler.runAfter(0,makeFunctionReference<'action'>('notifications:deliver'),{event,count,batchId:`${now}:${event}`});
      return { ran: r.ran, skipped: r.skipped.length, log: r.log, feedUpdated: Boolean(feedArg) };
    } catch (err) {
      const msg = redact(err instanceof Error ? err.message : String(err), k);
      await ctx.runMutation(internal.feed.release, { ledgers, error: msg, now });
      throw err;
    }
  },
});

export const inspect = internalAction({args:{},handler:async(ctx):Promise<Record<string,unknown>>=>{
 const state=await ctx.runQuery(internal.feed.diagnosticState,{});
 if(!state.feed?.storageId)return {ready:false};
 const feed=await readGz(ctx,state.feed.storageId);
 const grades:Record<string,number>={},pricing:Record<string,number>={};
 for(const [sport,inputs] of Object.entries(feed?.inputs??{}))for(const input of inputs as any[])try{
  const projection=predict(sport as keyof typeof SPORTS,input,{});
  for(const group of projection.markets)for(const selection of group.selections){grades[selection.grade]=(grades[selection.grade]??0)+1;pricing[selection.pricing]=(pricing[selection.pricing]??0)+1;}
 }catch{}
 const unavailable=(feed?.games??[]).filter((g:any)=>!g.projected && ['scheduled','live'].includes(g.status.state));
 return {ready:true,grades,pricing,unavailable:unavailable.length,unavailableExamples:unavailable.slice(0,3).map((g:any)=>({id:g.id,reason:g.availabilityReason,sport:g.sport,league:g.league})),counts:state.feed.counts,generatedAt:state.feed.generatedAt,usage:state.feed.usage,sources:feed?.sources??{},games:feed?.games?.slice(0,3)??[],projections:feed?.projections?.slice(0,3)??[],projectedCount:feed?.projections?.length??0,reviewCount:Object.keys(feed?.reviewInputs??{}).length,lastTick:state.lastTick};
}});
