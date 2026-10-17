import { requireSubscription } from "./access";
import { getCurrentUser } from "./auth";
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const item = v.object({
  marketKey: v.optional(v.string()),
  fixtureId: v.string(),
  sport: v.string(),
  matchTitle: v.string(),
 league:v.optional(v.string()),country:v.optional(v.string()),
  market: v.string(),
  selection: v.string(),
  bookmaker: v.string(),
  odds: v.number(),
  modelProb: v.optional(v.number()),
  pushProb: v.optional(v.number()),
  edgePercent: v.number(),
});

/** The signed-in user's saved slip. The user is taken from the session, never from arguments. */
export const mine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireSubscription(ctx);
    if (userId === null) return null;
    return await ctx.db
      .query("user_betslips")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
  },
});

export const save = mutation({
  args: { items: v.array(item), stake: v.number(), betType: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireSubscription(ctx);
    if (userId === null) throw new Error("Sign in to sync your slip.");
    if(!Number.isFinite(args.stake)||args.stake<0||args.stake>1e9)throw new Error('Enter a valid stake.');
    if(args.items.some(s=>!Number.isFinite(s.odds)||s.odds<=1||s.odds>10000||(s.modelProb!==undefined&&(!Number.isFinite(s.modelProb)||s.modelProb<0||s.modelProb>1))||(s.pushProb!==undefined&&(!Number.isFinite(s.pushProb)||s.pushProb<0||s.pushProb>=1))))throw new Error('Selections need valid odds and probabilities.');
    if (args.items.length > 30) throw new Error("A slip can hold at most 30 selections.");

    const totalOdds = Math.round(args.items.reduce((acc, i) => acc * i.odds, 1) * 100) / 100;
    const doc = {
      userId,
      items: args.items,
      stake: Math.max(0, args.stake),
      betType: args.betType,
      totalOdds,
      potentialReturn: Math.round(args.stake * totalOdds * 100) / 100,
      safetyScore: args.items.length <= 1 ? 100 : Math.max(10, Math.round(100 - (args.items.length - 1) * 18.5)),
      status: "draft",
    };

    const existing = await ctx.db
      .query("user_betslips")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, doc);
      return existing._id;
    }
    return await ctx.db.insert("user_betslips", doc);
  },
});

// Separate saved histories never overwrite the synchronized working draft.
import { internal } from './_generated/api';
import { internalMutation } from './_generated/server';
import type { Doc } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { itemOutcome, slipOutcome } from '../src/lib/slips.js';

const fixtureState = v.object({
  fixtureId: v.string(), kickoff: v.number(), status: v.string(), family: v.string(),
  score: v.optional(v.union(v.null(), v.object({ home: v.number(), away: v.number(), regHome: v.optional(v.number()), regAway: v.optional(v.number()) }))),
});
type State = { fixtureId: string; kickoff: number; status: string; family: string; score?: { home: number; away: number; regHome?: number; regAway?: number } | null };
async function fixtureStates(ctx: QueryCtx | MutationCtx, ids: string[]): Promise<State[]> {
  const unique = [...new Set(ids)];
  const groups: string[][] = [];
  for (let index = 0; index < unique.length; index += 100) groups.push(unique.slice(index, index + 100));
  const results = await Promise.all(groups.map(ids => ctx.runQuery(internal.performance.fixtureStates, { ids })));
  return results.flat();
}
function invalidInput(args: { name: string; stake: number; items: typeof item.type[] }) {
  if (!args.name.trim() || args.name.length > 80) throw new Error('Use a slip name from 1 to 80 characters.');
  if (!Number.isFinite(args.stake) || args.stake < 0 || args.stake > 1e9) throw new Error('Enter a valid stake.');
  if(args.items.some(s=>(s.modelProb!==undefined&&(!Number.isFinite(s.modelProb)||s.modelProb<0||s.modelProb>1))||(s.pushProb!==undefined&&(!Number.isFinite(s.pushProb)||s.pushProb<0||s.pushProb>=1))))throw new Error('Selections need valid probabilities.');
  if (!args.items.length || args.items.length > 30) throw new Error('Save between 1 and 30 selections.');
  if (args.items.some(selection => !Number.isFinite(selection.odds) || selection.odds <= 1 || selection.odds > 10000)) throw new Error('Each selection needs valid decimal odds greater than 1.');
  if (new Set(args.items.map(selection => `${selection.fixtureId}:${selection.marketKey ?? selection.market}:${selection.selection}`)).size !== args.items.length) throw new Error('Remove duplicate selections.');
}
async function owner(ctx: MutationCtx, id: Doc<'saved_slips'>['_id']) {
  const userId = await requireSubscription(ctx);
  if (!userId) throw new Error('Sign in to manage your slips.');
  const slip = await ctx.db.get(id);
  if (!slip || slip.userId !== userId) throw new Error('Saved slip not found.');
  return slip;
}
function decorate(selections: typeof item.type[], states: State[]) {
  const lookup = new Map(states.map(state => [state.fixtureId, state]));
  return selections.map(selection => {
    const state = lookup.get(selection.fixtureId);
    if (!state || !Number.isFinite(state.kickoff)) throw new Error('A fixture could not be verified against the live schedule. Refresh and try again.');
    return { ...selection, kickoff: state.kickoff, fixtureStatus: state.status, family: state.family, ...(state.score ? { score: state.score } : {}) };
  });
}
function isFinal(selection: { fixtureStatus?: string }) { return selection.fixtureStatus === 'finished' || selection.fixtureStatus === 'cancelled'; }
function completed(selections: { fixtureStatus?: string }[]) { return selections.length > 0 && selections.every(isFinal); }
function selectionFingerprint(selection: typeof item.type) { return JSON.stringify([selection.fixtureId, selection.sport, selection.matchTitle, selection.market, selection.selection, selection.bookmaker, selection.odds, selection.modelProb ?? null, selection.pushProb ?? 0, selection.edgePercent, selection.marketKey ?? null]); }
function economics(items: typeof item.type[], stake: number, betType: 'acca' | 'singles') {
  const totalOdds = Math.round(items.reduce((total, selection) => total * selection.odds, 1) * 100) / 100;
  const potentialReturn = Math.round(stake * (betType === 'acca' ? totalOdds : items.reduce((total, selection) => total + selection.odds, 0)) * 100) / 100;
  if (!Number.isFinite(totalOdds) || !Number.isFinite(potentialReturn)) throw new Error('Combined odds are too large.');
  return { totalOdds, potentialReturn };
}

export const history = query({ args: {}, handler: async ctx => {
  const userId = await requireSubscription(ctx);
  if (!userId) return [];
  const slips = await ctx.db.query('saved_slips').withIndex('by_user', q => q.eq('userId', userId)).order('desc').take(100);
  // Archived fixture state is authoritative; completed scores are also stored
  // inside the slip so results survive archive retention.
  const states: State[] = await fixtureStates(ctx, slips.flatMap(slip => slip.items.map(selection => selection.fixtureId)));
  const lookup = new Map(states.map(state => [state.fixtureId, state]));
  return slips.map(slip => {
    const items = slip.items.map(selection => {
      const state = lookup.get(selection.fixtureId);
      const merged = state && (!isFinal(selection) || ['finished','cancelled'].includes(state.status)) ? { ...selection, kickoff: state.kickoff, fixtureStatus: state.status, ...(state.score ? { score: state.score } : {}) } : selection;
      return { ...merged, result: itemOutcome(merged) };
    });
    return { ...slip, items, locked: completed(items), outcome: slipOutcome(items, slip.betType) };
  });
}});
export const saveHistory = mutation({
  args: { name: v.string(), items: v.array(item), stake: v.number(), betType: v.union(v.literal('acca'), v.literal('singles')) },
  handler: async (ctx, args) => {
    const userId = await requireSubscription(ctx);
    if (!userId) throw new Error('Sign in to save a slip.');
    invalidInput(args);
    const existing = await ctx.db.query('saved_slips').withIndex('by_user', q => q.eq('userId', userId)).take(100);
    if (existing.length >= 100) throw new Error('Your history holds 100 slips. Delete an old slip before saving another.');
    const states: State[] = await fixtureStates(ctx, args.items.map(selection => selection.fixtureId));
    const items = decorate(args.items, states);
    if (items.some(isFinal)) throw new Error('A fixture has finished or been cancelled. Save selections before completion.');
    const id=await ctx.db.insert('saved_slips', { ...args, name: args.name.trim(), userId, items, ...economics(items, args.stake, args.betType), updatedAt: Date.now(), locked: false, awaitingResults: true });
    await ctx.scheduler.runAfter(0,internal.notifications.deliver,{count:1,event:'activities',targetUserId:userId,activity:'ticketSaved',batchId:`ticket:${id}`});
    return id;
  },
});
export const updateHistory = mutation({
  args: { id: v.id('saved_slips'), name: v.string(), items: v.array(item), stake: v.number(), betType: v.union(v.literal('acca'), v.literal('singles')) },
  handler: async (ctx, args) => {
    const slip = await owner(ctx, args.id);
    const oldStates: State[] = await fixtureStates(ctx, slip.items.map(selection => selection.fixtureId));
    const oldLookup = new Map(oldStates.map(state => [state.fixtureId, state]));
    if (slip.items.some(selection => !isFinal(selection) && !oldLookup.has(selection.fixtureId))) throw new Error('A saved fixture could not be verified. This slip cannot be edited.');
    const resolvedOld = slip.items.map(selection => {
      const latest = oldLookup.get(selection.fixtureId);
      if (!latest || (isFinal(selection) && !['finished','cancelled'].includes(latest.status))) return selection;
      return { ...selection, kickoff: latest.kickoff, fixtureStatus: latest.status, ...(latest.score ? { score: latest.score } : {}) };
    });
    if (completed(resolvedOld)) throw new Error('This slip is locked because all selections have finished or been cancelled.');
    invalidInput(args);
    const finalSelections = resolvedOld.filter(isFinal);
    const finalByFingerprint = new Map(finalSelections.map(selection => [selectionFingerprint(selection), selection]));
    for (const selection of finalSelections) {
      if (!args.items.some(candidate => selectionFingerprint(candidate) === selectionFingerprint(selection))) throw new Error('Finished or cancelled selections cannot be removed or altered.');
    }
    const activeInput = args.items.filter(selection => !finalByFingerprint.has(selectionFingerprint(selection)));
    const states: State[] = await fixtureStates(ctx, activeInput.map(selection => selection.fixtureId));
    const activeItems = decorate(activeInput, states);
    if (activeItems.some(isFinal)) throw new Error('New selections must not be finished or cancelled.');
    const activeByFingerprint = new Map(activeItems.map(selection => [selectionFingerprint(selection), selection]));
    const items = args.items.map(selection => finalByFingerprint.get(selectionFingerprint(selection)) ?? activeByFingerprint.get(selectionFingerprint(selection))!);
    await ctx.db.patch(args.id, { name: args.name.trim(), items, stake: args.stake, betType: args.betType, ...economics(items, args.stake, args.betType), updatedAt: Date.now() });
  },
});
export const deleteHistory = mutation({ args: { id: v.id('saved_slips') }, handler: async (ctx, args) => {
  await owner(ctx, args.id); await ctx.db.delete(args.id);
}});

/** Called by ingest; settled selections survive fixture archive cleanup. */
export const resolveSavedFixtures = internalMutation({ args: { states: v.array(fixtureState), cursor: v.optional(v.string()) }, handler: async (ctx, args): Promise<number> => {
  const states = new Map(args.states.map(state => [state.fixtureId, state]));
  const page = await ctx.db.query('saved_slips').withIndex('by_awaiting_results', q => q.eq('awaitingResults', true)).paginate({ numItems: 100, cursor: args.cursor ?? null });
  const slips = page.page;
  let updated = 0;
  for (const slip of slips) {
    let changed = false;
    const items = slip.items.map(selection => {
      const state = states.get(selection.fixtureId);
      if (!state || (isFinal(selection) && !['finished','cancelled'].includes(state.status))) return selection;
      const next = { ...selection, kickoff: state.kickoff, fixtureStatus: state.status, ...(state.score ? { score: state.score } : {}) };
      if (JSON.stringify(next) !== JSON.stringify(selection)) changed = true;
      return next;
    });
    const locked = completed(items);
    const awaitingResults = items.some(selection => !['finished', 'cancelled'].includes(selection.fixtureStatus ?? ''));
    if (changed || slip.locked !== locked || slip.awaitingResults !== awaitingResults) { await ctx.db.patch(slip._id, { items, locked, awaitingResults, updatedAt: Date.now() }); updated++; }
  }
  if (!page.isDone) await ctx.scheduler.runAfter(0, internal.betslip.resolveSavedFixtures, { states: args.states, cursor: page.continueCursor });
  return updated;
}});
