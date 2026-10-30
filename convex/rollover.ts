import {query,mutation,internalMutation} from './_generated/server';import {v} from 'convex/values';import {requireAdmin,requireUser} from './access';
import {settleSnapshot} from '../src/lib/feeds/performance.js';
import {anyApi} from 'convex/server';
const leg=v.object({fixtureId:v.string(),key:v.string(),matchTitle:v.string(),selection:v.string(),kickoff:v.number(),odds:v.number()});
const dayOf=(time:number)=>new Date(time+3600000).toISOString().slice(0,10);
const event=(l:{matchTitle:string,kickoff:number})=>l.matchTitle.toLowerCase().replace(/[^a-z0-9]/g,'')+':'+Math.floor(l.kickoff/60000);
function validate(day:string,target:number){if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||![2,3,5,10].includes(target))throw Error('Invalid rollover day or target.');}
export const history=query({args:{},handler:async ctx=>{await requireAdmin(ctx);const first=dayOf(Date.now()-90*86400000);return ctx.db.query('rollover_tickets').withIndex('by_day_target',q=>q.gte('day',first)).order('desc').take(500);}});
export const save=mutation({args:{day:v.string(),target:v.number(),legs:v.array(leg)},handler:async(ctx,args)=>{
 await requireAdmin(ctx);validate(args.day,args.target);const now=Date.now(),old=await ctx.db.query('rollover_tickets').withIndex('by_day_target',q=>q.eq('day',args.day).eq('target',args.target)).unique();
 if(old)throw Error('This day and target already has a recorded ticket. Its selections are frozen for an honest streak record.');
 if(args.legs.length<2||args.legs.length>12||new Set(args.legs.map(l=>l.fixtureId)).size!==args.legs.length||new Set(args.legs.map(event)).size!==args.legs.length)throw Error('Use 2–12 distinct fixtures.');
 let totalOdds=1;for(const l of args.legs){if(!Number.isFinite(l.odds)||l.odds<=1||l.kickoff<=now||dayOf(l.kickoff)!==args.day||[l.fixtureId,l.key,l.matchTitle,l.selection].some(s=>!s||s.length>240))throw Error('Ticket must be recorded before every kickoff with real quoted odds.');totalOdds*=l.odds;}
 if(totalOdds<args.target*.9||totalOdds>args.target*1.1)throw Error('Combined odds are outside the target range.');
 const others=await ctx.db.query('rollover_tickets').withIndex('by_day_target',q=>q.eq('day',args.day)).collect();if(others.some(t=>t.legs.some(l=>args.legs.some(n=>n.fixtureId===l.fixtureId||event(n)===event(l)))))throw Error('A fixture is already recorded in another target for this day.');
 return ctx.db.insert('rollover_tickets',{...args,totalOdds,status:'pending',createdAt:now,updatedAt:now,actorId:await requireUser(ctx)});
}});
/** Runner-only settlement; no administrator can label an unresolved ticket a win. */
export const settlePending=internalMutation({args:{cursor:v.optional(v.string())},handler:async(ctx,args):Promise<{checked:number,updated:number}>=>{
 const page=await ctx.db.query('rollover_tickets').withIndex('by_status',q=>q.eq('status','pending')).paginate({numItems:20,cursor:args.cursor??null}),tickets=page.page;let updated=0;
 for(const ticket of tickets){const outcomes:string[]=[];let complete=true,settledOdds=1;
  for(const l of ticket.legs){if(l.kickoff>Date.now()){complete=false;break;}const p=await ctx.db.query('projection_snapshots').withIndex('by_fixture',q=>q.eq('fixtureId',l.fixtureId)).unique();
   if(p?.state==='cancelled'){outcomes.push('push');continue;}
   if(!p||p.state!=='finished'||!p.score){complete=false;break;}
   const snapshot:any={family:p.family,selections:[{key:l.key,odds:l.odds}]};settleSnapshot(snapshot,{status:{state:'finished',...p.score,periodScores:p.periodScores??{},settledMarkets:p.settledMarkets}},Date.now());
   const outcome=p.settledMarkets?.[l.key]??snapshot.selections[0].result;if(!['won','lost','push'].includes(outcome)){complete=false;break;}outcomes.push(outcome);if(outcome==='won')settledOdds*=l.odds;
  }
  if(!complete)continue;const status=outcomes.includes('lost')?'lost':outcomes.every(r=>r==='push')?'void':'won';await ctx.db.patch(ticket._id,{status,settledOdds:status==='lost'?0:settledOdds,updatedAt:Date.now()});updated++;
 }if(!page.isDone)await ctx.scheduler.runAfter(0,anyApi.rollover.settlePending,{cursor:page.continueCursor});return {checked:tickets.length,updated};
}});
