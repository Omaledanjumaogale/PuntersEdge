import {describe,it,expect,vi,afterEach,beforeEach} from 'vitest';
import {convexTest} from 'convex-test';import betterAuth from '@convex-dev/better-auth/test';import {anyApi,componentsGeneric,createFunctionHandle} from 'convex/server';
import schema from '../../convex/schema';import {signHmac,checkoutUrl,validateKoraCharge} from '../../convex/lib/paymentSecurity';
const modules=import.meta.glob('../../convex/**/*.ts');const create=()=>{const t=convexTest(schema,modules);betterAuth.register(t);return t;};
async function member(t:ReturnType<typeof create>,email='member@example.test'){
 const a=componentsGeneric().betterAuth.adapter;
 const user=await t.mutation(a.create,{input:{model:'user',data:{name:'Member',email,emailVerified:true,createdAt:Date.now(),updatedAt:Date.now()}}});
 const session=await t.mutation(a.create,{input:{model:'session',data:{userId:user._id,token:crypto.randomUUID(),expiresAt:Date.now()+3600000,createdAt:Date.now(),updatedAt:Date.now()}}});
 const signed=t.withIdentity({subject:user._id,sessionId:session._id});const localId=await signed.mutation(anyApi.users.syncProfile,{});return {signed,localId};
}
beforeEach(()=>{vi.stubEnv('BETTER_AUTH_SECRET',crypto.randomUUID()+crypto.randomUUID());vi.stubEnv('SITE_URL','https://puntersedge.example.test');vi.stubEnv('CONVEX_SITE_URL','https://backend.example.test');vi.stubEnv('CONVEX_HTTP_ACTIONS_URL','https://backend.example.test');});
afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllEnvs();vi.unstubAllGlobals();});
describe('member-specific controls and billing lifecycle',()=>{
 it('changes only the requested member and preserves dates on status-only changes',async()=>{
  const t=create(),owner=await member(t,'owner@example.test'),a=await member(t,'a@example.test'),b=await member(t,'b@example.test');vi.stubEnv('SUPER_ADMIN_USER_ID',owner.localId);
  await owner.signed.mutation(anyApi.testers.setAccess,{userId:a.localId,status:'active',period:'week'});
  await owner.signed.mutation(anyApi.testers.setAccess,{userId:b.localId,status:'active',period:'quarter'});
  const before=await owner.signed.query(anyApi.testers.members,{paginationOpts:{numItems:25,cursor:null}});
  const previous=before.page.find((u:any)=>u.id===a.localId).access;
  await owner.signed.mutation(anyApi.testers.setAccess,{userId:a.localId,status:'suspended',period:'keep'});
  const after=await owner.signed.query(anyApi.testers.members,{paginationOpts:{numItems:25,cursor:null}});
  expect(after.page.find((u:any)=>u.id===a.localId).access).toMatchObject({status:'suspended',expiresAt:previous.expiresAt,grant:'timed'});
  expect(after.page.find((u:any)=>u.id===b.localId).access).toEqual(before.page.find((u:any)=>u.id===b.localId).access);
  await expect(a.signed.query(anyApi.testers.history,{userId:b.localId})).rejects.toThrow('Administrator');
  expect((await owner.signed.query(anyApi.testers.history,{userId:a.localId})).accessChanges).toHaveLength(2);
 });
 it('records pending-verification signups through auth adapter triggers without granting a session or membership',async()=>{
  const t=create(),handle=await t.run(()=>createFunctionHandle(anyApi.auth.onCreate));
  const account=await t.mutation(componentsGeneric().betterAuth.adapter.create,{input:{model:'user',data:{name:'Awaiting email',email:'pending@example.test',emailVerified:false,createdAt:Date.now(),updatedAt:Date.now()}},onCreateHandle:handle});
  const rows=await t.run(ctx=>ctx.db.query('users').collect());expect(rows).toHaveLength(1);expect(rows[0]).toMatchObject({authSubject:account._id,email:'pending@example.test'});expect(rows[0].emailVerificationTime).toBeUndefined();
  expect(await t.run(ctx=>ctx.db.query('account_events').collect())).toMatchObject([{event:'signup_created'}]);
  expect(await t.run(ctx=>ctx.db.query('subscriptions').collect())).toEqual([]);
 });
 it('HTTP signup syncs an unverified registration into user management while email delivery is mocked',async()=>{
  const t=create();vi.stubEnv('PUNTERSEDGE_RESEND_API_KEY','unit-mail-key');vi.stubEnv('RESEND_FROM_EMAIL','qa@example.test');
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json({id:'unit-message'})));
  const result=await t.fetch('/api/auth/sign-up/email',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://puntersedge.example.test'},body:JSON.stringify({name:'Signup QA',email:'signup-http@example.test',password:'UnitPassword123!'})});
  expect(result.status).toBe(200);expect(await t.run(ctx=>ctx.db.query('users').collect())).toMatchObject([{name:'Signup QA',email:'signup-http@example.test'}]);
  expect(await t.run(ctx=>ctx.db.query('account_events').collect())).toMatchObject([{event:'signup_created'}]);expect(await t.run(ctx=>ctx.db.query('subscriptions').collect())).toEqual([]);
 });
 it('imports older unverified registrations idempotently by auth subject',async()=>{
  const t=create();await t.mutation(componentsGeneric().betterAuth.adapter.create,{input:{model:'user',data:{name:'Older signup',email:'older@example.test',emailVerified:false,createdAt:1,updatedAt:1}}});
  await t.mutation(anyApi.users.importRegistrations,{});await t.mutation(anyApi.users.importRegistrations,{});
  expect(await t.run(ctx=>ctx.db.query('users').collect())).toMatchObject([{email:'older@example.test',registeredAt:1}]);expect(await t.run(ctx=>ctx.db.query('account_events').collect())).toHaveLength(1);
 });
 it('rejects checkout for a suspended account without contacting a provider',async()=>{
  const t=create(),m=await member(t);await t.run(ctx=>ctx.db.insert('account_access',{userId:m.localId,status:'suspended',kind:'tester',grant:'free',updatedAt:Date.now()}));
  vi.stubGlobal('fetch',vi.fn());await expect(m.signed.action(anyApi.payments.checkout,{provider:'flutterwave'})).rejects.toThrow('suspended');expect(fetch).not.toHaveBeenCalled();
 });
 it('initializes Korapay on the server, tracks the attempt, and keeps secrets out of the return value',async()=>{
  const t=create(),m=await member(t);vi.stubEnv('KORAPAY_ENABLED','true');vi.stubEnv('KORAPAY_SECRET_KEY','unit-secret');
  vi.stubGlobal('fetch',vi.fn(async(url:string,init:RequestInit)=>{expect(url).toBe('https://api.korapay.com/merchant/api/v1/charges/initialize');const body=JSON.parse(String(init.body));expect(body).toMatchObject({amount:10000,currency:'NGN',customer:{email:'member@example.test'},notification_url:'https://backend.example.test/payments/korapay'});return Response.json({status:true,data:{reference:body.reference,checkout_url:'https://checkout.korapay.com/test/pay'}});}));
  expect(await m.signed.action(anyApi.payments.checkout,{provider:'korapay'})).toEqual({kind:'redirect',url:'https://checkout.korapay.com/test/pay'});
  const [payment]=await t.run(ctx=>ctx.db.query('payments').collect());expect(payment.status).toBe('pending');expect(payment.checkoutUrl).toContain('checkout.korapay.com');
  expect((await m.signed.query(anyApi.payments.mine,{})).recent).toHaveLength(1);expect(await t.run(ctx=>ctx.db.query('account_events').collect())).toMatchObject([{event:'checkout_started'},{event:'checkout_ready'}]);
 });
 it('prepares Flutterwave v4 transfer instructions and restores them through the owner query',async()=>{
  const t=create(),m=await member(t);vi.stubEnv('FLW_ENABLED','true');vi.stubEnv('FLW_API_VERSION','v4');vi.stubEnv('FLW_SECRET_KEY','unit-flw-key');vi.stubEnv('FLW_CLIENT_ID','unit-flw-client');vi.stubEnv('FLW_SECRET_HASH','unit-flw-hash');
  vi.stubGlobal('fetch',vi.fn(async(url:string,init:RequestInit)=>{
   if(url.includes('openid-connect'))return Response.json({access_token:'unit-flw-token',expires_in:3600});
   if(url.endsWith('/customers'))return Response.json({status:'success',data:{id:'cus_checkout'}});
   if(url.endsWith('/virtual-accounts')){const body=JSON.parse(String(init.body));return Response.json({status:'success',data:{...body,id:'vac_checkout',status:'active',account_number:'0123456789',account_bank_name:'QA Bank',account_expiration_datetime:new Date(Date.now()+3600000).toISOString()}});}
   throw Error('Unexpected provider call');
  }));
  const result=await m.signed.action(anyApi.payments.checkout,{provider:'flutterwave'});expect(result).toMatchObject({kind:'bankTransfer',bankName:'QA Bank',accountNumber:'0123456789'});
  expect((await m.signed.query(anyApi.payments.mine,{})).pendingInstructions).toEqual(result);expect(await t.run(ctx=>ctx.db.query('subscriptions').collect())).toEqual([]);
 });
 it('keeps failed initialization visible and rejects provider redirect injection',async()=>{
  const t=create(),m=await member(t);vi.stubEnv('KORAPAY_ENABLED','true');vi.stubEnv('KORAPAY_SECRET_KEY','unit-secret');
  vi.stubGlobal('fetch',vi.fn(async(_url:string,init:RequestInit)=>{const body=JSON.parse(String(init.body));return Response.json({status:true,data:{reference:body.reference,checkout_url:'https://checkout.korapay.com.attacker.test/pay'}});}));
  await expect(m.signed.action(anyApi.payments.checkout,{provider:'korapay'})).rejects.toThrow('unexpected');
  expect(await t.run(ctx=>ctx.db.query('payments').collect())).toMatchObject([{status:'initialization_failed'}]);expect(await t.run(ctx=>ctx.db.query('subscriptions').collect())).toEqual([]);
 });
 it('verifies signed Korapay notifications against provider values and settles once',async()=>{
  const t=create(),m=await member(t);vi.stubEnv('KORAPAY_SECRET_KEY','unit-secret');const reference='pe_kora_signed';
  await t.run(ctx=>ctx.db.insert('payments',{userId:m.localId,provider:'korapay',reference,amount:10000,currency:'NGN',status:'pending',createdAt:Date.now()}));
  const data={reference,amount:10000,currency:'NGN',status:'success'};const signature=await signHmac(JSON.stringify(data),'unit-secret','hex');
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json({status:true,data})));
  const request={method:'POST',headers:{'x-korapay-signature':signature,'Content-Type':'application/json'},body:JSON.stringify({event:'charge.success',data})};
  expect((await t.fetch('/payments/korapay',request)).status).toBe(200);const first=await t.run(ctx=>ctx.db.query('subscriptions').unique());
  expect((await t.fetch('/payments/korapay',request)).status).toBe(200);expect((await t.run(ctx=>ctx.db.query('subscriptions').unique()))?.expiresAt).toBe(first?.expiresAt);expect(fetch).toHaveBeenCalledTimes(1);
  expect((await t.fetch('/payments/korapay',{...request,headers:{'x-korapay-signature':'forged'}})).status).toBe(401);
 });
 it('underpayment and reused provider transaction ids cannot grant a second membership',async()=>{
  const t=create(),a=await member(t),b=await member(t,'other@example.test');const first='pe_first',second='pe_second';
  for(const [userId,reference] of [[a.localId,first],[b.localId,second]])await t.run(ctx=>ctx.db.insert('payments',{userId,provider:'flutterwave',reference,amount:10000,currency:'NGN',status:'pending',createdAt:Date.now()}));
  await expect(t.mutation(anyApi.payments.settle,{provider:'flutterwave',reference:first,transactionId:'123',amount:9999,currency:'NGN'})).rejects.toThrow('does not match');
  await t.mutation(anyApi.payments.settle,{provider:'flutterwave',reference:first,transactionId:'123',amount:10000,currency:'NGN'});
  await expect(t.mutation(anyApi.payments.settle,{provider:'flutterwave',reference:second,transactionId:'123',amount:10000,currency:'NGN'})).rejects.toThrow('another payment');
  expect(await t.run(ctx=>ctx.db.query('subscriptions').collect())).toHaveLength(1);
 });
 it('reads explanations from private R2 after storage migration without exposing the service secret',async()=>{
  const t=create(),m=await member(t);await t.run(ctx=>ctx.db.insert('subscriptions',{userId:m.localId,expiresAt:Date.now()+3600000,updatedAt:Date.now()}));
  await t.run(ctx=>ctx.db.insert('feed_state',{key:'feed',data:{blobKey:'feed/current.gz',version:'r2-test',generatedAt:new Date().toISOString(),encoding:'json'}}));
  vi.stubEnv('EDGE_DATA_URL','https://puntersedge.ewinproject.org');vi.stubEnv('EDGE_DATA_SECRET','unit-private-secret');vi.stubEnv('ALLOW_GENERATIVE_EXPLANATIONS','false');
  vi.stubGlobal('fetch',vi.fn(async(url:string,init:RequestInit)=>{expect(url).toBe('https://puntersedge.ewinproject.org/api/internal/blob/feed/current.gz');expect(init.headers).toMatchObject({Authorization:'Bearer unit-private-secret'});return Response.json({games:[{id:'real-fixture',sport:'football',home:'Home',away:'Away',league:'League'}]});}));
  const result=await m.signed.action(anyApi.ai_insights.explain,{fixtureId:'real-fixture',sport:'football'});expect(result.text).toContain('Home vs Away');expect(result.text).not.toContain('unit-private-secret');
  await m.signed.action(anyApi.ai_insights.explain,{fixtureId:'real-fixture',sport:'football'});expect(fetch).toHaveBeenCalledTimes(1);
 });
 it('rejects changed Korapay amounts, currency and customer binding',()=>{
  const expected={reference:'pe_ok',amount:10000,currency:'NGN',customerEmail:'ok@example.test'},data={...expected,status:'success',customer:{email:expected.customerEmail}};
  expect(()=>validateKoraCharge(data,expected)).not.toThrow();for(const patch of [{amount:9999},{currency:'USD'},{reference:'pe_other'},{customer:{email:'other@example.test'}}])expect(()=>validateKoraCharge({...data,...patch},expected)).toThrow();
  expect(()=>checkoutUrl('javascript:alert(1)','korapay')).toThrow();expect(()=>checkoutUrl('https://checkout.flutterwave.com/path','flutterwave')).not.toThrow();
 });
});
