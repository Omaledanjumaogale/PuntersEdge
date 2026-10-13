import {internalMutation,internalQuery,query} from './_generated/server';
import {v} from 'convex/values';
import {requireAdmin} from './access';
import {emptyCounters,addCounters,statsOf,MODEL_VERSION} from '../src/lib/feeds/performance.js';

const score = v.object({home:v.number(),away:v.number(),regHome:v.optional(v.number()),regAway:v.optional(v.number())});
export const record = internalMutation({args:{fixtureId:v.string(),sport:v.string(),family:v.string(),match:v.string(),league:v.string(),kickoff:v.number(),publishedAt:v.number(),modelVersion:v.string(),state:v.string(),finishedAt:v.optional(v.number()),score:v.optional(score),storageId:v.id('_storage'),fingerprint:v.string(),contributions:v.any(),recent:v.array(v.any())},handler:async(ctx,args)=>{
 const old=await ctx.db.query('projection_snapshots').withIndex('by_fixture',q=>q.eq('fixtureId',args.fixtureId)).unique();
 if(old?.fingerprint===args.fingerprint){await ctx.storage.delete(args.storageId);return;}
 if(old){await ctx.db.patch(old._id,args);await ctx.storage.delete(old.storageId);}else await ctx.db.insert('projection_snapshots',args);
 for(const sport of [args.sport,'all']){
  const row=await ctx.db.query('performance_metrics').withIndex('by_sport',q=>q.eq('sport',sport)).unique();
  const groups:Record<string,any>=row?.groups??{};
  for(const [key,c] of Object.entries(old?.contributions??{}))addCounters(groups[key]??=emptyCounters(),c,-1);
  for(const [key,c] of Object.entries(args.contributions))addCounters(groups[key]??=emptyCounters(),c);
  // Daily chart retains a year; lifetime sport, market, grade and calibration counters persist.
  const cutoff=new Date(Date.now()-365*86400000).toISOString().slice(0,10);
  for(const key of Object.keys(groups))if(key.startsWith('days:')&&key.slice(5)<cutoff)delete groups[key];
  const done=Object.keys(args.contributions).length>0,wasDone=Object.keys(old?.contributions??{}).length>0;
  const values={sport,groups,fixtures:(row?.fixtures??0)+(old?0:1),settledFixtures:(row?.settledFixtures??0)+Number(done)-Number(wasDone),verdicts:(row?.verdicts??0)+Number(!!args.contributions.verdict)-Number(!!old?.contributions?.verdict),updatedAt:Date.now()};
  if(row)await ctx.db.patch(row._id,values);else await ctx.db.insert('performance_metrics',values);
 }
}});
export const fixtureStates=internalQuery({args:{ids:v.array(v.string())},handler:async(ctx,args)=>{
 if(args.ids.length>100)throw new Error('At most 100 fixtures per lookup.');
 const result=[];
 for(const fixtureId of args.ids){const p=await ctx.db.query('projection_snapshots').withIndex('by_fixture',q=>q.eq('fixtureId',fixtureId)).unique();if(p)result.push({fixtureId,kickoff:p.kickoff,status:p.state,family:p.family,...(p.score?{score:p.score}:{})});}
 return result;
}});
export const archive= query({args:{fixtureId:v.string()},handler:async(ctx,args)=>{
 await requireAdmin(ctx);
 const p=await ctx.db.query('projection_snapshots').withIndex('by_fixture',q=>q.eq('fixtureId',args.fixtureId)).unique();
 return p?{url:await ctx.storage.getUrl(p.storageId),modelVersion:p.modelVersion,publishedAt:p.publishedAt}:null;
}});
export const dashboard = query({args:{sport:v.optional(v.string())},handler:async(ctx,args)=>{
 await requireAdmin(ctx);
 const sport=args.sport??'all';
 if(!['all','football','basketball','nba','hockey','baseball'].includes(sport))throw new Error('Unknown sport.');
 const row=await ctx.db.query('performance_metrics').withIndex('by_sport',q=>q.eq('sport',sport)).unique();
 const sportRows=await ctx.db.query('performance_metrics').take(6);
 const feed=await ctx.db.query('feed_state').withIndex('by_key',q=>q.eq('key','feed')).unique();
 const coverage=feed?.data?.coverage??{fixtures:0,projected:0,unavailable:0,pending:0,modelVersion:MODEL_VERSION};
 const recentRows=sport==='all'?await ctx.db.query('projection_snapshots').withIndex('by_state_kickoff',q=>q.eq('state','finished')).order('desc').take(60):await ctx.db.query('projection_snapshots').withIndex('by_sport_state',q=>q.eq('sport',sport).eq('state','finished')).order('desc').take(60);
 const breakdown=(name:string)=>Object.fromEntries(Object.entries(row?.groups??{}).filter(([key])=>key.startsWith(name+':')).map(([key,c])=>[key.slice(name.length+1),statsOf(c)]));
 const recent=recentRows.filter(p=>p.score).flatMap(p=>p.recent.map(s=>({...s,fixtureId:p.fixtureId,sport:p.sport,match:p.match,league:p.league,kickoff:p.kickoff,score:p.score,modelVersion:p.modelVersion,publishedAt:p.publishedAt}))).slice(0,100);
 return {summary:{...statsOf(row?.groups?.summary),fixtures:row?.fixtures??0,verdicts:row?.verdicts??0,settledFixtures:row?.settledFixtures??0},verdict:statsOf(row?.groups?.verdict),sports:Object.fromEntries(sportRows.filter(p=>p.sport!=='all').map(p=>[p.sport,statsOf(p.groups.summary)])),versions:breakdown('versions'),grades:breakdown('grades'),markets:breakdown('markets'),bands:breakdown('bands'),days:breakdown('days'),coverage,recent};
}});
