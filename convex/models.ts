import {query,mutation,internalQuery,internalMutation} from './_generated/server';
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
/** Deployment-admin-only installation; never promotes a candidate to validated status. */
export const installCandidates=internalMutation({args:{artifacts:v.array(v.any())},handler:async(ctx,{artifacts})=>{
 if(artifacts.length>20)throw new Error('At most 20 candidates');
 const actorId=ctx.db.normalizeId('users',process.env.SUPER_ADMIN_USER_ID??'');
 if(!actorId||!await ctx.db.get(actorId))throw new Error('Configured administrator required');
 const canonical=(value:any):any=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
 let installed=0;
 for(const artifact of artifacts){validateArtifact(artifact);if(JSON.stringify(artifact).length>500000)throw new Error('Artifact too large');
  const existing=await ctx.db.query('model_artifacts').withIndex('by_version',q=>q.eq('version',artifact.version)).unique();
  if(existing){if(JSON.stringify(canonical(existing.artifact))!==JSON.stringify(canonical(artifact)))throw new Error('Immutable version mismatch');continue;}
  const active=(await ctx.db.query('model_artifacts').withIndex('by_mode',q=>q.eq('mode','active')).take(100)).filter(r=>r.sport===artifact.sport&&r.league===artifact.league&&(r.artifact.scope??'full')===(artifact.scope??'full'));
  const preserveValidated=active.some(r=>r.approved);
  if(!preserveValidated)for(const old of active)await ctx.db.patch(old._id,{mode:'retired',updatedAt:Date.now()});
  await ctx.db.insert('model_artifacts',{version:artifact.version,sport:artifact.sport,league:artifact.league,artifact,mode:preserveValidated?'shadow':'active',approved:false,approvedMarkets:[],createdAt:Date.now(),updatedAt:Date.now(),actorId});installed++;
 }
 return {installed,approved:false};
}});
