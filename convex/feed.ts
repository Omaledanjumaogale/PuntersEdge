/**
 * Live feed state: the public `meta` query the app subscribes to, and the
 * internal mutations the ingest action uses to claim a tick, reserve quota
 * and commit results. Everything here touches at most two small documents.
 */
import { query, internalQuery, internalMutation, type MutationCtx } from "./_generated/server";
import { requireSubscription } from "./access";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

const LOCK_MS = 18 * 60_000;

async function getDoc(ctx: MutationCtx, key: string) {
  return await ctx.db
    .query("feed_state")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
}

async function putDoc(ctx: MutationCtx, key: string, data: Record<string, unknown>) {
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
    if (!doc?.data?.storageId&&!doc?.data?.blobKey) return null;
    const d = doc.data;
    return {
      url: d.blobKey?null:await ctx.storage.getUrl(d.storageId as Id<"_storage">),
      blobKey:d.blobKey??null,
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
 if(!doc?.data?.storageId&&!doc?.data?.blobKey)return null;
 return {blobKey:doc.data.blobKey??null,url:'/api/feed',version:doc.data.version as string,generatedAt:doc.data.generatedAt as string,encoding:'gzip',counts:doc.data.counts??null,usage:null,checkedAt:doc.data.checkedAt??doc.data.generatedAt};
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
      ledgers: (await getDoc(ctx,"quota"))?.data?.ledgers ?? d.ledgers ?? {},
      lastRun: d.lastRun ?? {},
      storeKey:d.storeKey??null,lookupsKey:d.lookupsKey??null,feedKey:d.feedKey??null,previewKey:d.previewKey??null,pendingArchiveKey:d.pendingArchiveKey??null,
      storeUrl:d.storeKey?null:d.storeId?await ctx.storage.getUrl(d.storeId):null,lookupsUrl:d.lookupsKey?null:d.lookupsId?await ctx.storage.getUrl(d.lookupsId):null,
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
    await putDoc(ctx, "quota", { ledgers });
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
    if(ledgers)await putDoc(ctx,"quota",{ledgers});
    await putDoc(ctx, "ingest", { lockUntil: 0, lastError: error.slice(0, 300), lastErrorAt: now });
  },
});

/** Deploy-key-only functional diagnostics, never exposed as a public feed URL. */
export const diagnosticState = internalQuery({args:{},handler:async(ctx)=>{
 const feed=await ctx.db.query('feed_state').withIndex('by_key',q=>q.eq('key','feed')).unique();
 const ingest=await ctx.db.query('feed_state').withIndex('by_key',q=>q.eq('key','ingest')).unique();
 return {feed:feed?.data??null,lastTick:ingest?.data?.lastTick??null};
}});

/** R2 ingest commits small pointers. No blob bytes are returned or stored in Convex. */
export const commitEdge=internalMutation({args:{now:v.number(),ledgers:v.any(),lastRun:v.any(),log:v.array(v.string()),storeKey:v.string(),lookupsKey:v.string(),feedKey:v.string(),version:v.string(),generatedAt:v.string(),previewKey:v.string(),previewVersion:v.string(),counts:v.any(),usage:v.any(),coverage:v.any(),pendingArchiveKey:v.optional(v.string()),migrationBackupKey:v.optional(v.string())},handler:async(ctx,args)=>{
 for(const key of [args.storeKey,args.lookupsKey,args.feedKey,args.previewKey,...(args.pendingArchiveKey?[args.pendingArchiveKey]:[])])if(!/^(state|feed|preview|outbox)\/[a-f0-9]+\.gz$/.test(key))throw new Error('Invalid R2 pointer');
 const ingest=await getDoc(ctx,'ingest'),d={...(ingest?.data??{})};delete d.ledgers;
 const values={...d,storeKey:args.storeKey,lookupsKey:args.lookupsKey,feedKey:args.feedKey,previewKey:args.previewKey,feedVersion:args.version,previewVersion:args.previewVersion,lastRun:args.lastRun,lastTick:args.now,lastLog:args.log.slice(0,20),lastError:null,lastErrorAt:null,...(args.pendingArchiveKey?{pendingArchiveKey:args.pendingArchiveKey}:{}),...(args.migrationBackupKey?{migrationBackupKey:args.migrationBackupKey}:{})};
 if(ingest)await ctx.db.patch(ingest._id,{data:values});else await ctx.db.insert('feed_state',{key:'ingest',data:values});
 await putDoc(ctx,'quota',{ledgers:args.ledgers});
 const old=await getDoc(ctx,'feed');
 if(old?.data?.version!==args.version||old?.data?.blobKey!==args.feedKey)await putDoc(ctx,'feed',{blobKey:args.feedKey,version:args.version,generatedAt:args.generatedAt,encoding:'gzip',counts:args.counts,coverage:args.coverage,checkedAt:args.generatedAt});
 // Keep provider quota updates separate from the document subscribed to by every viewer.
 await putDoc(ctx,'operations',{usage:args.usage,coverage:args.coverage,checkedAt:new Date(args.now).toISOString()});
}});
export const ackArchive=internalMutation({args:{key:v.string()},handler:async(ctx,{key})=>{const doc=await getDoc(ctx,'ingest');if(doc?.data?.pendingArchiveKey===key){const data={...doc.data};delete data.pendingArchiveKey;await ctx.db.patch(doc._id,{data});}}});
export const completeEdge=internalMutation({args:{},handler:async ctx=>{await putDoc(ctx,'ingest',{lockUntil:0});}});
