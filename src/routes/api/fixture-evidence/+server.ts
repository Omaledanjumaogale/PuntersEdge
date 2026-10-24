import type {RequestHandler} from './$types';
import {membership} from '#lib/server/membership.ts';
import {runtimeEnv,dataBucket,validBlobKey} from '#lib/server/blob-store.ts';
import {ConvexHttpClient} from 'convex/browser';import {anyApi} from 'convex/server';
import {evidenceShortlist} from '#lib/evidence-shortlist.js';
export const GET:RequestHandler=async event=>{
 const headers={'Cache-Control':'private, no-store','Vary':'Cookie'};
 const access=await membership(event);if(!access.active||!access.token)return new Response('Membership required',{status:403,headers});
 const id=event.url.searchParams.get('id')??'';if(!/^[A-Za-z0-9:_-]{1,160}$/.test(id))return new Response('Invalid fixture',{status:400,headers});
 try{
 const env=runtimeEnv(event.platform) as Record<string,string|undefined>,url=env.PUBLIC_CONVEX_URL||import.meta.env.PUBLIC_CONVEX_URL;
 if(!url)throw new Error('Backend unavailable');const client=new ConvexHttpClient(url);client.setAuth(access.token);
 const meta=await client.query(anyApi.evidence.fixtureMeta,{fixtureId:id});if(!meta)return Response.json({rows:[]},{headers});
 const bucket=dataBucket(event.platform);if(!bucket||!validBlobKey(meta.blobKey)||!meta.blobKey.startsWith('archives/evidence/'))throw new Error('Storage unavailable');
 const read=async(key:string)=>{const object=await bucket.get(key);if(!object||object.size>8*1024*1024)return null;const stream=object.body.pipeThrough(new DecompressionStream('gzip'));const reader=stream.getReader();let size=0;const chunks:Uint8Array[]=[];try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>64*1024*1024)throw new Error('Artifact too large');chunks.push(value);}}finally{await reader.cancel();}const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return JSON.parse(new TextDecoder().decode(bytes));};
 const report=await read(meta.blobKey);if(!report)throw new Error('Report unavailable');
 const fixture=(report.upcoming??[]).find((f:any)=>f.fixtureId===id);
 let rows:any[]=[];
 if(fixture&&Date.now()<fixture.kickoff)rows=evidenceShortlist({...report,upcoming:[fixture]},{includePeriodForecasts:true,minModel:.55},Date.now()).rows;
 else {const date=new Date(meta.kickoff+3600000).toISOString().slice(0,10);const history=await read(`archives/evidence/history/${date}.gz`);rows=Object.values(history?.rows??{}).filter((r:any)=>r.fixtureId===id);}
 // Never serialize the catalog, its storage pointer or unrelated fixture projections.
 return Response.json({rows:rows.map(({rows:unused,...r}:any)=>r),recordedAt:report.generatedAt},{headers});
 }catch{return new Response('Selection evidence is temporarily unavailable',{status:503,headers});}
};
