import {registerAuth} from './auth-component';
import { describe, expect, it, afterEach, vi } from 'vitest';
import { convexTest } from 'convex-test';
import betterAuth from '@convex-dev/better-auth/test';
import { componentsGeneric, anyApi } from 'convex/server';
import schema from '../../convex/schema';
const modules = import.meta.glob('../../convex/**/*.ts');
const create = () => { const t = convexTest(schema, modules); registerAuth(t); return t; };
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });
async function member(t:ReturnType<typeof create>,email:string) {
 const component=componentsGeneric().betterAuth;
 const user=await t.mutation(component.adapter.create,{input:{model:'user',data:{name:'Member',email,emailVerified:true,createdAt:Date.now(),updatedAt:Date.now()}}});
 const session=await t.mutation(component.adapter.create,{input:{model:'session',data:{userId:user._id,token:crypto.randomUUID(),expiresAt:Date.now()+86400000,createdAt:Date.now(),updatedAt:Date.now()}}});
 const signed=t.withIdentity({subject:user._id,sessionId:session._id});
 const id=await signed.mutation(anyApi.users.syncProfile,{});await t.run(async ctx=>ctx.db.insert('subscriptions',{userId:id,expiresAt:Date.now()+86400000,updatedAt:Date.now()})); return signed;
}
async function fixture(t:ReturnType<typeof create>,id='fixture-a',kickoff=Date.now()+3600000) {
 return t.run(async ctx=>{
  const storageId=await ctx.storage.store(new Blob(['snapshot']));
  return ctx.db.insert('projection_snapshots',{fixtureId:id,sport:'football',family:'football',match:'Home v Away',league:'League',kickoff,publishedAt:Date.now(),modelVersion:'test',state:'scheduled',storageId,fingerprint:id,contributions:{},recent:[]});
 });
}
const selection=(fixtureId='fixture-a')=>({fixtureId,sport:'football',matchTitle:'Home v Away',market:'Match result',selection:'Home Win',bookmaker:'Book',odds:2.1,edgePercent:5,marketKey:'home'});
const input=(fixtureId='fixture-a')=>({name:'Weekend',items:[selection(fixtureId)],stake:1000,betType:'acca' as const});
describe('saved betslip ownership, final-state locks and retained results',()=>{
 it('keeps histories separate from the working draft and scoped to the signed-in owner',async()=>{
  const t=create(),alice=await member(t,'alice@example.test'),bob=await member(t,'bob@example.test');await fixture(t);
  await alice.mutation(anyApi.betslip.save,{items:[selection()],stake:500,betType:'single'});
  const first=await alice.mutation(anyApi.betslip.saveHistory,input());
  await alice.mutation(anyApi.betslip.saveHistory,{...input(),name:'Second slip'});
  expect((await alice.query(anyApi.betslip.history,{}))).toHaveLength(2);
  expect((await bob.query(anyApi.betslip.history,{}))).toEqual([]);
  expect((await alice.query(anyApi.betslip.mine,{}))?.stake).toBe(500);
  await expect(bob.mutation(anyApi.betslip.updateHistory,{...input(),id:first})).rejects.toThrow('not found');
  await expect(bob.mutation(anyApi.betslip.deleteHistory,{id:first})).rejects.toThrow('not found');
  await expect(t.mutation(anyApi.betslip.saveHistory,input())).rejects.toThrow('Sign in');
 });
 it('rejects unknown fixtures and allows personal edits after kickoff until a fixture finishes',async()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-12T12:00:00Z'));
  const t=create(),alice=await member(t,'alice@example.test');const snapshot=await fixture(t);
  await expect(alice.mutation(anyApi.betslip.saveHistory,input('unknown'))).rejects.toThrow('verified');
  const id=await alice.mutation(anyApi.betslip.saveHistory,input());
  await alice.mutation(anyApi.betslip.updateHistory,{...input(),id,name:'Edited'});
  vi.setSystemTime(new Date('2026-10-12T13:01:00Z'));
  await alice.mutation(anyApi.betslip.updateHistory,{...input(),id,name:'Edited after kickoff'});
  await alice.mutation(anyApi.betslip.saveHistory,{...input(),name:'Created after kickoff'});
  expect((await alice.query(anyApi.betslip.history,{}))[0].locked).toBe(false);
  await t.run(ctx=>ctx.db.patch(snapshot,{state:'finished',score:{home:2,away:1}}));
  await expect(alice.mutation(anyApi.betslip.updateHistory,{...input(),id})).rejects.toThrow('locked');
  await expect(alice.mutation(anyApi.betslip.saveHistory,input())).rejects.toThrow('finished');
 });
 it('allows live editing but locks authoritative cancelled fixtures',async()=>{
  const t=create(),alice=await member(t,'alice@example.test');const snapshot=await fixture(t);
  const id=await alice.mutation(anyApi.betslip.saveHistory,input());
  await t.run(ctx=>ctx.db.patch(snapshot,{state:'live'}));
  await alice.mutation(anyApi.betslip.updateHistory,{...input(),id,name:'Edited live'});
  await t.run(ctx=>ctx.db.patch(snapshot,{state:'cancelled'}));
  await expect(alice.mutation(anyApi.betslip.updateHistory,{...input(),id})).rejects.toThrow('locked');
 });
 it('preserves finished legs while allowing unfinished edits, and locks only when all legs finish',async()=>{
  const t=create(),alice=await member(t,'alice@example.test');await fixture(t);const second=await fixture(t,'fixture-b');
  const original={...input(),items:[selection('fixture-a'),selection('fixture-b')]};
  const id=await alice.mutation(anyApi.betslip.saveHistory,original);
  await t.mutation(anyApi.betslip.resolveSavedFixtures,{states:[{fixtureId:'fixture-a',kickoff:Date.now()-60000,status:'finished',family:'football',score:{home:2,away:1}}]});
  const before=await t.run(ctx=>ctx.db.get(id));
  expect((await alice.query(anyApi.betslip.history,{}))[0].locked).toBe(false);
  await alice.mutation(anyApi.betslip.updateHistory,{...original,id,items:[selection('fixture-a'),{...selection('fixture-b'),odds:2.4}]});
  expect((await t.run(ctx=>ctx.db.get(id)))?.items[0]).toEqual(before?.items[0]);
  await expect(alice.mutation(anyApi.betslip.updateHistory,{...original,id,items:[selection('fixture-b')]})).rejects.toThrow('cannot be removed');
  await expect(alice.mutation(anyApi.betslip.updateHistory,{...original,id,items:[{...selection('fixture-a'),odds:3},selection('fixture-b')]})).rejects.toThrow('cannot be removed');
  await t.run(ctx=>ctx.db.patch(second,{state:'finished',score:{home:1,away:0}}));
  expect((await alice.query(anyApi.betslip.history,{}))[0].locked).toBe(true);
  await expect(alice.mutation(anyApi.betslip.updateHistory,{...original,id})).rejects.toThrow('locked');
 });
 it('overlays corrected final scores and preserves corrected final legs during unfinished edits',async()=>{
  const t=create(),alice=await member(t,'alice@example.test');const first=await fixture(t);const second=await fixture(t,'fixture-b');
  const original={...input(),items:[selection('fixture-a'),selection('fixture-b')]};
  const id=await alice.mutation(anyApi.betslip.saveHistory,original);
  await t.mutation(anyApi.betslip.resolveSavedFixtures,{states:[{fixtureId:'fixture-a',kickoff:Date.now()-60000,status:'finished',family:'football',score:{home:2,away:1}}]});
  await t.run(ctx=>ctx.db.patch(first,{state:'finished',score:{home:1,away:2}}));
  let [saved]=await alice.query(anyApi.betslip.history,{});
  expect(saved.items[0].score).toEqual({home:1,away:2});expect(saved.items[0].result).toBe('lost');
  await alice.mutation(anyApi.betslip.updateHistory,{...original,id,name:'Corrected score'});
  expect((await t.run(ctx=>ctx.db.get(id)))?.items[0].score).toEqual({home:1,away:2});
  await t.run(ctx=>ctx.db.patch(second,{state:'finished',score:{home:2,away:0}}));
  await t.mutation(anyApi.betslip.resolveSavedFixtures,{states:[{fixtureId:'fixture-b',kickoff:Date.now()-60000,status:'finished',family:'football',score:{home:2,away:0}}]});
  await t.run(ctx=>ctx.db.patch(first,{state:'finished',score:{home:3,away:3,regHome:1,regAway:1}}));
  [saved]=await alice.query(anyApi.betslip.history,{});
  expect(saved.items[0].score).toEqual({home:3,away:3,regHome:1,regAway:1});expect(saved.locked).toBe(true);
 });
 it('retains final scores after fixture archive cleanup and skips unchanged writes',async()=>{
  const t=create(),alice=await member(t,'alice@example.test');const snapshot=await fixture(t);
  const id=await alice.mutation(anyApi.betslip.saveHistory,input());
  const states=[{fixtureId:'fixture-a',kickoff:Date.now()-60000,status:'finished',family:'football',score:{home:2,away:1}}];
  expect(await t.mutation(anyApi.betslip.resolveSavedFixtures,{states})).toBe(1);
  expect(await t.mutation(anyApi.betslip.resolveSavedFixtures,{states})).toBe(0);
  await t.run(ctx=>ctx.db.delete(snapshot));
  const [saved]=await alice.query(anyApi.betslip.history,{});
  expect(saved.items[0].score).toEqual({home:2,away:1});expect(saved.items[0].result).toBe('won');expect(saved.outcome).toBe('won');
  await alice.mutation(anyApi.betslip.deleteHistory,{id});expect(await alice.query(anyApi.betslip.history,{})).toEqual([]);
 });
});

 it('saves unpriced selections and calculates only the quoted subset in draft and history',async()=>{
  const t=create(),alice=await member(t,'unpriced@example.test');await fixture(t);await fixture(t,'fixture-b');
  const items=[selection(),{...selection('fixture-b'),bookmaker:'Unpriced selection',odds:0}];
  await alice.mutation(anyApi.betslip.save,{items,stake:100,betType:'acca'});
  const draft=await alice.query(anyApi.betslip.mine,{});expect(draft?.items).toHaveLength(2);expect(draft?.totalOdds).toBe(2.1);expect(draft?.potentialReturn).toBe(210);
  const id=await alice.mutation(anyApi.betslip.saveHistory,{...input(),items,stake:100});
  const saved=await t.run(ctx=>ctx.db.get(id));expect(saved?.items[1].odds).toBe(0);expect(saved?.totalOdds).toBe(2.1);
  await expect(alice.mutation(anyApi.betslip.save,{items:[{...selection(),odds:1}],stake:100,betType:'acca'})).rejects.toThrow('valid odds');
 });

it('persists experimental tennis picks without inventing odds, payout or a settled result',async()=>{
 const t=create(),signed=await member(t,'tennis-slip@example.test');
 const pick={...selection('tennis-oddsapi-provider-id'),sport:'tennis',market:'Match winner',selection:'Player A',marketKey:'match_winner:a',bookmaker:'Unpriced experimental estimate',odds:0,modelProb:.65,edgePercent:0};
 await signed.mutation(anyApi.betslip.save,{items:[pick],stake:1000,betType:'single'});
 expect(await signed.query(anyApi.betslip.mine,{})).toMatchObject({items:[{sport:'tennis',odds:0}],totalOdds:0,potentialReturn:0});
 await expect(signed.mutation(anyApi.betslip.saveHistory,{name:'Unverified tennis',items:[pick],stake:1000,betType:'acca'})).rejects.toThrow('could not be verified');
 await t.mutation(anyApi.tennisSchedule.publish,{at:Date.now(),fixtures:[{id:'tennis-oddsapi-provider-id',kickoff:Date.now()+3600000}]});
 const id=await signed.mutation(anyApi.betslip.saveHistory,{name:'Tennis review',items:[pick],stake:1000,betType:'acca'});
 const saved=await t.run(ctx=>ctx.db.get(id));expect(saved).toMatchObject({items:[{sport:'tennis',odds:0}],totalOdds:0,potentialReturn:0});
});

it('backfills known competition metadata on legacy histories and preserves it when edited',async()=>{
 const t=create(),signed=await member(t,'metadata@example.test');const fid=await fixture(t);
 await t.run(ctx=>ctx.db.patch(fid,{league:'Premier League',country:'England',tournament:'League season'}));
 const id=await signed.mutation(anyApi.betslip.saveHistory,input());
 let history=await signed.query(anyApi.betslip.history,{});expect(history[0].items[0]).toMatchObject({sport:'football',league:'Premier League',country:'England',tournament:'League season'});
 await signed.mutation(anyApi.betslip.updateHistory,{...input(),id,name:'Edited'});
 history=await signed.query(anyApi.betslip.history,{});expect(history[0].items[0]).toMatchObject({league:'Premier League',country:'England',tournament:'League season'});
});


it('persists a 45-fixture generated shortlist to draft and named history, with a bounded larger-ticket limit',async()=>{
 const t=create(),signed=await member(t,'large-ticket@example.test');
 const ids=Array.from({length:45},(_,i)=>'large-'+i);
 await t.run(async ctx=>{for(const id of ids)await ctx.db.insert('projection_snapshots',{fixtureId:id,sport:'football',family:'football',match:'Home '+id+' v Away '+id,league:'League',kickoff:Date.now()+3600000,publishedAt:Date.now(),modelVersion:'test',state:'scheduled',fingerprint:id,contributions:{},recent:[]});});
 const items=ids.map(id=>({...selection(id),odds:0,bookmaker:'Unpriced selection',modelProb:.8}));
 await signed.mutation(anyApi.betslip.save,{items,stake:100,betType:'acca'});expect((await signed.query(anyApi.betslip.mine,{}))?.items).toHaveLength(45);
 const id=await signed.mutation(anyApi.betslip.saveHistory,{name:'All matching fixtures',items,stake:100,betType:'acca'});expect((await t.run(ctx=>ctx.db.get(id)))?.items).toHaveLength(45);
 await signed.mutation(anyApi.betslip.updateHistory,{id,name:'All matching fixtures updated',items,stake:100,betType:'acca'});expect((await signed.query(anyApi.betslip.history,{}))[0].items).toHaveLength(45);
 const oversized=Array.from({length:101},(_,i)=>({...selection('limit-'+i),odds:0}));await expect(signed.mutation(anyApi.betslip.save,{items:oversized,stake:100,betType:'acca'})).rejects.toThrow('100 selections');await expect(signed.mutation(anyApi.betslip.saveHistory,{name:'Oversized',items:oversized,stake:100,betType:'acca'})).rejects.toThrow('100 selections');
 await expect(signed.mutation(anyApi.betslip.save,{items:items.map(i=>({...i,odds:10000})).concat(items.map(i=>({...i,fixtureId:i.fixtureId+'copy',odds:10000}))),stake:100,betType:'acca'})).rejects.toThrow('Combined odds are too large');
});
