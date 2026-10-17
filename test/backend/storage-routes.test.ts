import {POST as tennisUpload}from'../../src/routes/api/admin/tennis/+server';
import {it,expect,vi,afterEach} from 'vitest';
import {env as nativeEnv} from './worker-env.mock';
const identity=vi.hoisted(()=>({active:false,role:'guest',token:undefined as string|undefined}));
vi.mock('#lib/server/membership.ts',()=>({membership:async()=>identity}));
vi.mock('convex/browser',()=>({ConvexHttpClient:class{setAuth(){}async mutation(){return {};}async query(){return {blobKey:'feed/abc.gz',version:'abc'};}}}));
import {GET as feed}from'../../src/routes/api/feed/+server';
import {GET as preview}from'../../src/routes/api/preview/+server';
import {GET as archive}from'../../src/routes/api/archive/+server';
import {GET as getBlob,PUT as putBlob}from'../../src/routes/api/internal/blob/[...key]/+server';
function event(path:string,options:RequestInit={}){const bucket={get:vi.fn(async()=>({body:new Blob(['private']).stream(),etag:'etag',size:7})),put:vi.fn(),delete:vi.fn()};return {url:new URL('https://example.test'+path),request:new Request('https://example.test'+path,options),params:{key:'state/abc.gz'},platform:{env:{DATA_BUCKET:bucket,EDGE_DATA_SECRET:'secret',PUBLIC_CONVEX_URL:'https://example.convex.cloud'},ctx:{waitUntil(){}},caches:{}},fetch:vi.fn()} as any;}
afterEach(()=>{for(const key of Object.keys(nativeEnv))delete nativeEnv[key];identity.active=false;identity.role='guest';identity.token=undefined;});
it('rejects anonymous private data reads and writes before touching R2',async()=>{
 const e=event('/api/internal/blob/state/abc.gz');expect((await getBlob(e)).status).toBe(401);expect(e.platform.env.DATA_BUCKET.get).not.toHaveBeenCalled();
 expect((await putBlob(e)).status).toBe(401);expect(e.platform.env.DATA_BUCKET.put).not.toHaveBeenCalled();
 expect((await feed(event('/api/feed'))).status).toBe(403);expect((await archive(event('/api/archive?key=archives/a/b.gz'))).status).toBe(403);
});
it('reads only the limited public preview without Convex calls',async()=>{
 const e=event('/api/preview');const response=await preview(e);expect(response.status).toBe(200);expect(response.headers.get('X-Data-Source')).toBe('r2');expect(e.platform.env.DATA_BUCKET.get).toHaveBeenCalledWith('preview/current.gz');expect(e.fetch).not.toHaveBeenCalled();
});
it('authorizes conditional premium downloads and keeps archive access admin-only',async()=>{
 identity.active=true;identity.role='subscriber';identity.token='token';const e=event('/api/feed');const response=await feed(e);expect(response.status).toBe(200);expect(response.headers.get('Cache-Control')).toBe('private, no-store');expect(e.platform.env.DATA_BUCKET.get).toHaveBeenCalledWith('feed/abc.gz');
 expect((await archive(event('/api/archive?key=archives/a/b.gz'))).status).toBe(403);
 const conditional=event('/api/feed',{headers:{'If-None-Match':'"abc"'}});expect((await feed(conditional)).status).toBe(304);expect(conditional.platform.env.DATA_BUCKET.get).not.toHaveBeenCalled();
 identity.active=false;expect((await feed(conditional)).status).toBe(403);
});
it('rejects traversal and non-archive keys even for valid credentials',async()=>{
 identity.active=true;identity.role='super_admin';expect((await archive(event('/api/archive?key=state/abc.gz'))).status).toBe(400);
 const e=event('/api/internal/blob/state/a',{headers:{Authorization:'Bearer secret'}});e.params.key='state/../feed/abc.gz';expect((await getBlob(e)).status).toBe(400);
});

it('reads native SvelteKit 3 Cloudflare bindings when platform is absent',async()=>{
 const e=event('/api/internal/blob/state/abc.gz',{headers:{Authorization:'Bearer secret'}});const bucket=e.platform.env.DATA_BUCKET;Object.assign(nativeEnv,e.platform.env);delete e.platform;
 expect((await getBlob(e)).status).toBe(200);expect(bucket.get).toHaveBeenCalledWith('state/abc.gz');
 const publicEvent=event('/api/preview');delete publicEvent.platform;expect((await preview(publicEvent)).headers.get('X-Data-Source')).toBe('r2');
});

it('tennis upload requires administrator identity, origin and explicit license before storing history',async()=>{
 const e=event('/api/admin/tennis',{method:'POST',headers:{Origin:'https://example.test'},body:'{}'});expect((await tennisUpload(e)).status).toBe(403);expect(e.platform.env.DATA_BUCKET.put).not.toHaveBeenCalled();
 identity.role='super_admin';identity.active=true;identity.token='token';
 const wrong=event('/api/admin/tennis',{method:'POST',headers:{Origin:'https://wrong.test'},body:'{}'});expect((await tennisUpload(wrong)).status).toBe(403);
 const missing=event('/api/admin/tennis',{method:'POST',headers:{Origin:'https://example.test'},body:JSON.stringify({rows:[{}]})});expect((await tennisUpload(missing)).status).toBe(400);expect(missing.platform.env.DATA_BUCKET.put).not.toHaveBeenCalled();
 const good=event('/api/admin/tennis',{method:'POST',headers:{Origin:'https://example.test'},body:JSON.stringify({license:{source:'Test source',name:'Test only',commercialUseApproved:true},rows:[{id:'test'}]})});expect((await tennisUpload(good)).status).toBe(201);expect(good.platform.env.DATA_BUCKET.put).toHaveBeenCalledTimes(2);expect(good.platform.env.DATA_BUCKET.put.mock.calls[0][0].startsWith('archives/tennis/datasets/')).toBe(true);
});
