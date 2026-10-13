import type {RequestHandler} from './$types';
export const GET:RequestHandler=async({fetch,platform})=>{
 const env=platform?.env as Record<string,string|undefined>|undefined;
 const site=env?.PUBLIC_CONVEX_SITE_URL||import.meta.env.PUBLIC_CONVEX_SITE_URL;
 if(!site)return new Response('Preview unavailable',{status:503});
 try{const response=await fetch(`${site}/preview`,{signal:AbortSignal.timeout(20000)});return new Response(response.body,{status:response.status,headers:{'Content-Type':'application/gzip','Cache-Control':response.ok?'public, max-age=120':'no-store','X-Preview-Version':response.headers.get('X-Preview-Version')??''}});}catch{return new Response('Preview unavailable',{status:503});}
};
