import type {RequestHandler} from './$types';
import {membership} from '#lib/server/membership.ts';
import {dataBucket,validBlobKey} from '#lib/server/blob-store.ts';
import {ConvexHttpClient} from 'convex/browser';
import {anyApi} from 'convex/server';
/** Authorize every request, including conditional requests, before reading private R2 bytes. */
export const GET:RequestHandler=async event=>{
 const headers={'Cache-Control':'private, no-store','Vary':'Cookie'};
 const access=await membership(event);if(!access.active||!access.token)return new Response('Active membership required',{status:403,headers});
 const env=event.platform?.env as Record<string,string|undefined>|undefined,cloud=env?.PUBLIC_CONVEX_URL||import.meta.env.PUBLIC_CONVEX_URL,site=env?.PUBLIC_CONVEX_SITE_URL||import.meta.env.PUBLIC_CONVEX_SITE_URL;
 if(!cloud)return new Response('Backend unavailable',{status:503,headers});
 try{
  const client=new ConvexHttpClient(cloud);client.setAuth(access.token);const meta=await client.query(anyApi.feed.meta,{});
  if(!meta)return new Response('Feed unavailable',{status:503,headers});
  const etag=`"${meta.version}"`;
  if(event.request.headers.get('If-None-Match')===etag)return new Response(null,{status:304,headers:{...headers,ETag:etag}});
  if(meta.blobKey){const bucket=dataBucket(event.platform);if(!bucket||!validBlobKey(meta.blobKey)||!meta.blobKey.startsWith('feed/'))return new Response('Storage unavailable',{status:503,headers});const object=await bucket.get(meta.blobKey);if(!object)return new Response('Feed unavailable',{status:503,headers});return new Response(object.body,{headers:{...headers,'Content-Type':'application/gzip',ETag:etag,'X-Feed-Version':meta.version,'X-Data-Source':'r2'}});}
  // During migration only: retain the old authenticated path until the first R2 commit.
  if(!site)return new Response('Backend unavailable',{status:503,headers});
  const response=await event.fetch(`${site}/feed`,{headers:{Authorization:`Bearer ${access.token}`},signal:AbortSignal.timeout(20000)});
  return new Response(response.body,{status:response.status,headers:{...headers,'Content-Type':'application/gzip',ETag:etag}});
 }catch{return new Response('Feed unavailable',{status:503,headers});}
};
