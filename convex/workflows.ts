import { mutation, query } from './_generated/server';
import { internal } from './_generated/api';
import { requireAdmin } from './access';

export const health = query({ args: {}, handler: async ctx => {
  await requireAdmin(ctx);
  const ingest = await ctx.db.query('feed_state').withIndex('by_key', q => q.eq('key', 'ingest')).unique();
  const feed = await ctx.db.query('feed_state').withIndex('by_key', q => q.eq('key', 'feed')).unique();
  const d = ingest?.data ?? {};
  return { locked: Number(d.lockUntil ?? 0) > Date.now(), lockUntil: d.lockUntil ?? null, lastTick: d.lastTick ?? null, lastError: d.lastError ?? null, lastErrorAt: d.lastErrorAt ?? null, lastLog: d.lastLog ?? [], usage: feed?.data?.usage ?? null, nextManualRefresh: Number(d.lastAdminRefresh ?? 0) + 5 * 60000 };
}});
export const refreshData = mutation({ args: {}, handler: async ctx => {
  await requireAdmin(ctx);
  const ingest = await ctx.db.query('feed_state').withIndex('by_key', q => q.eq('key', 'ingest')).unique();
  const d = ingest?.data ?? {}; const now = Date.now();
  if (Number(d.lockUntil ?? 0) > now) throw new Error('A data refresh is already running.');
  if (Number(d.lastAdminRefresh ?? 0) + 5 * 60000 > now) throw new Error('Manual refresh is available once every five minutes.');
  if (ingest) await ctx.db.patch(ingest._id, { data: { ...d, lastAdminRefresh: now } });
  else await ctx.db.insert('feed_state', { key: 'ingest', data: { lastAdminRefresh: now } });
  await ctx.scheduler.runAfter(0, internal.ingest.tick, {});
  return { scheduled: true };
}});
