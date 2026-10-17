import type {RequestHandler} from './$types';
import {membership} from '#lib/server/membership.ts';
import {dataBucket} from '#lib/server/blob-store.ts';
/** Authorize first. Never ship the multi-megabyte fitted player table to a browser. */
export const GET:RequestHandler=async event=>{
 const headers={'Cache-Control':'private, no-store','Vary':'Cookie'};
 const access=await membership(event);
 if(!access.active)return new Response('Active membership required',{status:403,headers});
 try{
  const bucket=dataBucket(event.platform);
  if(!bucket)return new Response('Tennis storage unavailable',{status:503,headers});
  const object=await bucket.get('archives/tennis/live-information.json.gz');
  if(!object||object.size>256*1024)return new Response('Tennis snapshot unavailable',{status:503,headers});
  const etag='"'+object.etag+'"';
  if(event.request.headers.get('If-None-Match')===etag)return new Response(null,{status:304,headers:{...headers,ETag:etag}});
  return new Response(object.body,{headers:{...headers,'Content-Type':'application/gzip',ETag:etag}});
 }catch{return new Response('Tennis snapshot unavailable',{status:503,headers});}
};
