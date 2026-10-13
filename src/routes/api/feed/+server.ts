import type { RequestHandler } from './$types';
/** Keep premium file URLs server-side; authorize every download using HttpOnly session cookies. */
export const GET:RequestHandler=async({request,url,fetch,platform})=>{
 const environment=platform?.env as Record<string,string|undefined>|undefined;
 const site=environment?.PUBLIC_CONVEX_SITE_URL||import.meta.env.PUBLIC_CONVEX_SITE_URL;
 const headers={'Cache-Control':'private, no-store','Vary':'Cookie'};
 if(!site)return new Response('Backend unavailable',{status:503,headers});
 try{
  const tokenResponse=await fetch(`${site}/api/auth/convex/token`,{headers:{cookie:request.headers.get('cookie')??'','x-better-auth-forwarded-host':url.host,'x-better-auth-forwarded-proto':url.protocol.slice(0,-1)},signal:AbortSignal.timeout(10000)});
  if(!tokenResponse.ok)return new Response('Sign in to load fixtures',{status:401,headers});
  const token=await tokenResponse.json();if(typeof token.token!=='string')return new Response('Sign in to load fixtures',{status:401,headers});
  const response=await fetch(`${site}/feed`,{headers:{Authorization:`Bearer ${token.token}`},signal:AbortSignal.timeout(20000)});
  return new Response(response.body,{status:response.status,headers:{...headers,'Content-Type':response.headers.get('Content-Type')??'text/plain'}});
 }catch{return new Response('Feed unavailable',{status:503,headers});}
};
