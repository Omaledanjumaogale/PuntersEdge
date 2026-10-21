import {internalQuery,internalMutation,query} from './_generated/server';
import {v} from 'convex/values';
import {requireAdmin} from './access';
import {validateArtifact} from '../src/lib/engine/artifacts.js';
const doc=async(ctx:any)=>ctx.db.query('feed_state').withIndex('by_key',(q:any)=>q.eq('key','learning')).unique();
export const state=internalQuery({args:{},handler:async ctx=>({learning:(await doc(ctx))?.data??{},ingest:(await ctx.db.query('feed_state').withIndex('by_key',q=>q.eq('key','ingest')).unique())?.data??{},models:await ctx.db.query('model_artifacts').withIndex('by_mode',q=>q.eq('mode','active')).take(100)})});
export const summary=query({args:{},handler:async ctx=>{await requireAdmin(ctx);const d=(await doc(ctx))?.data;return d?{lastCollectedAt:d.lastCollectedAt??null,rows:d.rows??0,lastRunAt:d.lastRunAt??null,status:d.status??'Awaiting first run',report:d.report??null}:null;}});
export const patch=internalMutation({args:{data:v.any()},handler:async(ctx,{data})=>{const d=await doc(ctx);if(d)await ctx.db.patch(d._id,{data:{...d.data,...data}});else await ctx.db.insert('feed_state',{key:'learning',data});}});
function directionEvidenceValid(score:any){
 if(score.selectedDirectionsNonRegressing!==true)return false;
 for(const kind of ['total','home','away']){
  let count=0;
  for(const side of ['over','under']){
   const d=score.selectedDirections?.[kind+':'+side];
   if(!d||!Number.isInteger(d.nFixtures)||d.nFixtures<0||d.nFixtures>score.n||d.minimumFixtures!==40||d.sufficient!==(d.nFixtures>=40))return false;
   count+=d.nFixtures;
   if(!d.nFixtures)continue;
   if(!['candidateBrier','incumbentBrier','candidateLogLoss','incumbentLogLoss','meanForecast','observedWinRate','calibrationError'].every(k=>Number.isFinite(d[k])&&d[k]>=0))return false;
   if(d.candidateBrier>1||d.incumbentBrier>1||d.meanForecast>1||d.observedWinRate>1||d.calibrationError>1)return false;
   if(d.nFixtures>=40&&(d.candidateBrier>d.incumbentBrier*1.02||d.candidateLogLoss>d.incumbentLogLoss*1.02))return false;
  }
  // Over/Under at one half-line cannot both clear the >=55% outright selection rule.
  if(count>score.n)return false;
 }
 return true;
}
export const finish=internalMutation({args:{report:v.any(),candidates:v.array(v.any()),fingerprint:v.string()},handler:async(ctx,args)=>{
 const owner=ctx.db.normalizeId('users',process.env.SUPER_ADMIN_USER_ID??'');if(!owner||!await ctx.db.get(owner))throw new Error('Configured administrator required');
 const d=await doc(ctx);if(!d||d.data.fingerprint!==args.fingerprint)throw new Error('Training dataset changed; collect and evaluate again');
 if(args.candidates.length>20||JSON.stringify(args.report).length>200000)throw new Error('Training report too large');
 for(const candidate of args.candidates){const a=candidate.artifact;validateArtifact(a);if(JSON.stringify(a).length>500000)throw new Error('Artifact too large');
  const score=candidate.evaluation;if(!score||!['n','candidateBrier','incumbentBrier','candidateLogLoss','incumbentLogLoss','candidateMae','incumbentMae','newTrainingRows','incumbentCutoff','candidateCutoff','testStart'].every(k=>Number.isFinite(score[k])&&score[k]>=0)||score.n<40||score.candidateBrier>=score.incumbentBrier*.99||score.candidateLogLoss>score.incumbentLogLoss||score.candidateMae>score.incumbentMae*1.02||score.newTrainingRows<20||!(score.incumbentCutoff<score.testStart&&score.candidateCutoff<score.testStart))continue;
  if(!directionEvidenceValid(score))continue;
  const interval=score.pairedBrier?.interval95;
  const marketRows=['total','home','away','margin'].map(key=>score.markets?.[key]);
  if(score.pairedBrier?.nFixtures!==score.n||score.pairedBrier?.blockSize!==7||(score.pairedBrier?.blocks<8||score.pairedBrier?.blocks!==Math.ceil(score.n/7))||!Array.isArray(interval)||interval.length!==2||!interval.every(Number.isFinite)||interval[0]>interval[1]||interval[1]>=0||!marketRows.every(m=>m&&m.nOptions===score.n*2&&['candidateBrier','incumbentBrier','candidateLogLoss','incumbentLogLoss'].every(k=>Number.isFinite(m[k])&&m[k]>=0)&&m.candidateBrier<=m.incumbentBrier*1.02&&m.candidateLogLoss<=m.incumbentLogLoss*1.02))continue;
  if(await ctx.db.query('model_artifacts').withIndex('by_version',q=>q.eq('version',a.version)).unique())continue;
  const serving=await ctx.db.query('model_artifacts').withIndex('by_mode',q=>q.eq('mode','active')).collect();const old=serving.filter(r=>r.sport===a.sport&&r.league===a.league&&(r.artifact.scope??'full')===(a.scope??'full'));
  // A stale job cannot retire a different incumbent; validated serving models require review.
  if(old.length!==1||old.some(r=>r.version!==candidate.incumbentVersion||r.approved))continue;
  for(const row of old)await ctx.db.patch(row._id,{mode:'retired',updatedAt:Date.now()});
  await ctx.db.insert('model_artifacts',{version:a.version,sport:a.sport,league:a.league,artifact:{...a,continuousEvaluation:score},mode:'active',approved:false,approvedMarkets:[],createdAt:Date.now(),updatedAt:Date.now(),actorId:owner});
 }
 await ctx.db.patch(d._id,{data:{...d.data,lastRunAt:Date.now(),status:args.report.status??'Evaluated',report:args.report}});return {completed:true};
}});
