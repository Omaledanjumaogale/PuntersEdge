import {query,mutation,internalQuery} from './_generated/server';
import {v} from 'convex/values';
import {requireAdmin,requireUser} from './access';
import {validateArtifact} from '../src/lib/engine/artifacts.js';
export const list=query({args:{},handler:async ctx=>{await requireAdmin(ctx);return ctx.db.query('model_artifacts').order('desc').take(100);}});
export const register=mutation({args:{artifact:v.any()},handler:async(ctx,{artifact})=>{
 await requireAdmin(ctx);const actorId=await requireUser(ctx);validateArtifact(artifact);
 if(JSON.stringify(artifact).length>500000)throw new Error('Artifact too large');
 if(await ctx.db.query('model_artifacts').withIndex('by_version',q=>q.eq('version',artifact.version)).unique())throw new Error('Model versions are immutable; use a new version');
 return ctx.db.insert('model_artifacts',{version:artifact.version,sport:artifact.sport,league:artifact.league,artifact,mode:'shadow',approved:false,approvedMarkets:[],createdAt:Date.now(),updatedAt:Date.now(),actorId});
}});
/** Activate fitted inputs for prospective comparison; remains unapproved, so stakes stay zero. */
export const shadowActivate=mutation({args:{id:v.id('model_artifacts')},handler:async(ctx,{id})=>{
 await requireAdmin(ctx);const row=await ctx.db.get(id);if(!row)throw new Error('Unknown artifact');
 for(const old of await ctx.db.query('model_artifacts').withIndex('by_mode',q=>q.eq('mode','active')).take(100))if(old.sport===row.sport&&old.league===row.league&&(old.artifact.scope??'full')===(row.artifact.scope??'full'))await ctx.db.patch(old._id,{mode:'retired',updatedAt:Date.now()});
 await ctx.db.patch(id,{mode:'active',approved:false,approvedMarkets:[],updatedAt:Date.now()});
}});
export const retire=mutation({args:{id:v.id('model_artifacts')},handler:async(ctx,{id})=>{await requireAdmin(ctx);await ctx.db.patch(id,{mode:'retired',approved:false,approvedMarkets:[],updatedAt:Date.now()});}});
export const serving=internalQuery({args:{},handler:ctx=>ctx.db.query('model_artifacts').withIndex('by_mode',q=>q.eq('mode','active')).take(100)});
