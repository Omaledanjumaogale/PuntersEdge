import {ConvexHttpClient} from 'convex/browser';
import {anyApi} from 'convex/server';
import type {RequestEvent} from '@sveltejs/kit';
export async function membership(event:RequestEvent):Promise<{active:boolean;role:string;token?:string}>{
 const env=event.platform?.env as Record<string,string|undefined>|undefined;
 const site=env?.PUBLIC_CONVEX_SITE_URL||import.meta.env.PUBLIC_CONVEX_SITE_URL;
 const cloud=env?.PUBLIC_CONVEX_URL||import.meta.env.PUBLIC_CONVEX_URL;
 if(!site||!cloud||!event.request.headers.get('cookie'))return {active:false,role:'guest'};
 try{const response=await event.fetch(`${site}/api/auth/convex/token`,{headers:{cookie:event.request.headers.get('cookie')??'','x-better-auth-forwarded-host':event.url.host,'x-better-auth-forwarded-proto':event.url.protocol.slice(0,-1)},signal:AbortSignal.timeout(10000)});if(!response.ok)return {active:false,role:'guest'};const result=await response.json();if(typeof result.token!=='string')return {active:false,role:'guest'};const client=new ConvexHttpClient(cloud);client.setAuth(result.token);return {...await client.query(anyApi.access.role,{}),token:result.token};}catch{return {active:false,role:'guest'};}
}
