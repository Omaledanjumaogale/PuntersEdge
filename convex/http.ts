import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { authComponent, createAuth } from "./auth";

import { flutterwaveWebhook } from "./payments";

const http = httpRouter();
http.route({ path: "/payments/flutterwave", method: "POST", handler: flutterwaveWebhook });

http.route({path:"/feed",method:"GET",handler:httpAction(async(ctx)=>{
 try {
  const meta=await ctx.runQuery(internal.feed.storageMeta,{});
  if(meta?.blobKey){
   const base=process.env.EDGE_DATA_URL,secret=process.env.EDGE_DATA_SECRET;
   if(!base||!secret)return new Response('Feed unavailable',{status:503});
   const r=await fetch(new URL('/api/internal/blob/'+meta.blobKey,base),{headers:{Authorization:`Bearer ${secret}`},signal:AbortSignal.timeout(20000)});
   return new Response(r.body,{status:r.status,headers:{'Content-Type':'application/gzip','Cache-Control':'private, no-store','Vary':'Authorization'}});
  }
  if(!meta?.url)return new Response("Feed unavailable",{status:503});
  const response=await fetch(meta.url,{signal:AbortSignal.timeout(15000)});
  if(!response.ok)return new Response("Feed unavailable",{status:503});
  return new Response(response.body,{headers:{"Content-Type":"application/gzip","Cache-Control":"private, no-store","Vary":"Authorization"}});
 }catch{return new Response("Active membership required",{status:403,headers:{"Cache-Control":"no-store"}});}
})});

http.route({path:'/preview',method:'GET',handler:httpAction(async(ctx)=>{
 const meta=await ctx.runQuery(internal.feed.previewStorageMeta,{});
 if(!meta?.url)return new Response('Preview unavailable',{status:503});
 const response=await fetch(meta.url,{signal:AbortSignal.timeout(15000)});
 return new Response(response.body,{status:response.status,headers:{'Content-Type':'application/gzip','Cache-Control':'public, max-age=120','X-Preview-Version':meta.version}});
})});

// Exposes /.well-known/openid-configuration and JWKS for token verification.
authComponent.registerRoutes(http, createAuth);

export default http;
