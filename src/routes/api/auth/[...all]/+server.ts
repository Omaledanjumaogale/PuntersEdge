import {runtimeEnv} from '#lib/server/cloudflare.ts';
import type { RequestHandler } from './$types';

/** Same-origin proxy keeps Better Auth session cookies HttpOnly on Pages. */
const proxy: RequestHandler = async ({ request, url, fetch, platform }) => {
  const environment = runtimeEnv(platform) as Record<string, string | undefined>;
  const convexUrl = environment?.PUBLIC_CONVEX_URL || import.meta.env.PUBLIC_CONVEX_URL;
  const site = environment?.PUBLIC_CONVEX_SITE_URL || import.meta.env.PUBLIC_CONVEX_SITE_URL || convexUrl?.replace('.convex.cloud', '.convex.site');
  if (!site) return new Response('Authentication is not configured.', { status: 503 });
  const target = new URL(url.pathname + url.search, site);
  const headers = new Headers(request.headers);
  headers.delete('host');
  // Discard caller-supplied forwarding headers. Only Cloudflare's edge-generated IP is trusted.
  const edgeIp=request.headers.get('cf-connecting-ip');
  for(const name of ['x-forwarded-for','x-real-ip','forwarded','true-client-ip'])headers.delete(name);
  if(edgeIp&&/^[a-fA-F0-9:.]{3,45}$/.test(edgeIp))headers.set('cf-connecting-ip',edgeIp);else headers.delete('cf-connecting-ip');
  if(Number(request.headers.get('content-length')??0)>16384)return Response.json({message:'Request too large'},{status:413});
  let body:Uint8Array|undefined;
  if(!['GET','HEAD'].includes(request.method)&&request.body){
    const reader=request.body.getReader(),chunks:Uint8Array[]=[];let size=0;
    for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>16384){await reader.cancel();return Response.json({message:'Request too large'},{status:413});}chunks.push(value);}
    body=new Uint8Array(size);let offset=0;for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.length;}
  }
  headers.delete('content-length');
  headers.set('x-better-auth-forwarded-host', url.host);
  headers.set('x-better-auth-forwarded-proto', url.protocol.slice(0, -1));
  let response: Response;
  try { response = await fetch(target, {
    method: request.method,
    headers,
    body: body as BodyInit|undefined,
    redirect: 'manual', signal: AbortSignal.timeout(20000),
  }); } catch { return Response.json({message:'The account backend is unavailable. Please try again later.'},{status:503,headers:{'Cache-Control':'no-store'}}); }
  const outputHeaders = new Headers(response.headers);
  outputHeaders.set('Cache-Control', 'no-store');
  return new Response(response.body, { status: response.status, headers: outputHeaders });
};
export const GET = proxy;
export const POST = proxy;
