import {gzipSync,gunzipSync} from 'node:zlib';
import {runnerBlobs} from './runner-blobs.mjs';

/** Only a whitelist of the already-public five-fixture preview may leave private R2. */
export function publicPreviewDocument(data){
 if(data?.v!==1||data.access!=='preview'||!Array.isArray(data.previewFixtures)||data.previewFixtures.length>5||!Number.isFinite(Date.parse(data.generatedAt)))throw Error('A limited public preview is required');
 const previewFixtures=data.previewFixtures.map(f=>{
  const row=Object.fromEntries(['id','sport','league','home','away','kickoff'].map(key=>[key,String(f[key]??'').slice(0,200)]));
  let headline=null;const h=f.headline;
  if(h&&typeof h.selection==='string'&&Number.isFinite(h.modelProb)&&h.modelProb>0&&h.modelProb<1&&Number.isFinite(h.odds)&&h.odds>1)headline={selection:h.selection.slice(0,200),modelProb:h.modelProb,odds:h.odds};
  return {...row,headline};
 });
 return {v:1,access:'preview',generatedAt:data.generatedAt,previewFixtures,inputs:{football:[],basketball:[],nba:[],hockey:[],baseball:[]},games:[],projections:[],reviewInputs:{},record:{summary:{all:{picks:0,won:0,lost:0,push:0,profit:0,roi:0},grades:{},sports:{}},recent:[],pending:0},usage:null,sources:{}};
}
export async function publishPublicPreview(env=process.env){
 if(!env.CLOUDFLARE_ACCOUNT_ID||!env.CLOUDFLARE_API_TOKEN)return {published:false,reason:'Direct R2 transport not configured'};
 const bytes=await runnerBlobs(env).get('preview/current.gz');if(!bytes)throw Error('Private preview source is missing');
 const data=publicPreviewDocument(JSON.parse(gunzipSync(bytes,{maxOutputLength:65536}).toString('utf8')));
 await runnerBlobs({...env,R2_BUCKET:'puntersedge-public'},{cacheControl:'public, max-age=120'}).put('preview/current.gz',gzipSync(JSON.stringify(data)));
 return {published:true,fixtures:data.previewFixtures.length};
}
