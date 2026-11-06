import {query,mutation,internalMutation,internalQuery} from './_generated/server';import {v} from 'convex/values';import {requireAdmin,requireUser} from './access';
import {settleSnapshot} from '../src/lib/feeds/performance.js';
import {anyApi} from 'convex/server';
const leg=v.object({sport:v.optional(v.string()),league:v.optional(v.string()),country:v.optional(v.string()),tournament:v.optional(v.string()),fixtureId:v.string(),key:v.string(),matchTitle:v.string(),selection:v.string(),kickoff:v.number(),odds:v.number()});
const dayOf=(time:number)=>new Date(time+3600000).toISOString().slice(0,10);
const event=(l:{matchTitle:string,kickoff:number})=>l.matchTitle.toLowerCase().replace(/[^a-z0-9]/g,'')+':'+Math.floor(l.kickoff/60000);
function validate(day:string,target:number){if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||![2,3,5,10].includes(target))throw Error('Invalid rollover day or target.');}
export const history=query({args:{},handler:async ctx=>{await requireAdmin(ctx);const first=dayOf(Date.now()-90*86400000);return ctx.db.query('rollover_tickets').withIndex('by_day_target',q=>q.gte('day',first)).order('desc').take(500);}});
export const save=mutation({args:{day:v.string(),target:v.number(),legs:v.array(leg)},handler:async(ctx,args)=>{
 await requireAdmin(ctx);validate(args.day,args.target);const now=Date.now(),old=await ctx.db.query('rollover_tickets').withIndex('by_day_target',q=>q.eq('day',args.day).eq('target',args.target)).unique();
 if(old)throw Error('This day and target already has a recorded ticket. Its selections are frozen for an honest streak record.');
 if(args.legs.length<2||args.legs.length>12||new Set(args.legs.map(l=>l.fixtureId)).size!==args.legs.length||new Set(args.legs.map(event)).size!==args.legs.length)throw Error('Use 2–12 distinct fixtures.');
 let totalOdds=1;for(const l of args.legs){if([l.sport,l.league,l.country,l.tournament].some(s=>s!==undefined&&s.length>200))throw Error('Fixture metadata too long.');if(!Number.isFinite(l.odds)||l.odds<=1||l.kickoff<=now||dayOf(l.kickoff)!==args.day||[l.fixtureId,l.key,l.matchTitle,l.selection].some(s=>!s||s.length>240))throw Error('Ticket must be recorded before every kickoff with real quoted odds.');totalOdds*=l.odds;}
 if(totalOdds<args.target*.9||totalOdds>args.target*1.1)throw Error('Combined odds are outside the target range.');
 const others=await ctx.db.query('rollover_tickets').withIndex('by_day_target',q=>q.eq('day',args.day)).collect();if(others.some(t=>t.legs.some(l=>args.legs.some(n=>n.fixtureId===l.fixtureId||event(n)===event(l)))))throw Error('A fixture is already recorded in another target for this day.');
 return ctx.db.insert('rollover_tickets',{...args,totalOdds,settlementComplete:false,status:'pending',createdAt:now,updatedAt:now,actorId:await requireUser(ctx)});
}});
/** Runner-only settlement; no administrator can label an unresolved ticket a win. */
export const settlePending=internalMutation({args:{cursor:v.optional(v.string())},handler:async(ctx,args):Promise<{checked:number,updated:number}>=>{
 const page=await ctx.db.query('rollover_tickets').withIndex('by_open_settlement',q=>q.eq('settlementComplete',false)).paginate({numItems:20,cursor:args.cursor??null}),tickets=page.page;let updated=0;
 for(const ticket of tickets){const outcomes:string[]=[];let complete=true,settledOdds=1;const legs=ticket.legs.map(l=>({...l}));
  for(const l of legs){if(l.kickoff>Date.now()){complete=false;continue;}const p=await ctx.db.query('projection_snapshots').withIndex('by_fixture',q=>q.eq('fixtureId',l.fixtureId)).unique();
   if(p){l.sport??=p.sport;l.league??=p.league;if(p.country)l.country??=p.country;if(p.tournament)l.tournament??=p.tournament;}if(p?.state==='cancelled'){l.result='push';outcomes.push('push');continue;}
   if(!p||p.state!=='finished'||!p.score){complete=false;continue;}
   const snapshot:any={family:p.family,selections:[{key:l.key,odds:l.odds}]};settleSnapshot(snapshot,{status:{state:'finished',...p.score,periodScores:p.periodScores??{},settledMarkets:p.settledMarkets}},Date.now());
   const outcome=p.settledMarkets?.[l.key]??snapshot.selections[0].result;if(!['won','lost','push'].includes(outcome)){complete=false;continue;}l.result=outcome;l.score={home:p.score.home,away:p.score.away};outcomes.push(outcome);if(outcome==='won')settledOdds*=l.odds;
  }
  if(!complete&&!outcomes.includes('lost')){if(JSON.stringify(legs)!==JSON.stringify(ticket.legs))await ctx.db.patch(ticket._id,{legs,settlementComplete:false,updatedAt:Date.now()});continue;}const status=outcomes.includes('lost')?'lost':outcomes.every(r=>r==='push')?'void':'won';await ctx.db.patch(ticket._id,{status,legs,settlementComplete:complete,settledOdds:status==='lost'?0:settledOdds,updatedAt:Date.now()});updated++;
 }if(!page.isDone)await ctx.scheduler.runAfter(0,anyApi.rollover.settlePending,{cursor:page.continueCursor});return {checked:tickets.length,updated};
}});

/** Deployment-only audit; bounded small records, no public account access. */
export const maintenance=internalQuery({args:{},handler:async ctx=>{const rows=await ctx.db.query('rollover_tickets').order('desc').take(360);return {counts:rows.reduce((a:any,r)=>({...a,[r.status]:(a[r.status]??0)+1}),{}),rows};}});
export const backfillMetadata=internalMutation({args:{fixtures:v.array(v.object({fixtureId:v.string(),sport:v.optional(v.string()),league:v.optional(v.string()),country:v.optional(v.string()),tournament:v.optional(v.string())}))},handler:async(ctx,{fixtures})=>{if(fixtures.length>100)throw Error('Maximum 100 fixtures');const metadata=new Map(fixtures.map(f=>[f.fixtureId,f]));const rows=await ctx.db.query('rollover_tickets').order('desc').take(360);let updated=0;for(const row of rows){const legs=row.legs.map(l=>{const m=metadata.get(l.fixtureId);return m?{...l,...Object.fromEntries(Object.entries(m).filter(([k,v])=>k!=='fixtureId'&&typeof v==='string'&&v.length<=200))}:l;});if(JSON.stringify(legs)!==JSON.stringify(row.legs)||row.settlementComplete===undefined){await ctx.db.patch(row._id,{legs,...(row.settlementComplete===undefined?{settlementComplete:false}:{})});updated++;}}return {updated};}});
