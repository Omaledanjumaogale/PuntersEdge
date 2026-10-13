/**
 * Live feed state: the public `meta` query the app subscribes to, and the
 * internal mutations the ingest action uses to claim a tick, reserve quota
 * and commit results. Everything here touches at most two small documents.
 */
import { query, internalQuery, internalMutation, type MutationCtx } from "./_generated/server";
import { requireSubscription } from "./access";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

const LOCK_MS = 9 * 60_000;

async function getDoc(ctx: MutationCtx, key: "ingest" | "feed") {
  return await ctx.db
    .query("feed_state")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
}

async function putDoc(ctx: MutationCtx, key: "ingest" | "feed", data: Record<string, unknown>) {
  const doc = await getDoc(ctx, key);
  if (doc) await ctx.db.patch(doc._id, { data: { ...doc.data, ...data } });
  else await ctx.db.insert("feed_state", { key, data });
}

/** What the app needs to load the latest feed file, plus quota usage. */
export const storageMeta = internalQuery({
  args: {},
  handler: async (ctx) => {
    await requireSubscription(ctx);
    const doc = await ctx.db
      .query("feed_state")
      .withIndex("by_key", (q) => q.eq("key", "feed"))
      .unique();
    if (!doc?.data?.storageId) return null;
    const d = doc.data;
    return {
      url: await ctx.storage.getUrl(d.storageId as Id<"_storage">),
      version: d.version as string,
      generatedAt: d.generatedAt as string,
      encoding: (d.encoding as string) ?? "gzip",
      counts: d.counts ?? null,
      usage: null,
      checkedAt: (d.checkedAt as string) ?? d.generatedAt,
    };
  },
});

export const meta = query({args:{},handler:async(ctx)=>{
 await requireSubscription(ctx);
 const doc=await ctx.db.query('feed_state').withIndex('by_key',q=>q.eq('key','feed')).unique();
 if(!doc?.data?.storageId)return null;
 return {url:'/api/feed',version:doc.data.version as string,generatedAt:doc.data.generatedAt as string,encoding:'gzip',counts:doc.data.counts??null,usage:null,checkedAt:doc.data.checkedAt??doc.data.generatedAt};
}});

export const previewStorageMeta=internalQuery({args:{},handler:async(ctx)=>{
 const doc=await ctx.db.query('feed_state').withIndex('by_key',q=>q.eq('key','feed')).unique();
 if(!doc?.data?.previewStorageId)return null;
 return {url:await ctx.storage.getUrl(doc.data.previewStorageId as Id<'_storage'>),version:doc.data.previewVersion};
}});

/** Take the ingest lock and return state; null when another tick is running. */
export const claim = internalMutation({
  args: { now: v.number() },
  handler: async (ctx, { now }) => {
    const doc = await getDoc(ctx, "ingest");
    const d = doc?.data ?? {};
    if (d.lockUntil && d.lockUntil > now) return null;
    await putDoc(ctx, "ingest", { lockUntil: now + LOCK_MS });
    return {
      ledgers: d.ledgers ?? {},
      lastRun: d.lastRun ?? {},
      storeId: (d.storeId as Id<"_storage"> | undefined) ?? null,
      lookupsId: (d.lookupsId as Id<"_storage"> | undefined) ?? null,
      previewVersion: (d.previewVersion as string|undefined)??null,
      feedVersion: (d.feedVersion as string | undefined) ?? null,
    };
  },
});

/** Persist planned spend before any call goes out. */
export const reserve = internalMutation({
  args: { ledgers: v.any() },
  handler: async (ctx, { ledgers }) => {
    await putDoc(ctx, "ingest", { ledgers });
  },
});

/** Save the tick's results, swap file ids and release the lock. */
export const commit = internalMutation({
  args: {
    now: v.number(),
    ledgers: v.any(),
    lastRun: v.any(),
    log: v.array(v.string()),
    storeId: v.optional(v.id("_storage")),
    lookupsId: v.optional(v.id("_storage")),
    feed: v.optional(
      v.object({
        storageId: v.id("_storage"),
        version: v.string(),
        generatedAt: v.string(),
        counts: v.any(),
      })
    ),
    preview:v.optional(v.object({storageId:v.id("_storage"),version:v.string()})),
    usage: v.any(),
    coverage: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const ingest = (await getDoc(ctx, "ingest"))?.data ?? {};
    const patch: Record<string, unknown> = {
      ledgers: args.ledgers,
      lastRun: args.lastRun,
      lockUntil: 0,
      lastTick: args.now,
      lastLog: args.log.slice(0, 20),
      lastError: null,
      lastErrorAt: null,
    };
    if (args.storeId) {
      if (ingest.storeId && ingest.storeId !== args.storeId) await ctx.storage.delete(ingest.storeId);
      patch.storeId = args.storeId;
    }
    if (args.lookupsId) {
      if (ingest.lookupsId && ingest.lookupsId !== args.lookupsId) await ctx.storage.delete(ingest.lookupsId);
      patch.lookupsId = args.lookupsId;
    }
    const feedDoc = (await getDoc(ctx, "feed"))?.data ?? {};
    if (args.feed) {
      if (feedDoc.storageId && feedDoc.storageId !== args.feed.storageId) await ctx.storage.delete(feedDoc.storageId);
      patch.feedVersion = args.feed.version;
      await putDoc(ctx, "feed", { ...args.feed, encoding: "gzip", usage: args.usage,
      ...(args.coverage ? {coverage:args.coverage} : {}), checkedAt: new Date(args.now).toISOString() });
    } else if (feedDoc.storageId) {
      // Content unchanged: only refresh the quota panel (one small patch).
      await putDoc(ctx, "feed", { usage: args.usage,
      ...(args.coverage ? {coverage:args.coverage} : {}), checkedAt: new Date(args.now).toISOString() });
    }
    if(args.preview){
      if(feedDoc.previewStorageId&&feedDoc.previewStorageId!==args.preview.storageId)await ctx.storage.delete(feedDoc.previewStorageId);
      await putDoc(ctx,'feed',{previewStorageId:args.preview.storageId,previewVersion:args.preview.version});
      patch.previewVersion=args.preview.version;
    }
    await putDoc(ctx, "ingest", patch);
  },
});

/** Release the lock after a failed tick, keeping any spend recorded so far. */
export const release = internalMutation({
  args: { ledgers: v.optional(v.any()), error: v.string(), now: v.number() },
  handler: async (ctx, { ledgers, error, now }) => {
    await putDoc(ctx, "ingest", { lockUntil: 0, lastError: error.slice(0, 300), lastErrorAt: now, ...(ledgers ? { ledgers } : {}) });
  },
});

/** Deploy-key-only functional diagnostics, never exposed as a public feed URL. */
export const diagnosticState = internalQuery({args:{},handler:async(ctx)=>{
 const feed=await ctx.db.query('feed_state').withIndex('by_key',q=>q.eq('key','feed')).unique();
 const ingest=await ctx.db.query('feed_state').withIndex('by_key',q=>q.eq('key','ingest')).unique();
 return {feed:feed?.data??null,lastTick:ingest?.data?.lastTick??null};
}});
