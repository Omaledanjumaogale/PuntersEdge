import {internalMutation} from './_generated/server';
import {v} from 'convex/values';

/** Small verification index only. Forecasts, raw history and weights stay in R2. */
export const publish=internalMutation({args:{at:v.number(),fixtures:v.array(v.object({id:v.string(),kickoff:v.number()}))},handler:async(ctx,{at,fixtures})=>{
 const now=Date.now();
 if(!Number.isFinite(at)||at>now+60000||now-at>86400000||fixtures.length>200||new Set(fixtures.map(f=>f.id)).size!==fixtures.length||fixtures.some(f=>!/^tennis-oddsapi-[a-zA-Z0-9_-]{1,100}$/.test(f.id)||!Number.isFinite(f.kickoff)||f.kickoff<=at||f.kickoff>at+72*3600000))throw Error('Invalid pre-match tennis schedule');
 const row=await ctx.db.query('feed_state').withIndex('by_key',q=>q.eq('key','tennis-schedule')).unique();
 if(row&&row.data.at>at)throw Error('A newer tennis schedule is already published');
 const data={at,fixtures};
 if(row)await ctx.db.patch(row._id,{data});else await ctx.db.insert('feed_state',{key:'tennis-schedule',data});
 return {fixtures:fixtures.length};
}});
