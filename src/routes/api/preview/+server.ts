import {runtimeEnv} from '#lib/server/cloudflare.ts';
import type {RequestHandler} from './$types';
import {dataBucket} from '#lib/server/blob-store.ts';
/** Only the deliberately limited public preview is readable without membership. */
export const GET:RequestHandler=async event=>{
 const bucket=dataBucket(event.platform);
 if(bucket){const object=await bucket.get('preview/current.gz');if(object){const headers={'Content-Type':'application/gzip','Cache-Control':'public, max-age=300',ETag:`"${object.etag}"`,'X-Preview-Version':object.etag,'X-Data-Source':'r2'};return event.request.headers.get('If-None-Match')===headers.ETag?new Response(null,{status:304,headers}):new Response(object.body,{headers});}}
 const env=runtimeEnv(event.platform) as Record<string,string|undefined>,site=env?.PUBLIC_CONVEX_SITE_URL||import.meta.env.PUBLIC_CONVEX_SITE_URL;
 if(!site)return new Response('Preview unavailable',{status:503});
 try{const response=await event.fetch(`${site}/preview`,{signal:AbortSignal.timeout(20000)});return new Response(response.body,{status:response.status,headers:{'Content-Type':'application/gzip','Cache-Control':response.ok?'public, max-age=300':'no-store','X-Preview-Version':response.headers.get('X-Preview-Version')??''}});}catch{return new Response('Preview unavailable',{status:503});}
};
