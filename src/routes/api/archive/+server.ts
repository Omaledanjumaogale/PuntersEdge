import type {RequestHandler} from './$types';
import {membership} from '#lib/server/membership.ts';
import {dataBucket,validBlobKey} from '#lib/server/blob-store.ts';
export const GET:RequestHandler=async event=>{
 const headers={'Cache-Control':'private, no-store','Vary':'Cookie'},access=await membership(event);
 if(!access.active||access.role!=='super_admin')return new Response('Administrator required',{status:403,headers});
 const key=event.url.searchParams.get('key')??'';if(!validBlobKey(key)||!key.startsWith('archives/'))return new Response('Invalid archive',{status:400,headers});
 const bucket=dataBucket(event.platform);if(!bucket)return new Response('Storage unavailable',{status:503,headers});
 const object=await bucket.get(key);return object?new Response(object.body,{headers:{...headers,'Content-Type':'application/gzip'}}):new Response('Archive unavailable',{status:404,headers});
};
