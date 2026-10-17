import webpush from 'web-push';
import { describe, expect, it, afterEach, beforeEach, vi } from 'vitest';
import { convexTest } from 'convex-test';
import betterAuth from '@convex-dev/better-auth/test';
import { componentsGeneric, anyApi } from 'convex/server';
import schema from '../../convex/schema';
const modules = import.meta.glob('../../convex/**/*.ts');
const create = () => { const t = convexTest(schema, modules); betterAuth.register(t); return t; };
beforeEach(()=>{vi.stubEnv('BETTER_AUTH_SECRET',crypto.randomUUID()+crypto.randomUUID());vi.stubEnv('SITE_URL','https://puntersedge.example.test');vi.stubEnv('CONVEX_SITE_URL','https://backend.example.test');});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

async function member(t: ReturnType<typeof create>, email = 'member@example.test') {
 const component = componentsGeneric().betterAuth;
 const user = await t.mutation(component.adapter.create, {input:{model:'user',data:{name:'Member',email,emailVerified:true,createdAt:Date.now(),updatedAt:Date.now()}}});
 const session = await t.mutation(component.adapter.create,{input:{model:'session',data:{userId:user._id,token:crypto.randomUUID(),expiresAt:Date.now()+3600000,createdAt:Date.now(),updatedAt:Date.now()}}});
 const signed = t.withIdentity({subject:user._id,sessionId:session._id});
 const localId = await signed.mutation(anyApi.users.syncProfile,{});
 return {signed,localId};
}

describe('backend access and subscription security', () => {
 it('saved ticket rules are owner scoped, entitlement gated and reusable without sharing records',async()=>{
  const t=create(),a=await member(t,'rules-a@example.test'),b=await member(t,'rules-b@example.test');
  const rules={sports:['football'],markets:[],direction:'all',window:'12',minOdds:1.15,maxOdds:4,minTotal:2,maxTotal:25,minProbability:55,positiveValue:false,dateFrom:'',dateTo:''};
  await expect(a.signed.mutation(anyApi.ticketRules.save,{name:'Morning',rules})).rejects.toThrow('subscription');
  await t.run(async ctx=>{for(const userId of [a.localId,b.localId])await ctx.db.insert('subscriptions',{userId,expiresAt:Date.now()+3600000,updatedAt:Date.now()});});
  const id=await a.signed.mutation(anyApi.ticketRules.save,{name:'Morning',rules});
  expect(await b.signed.query(anyApi.ticketRules.list,{})).toEqual([]);
  await expect(b.signed.mutation(anyApi.ticketRules.remove,{id})).rejects.toThrow('not found');
  await a.signed.mutation(anyApi.ticketRules.save,{name:'Morning',rules:{...rules,minProbability:70}});
  expect(await a.signed.query(anyApi.ticketRules.list,{})).toMatchObject([{_id:id,name:'Morning',rules:{minProbability:70}}]);
  await a.signed.mutation(anyApi.ticketRules.remove,{id});expect(await a.signed.query(anyApi.ticketRules.list,{})).toEqual([]);
 });
 it('continuous learning reports are private and non-improving candidates cannot replace a serving model',async()=>{
  const t=create();await expect(t.query(anyApi.learning.summary,{})).rejects.toThrow('Administrator');
  const {signed,localId}=await member(t,'learning-owner@example.test');vi.stubEnv('SUPER_ADMIN_USER_ID',localId);
  const artifact={sport:'football',scope:'full',version:'incumbent',league:'Test',trainedThrough:'2024-01-01',intercept:0,homeAdvantage:0,rho:0,teams:{a:{attack:0,defence:0},b:{attack:0,defence:0}},trainingCount:100};
  const id=await signed.mutation(anyApi.models.register,{artifact});await signed.mutation(anyApi.models.shadowActivate,{id});
  await t.mutation(anyApi.learning.patch,{data:{fingerprint:'test-data'}});
  const bad={artifact:{...artifact,version:'bad-candidate'},incumbentVersion:'incumbent',evaluation:{n:50,newTrainingRows:30,candidateBrier:.5,incumbentBrier:.2,candidateLogLoss:.6,incumbentLogLoss:.4,candidateMae:1,incumbentMae:1,candidateCutoff:1,incumbentCutoff:1,testStart:2}};
  await t.mutation(anyApi.learning.finish,{report:{status:'Evaluated'},candidates:[bad],fingerprint:'test-data'});
  expect(await signed.query(anyApi.models.list,{})).toMatchObject([{version:'incumbent',mode:'active'}]);
  const better={...bad,artifact:{...artifact,version:'better-candidate'},evaluation:{...bad.evaluation,candidateBrier:.15,candidateLogLoss:.3}};
  await t.mutation(anyApi.learning.finish,{report:{status:'Evaluated'},candidates:[better],fingerprint:'test-data'});
  expect(await signed.query(anyApi.models.list,{})).toEqual(expect.arrayContaining([expect.objectContaining({version:'better-candidate',mode:'active',approved:false,approvedMarkets:[]}),expect.objectContaining({version:'incumbent',mode:'retired'})]));
  await expect(t.mutation(anyApi.learning.finish,{report:{},candidates:[],fingerprint:'different-data'})).rejects.toThrow('changed');
 });
 it('model registry rejects anonymous import and never approves a candidate on activation',async()=>{
  const t=create();await expect(t.query(anyApi.models.list,{})).rejects.toThrow('Administrator');
  const {signed,localId}=await member(t,'model-owner@example.test');vi.stubEnv('SUPER_ADMIN_USER_ID',localId);
  const artifact={sport:'football',version:'test-candidate',league:'Test',trainedThrough:'2024-01-01T00:00:00Z',intercept:0,homeAdvantage:0,rho:0,teams:{a:{attack:0,defence:0},b:{attack:0,defence:0}},trainingCount:100};
  const id=await signed.mutation(anyApi.models.register,{artifact});await signed.mutation(anyApi.models.shadowActivate,{id});
  expect(await signed.query(anyApi.models.list,{})).toMatchObject([{mode:'active',approved:false,approvedMarkets:[]}]);
  await expect(signed.mutation(anyApi.models.register,{artifact})).rejects.toThrow('immutable');
  await signed.mutation(anyApi.models.retire,{id});expect(await signed.query(anyApi.models.list,{})).toMatchObject([{mode:'retired',approved:false}]);
 });
 it('deployment candidate installer requires configured owner and preserves immutable unapproved versions',async()=>{
  const t=create();await expect(t.mutation(anyApi.models.installCandidates,{artifacts:[]})).rejects.toThrow('Configured administrator');
  const {localId}=await member(t,'deploy-owner@example.test');vi.stubEnv('SUPER_ADMIN_USER_ID',localId);
  const artifact={sport:'football',version:'deploy-candidate',league:'L',trainedThrough:'2024-01-01T00:00:00Z',intercept:0,homeAdvantage:0,rho:0,teams:{a:{attack:0,defence:0},b:{attack:0,defence:0}},trainingCount:100};
  expect(await t.mutation(anyApi.models.installCandidates,{artifacts:[artifact]})).toMatchObject({installed:1,approved:false});
  expect(await t.mutation(anyApi.models.installCandidates,{artifacts:[artifact]})).toMatchObject({installed:0});
  await expect(t.mutation(anyApi.models.installCandidates,{artifacts:[{...artifact,rho:.01}]})).rejects.toThrow('Immutable');
  const rows=await t.run(ctx=>ctx.db.query('model_artifacts').collect());expect(rows).toHaveLength(1);expect(rows[0]).toMatchObject({approved:false,mode:'active',approvedMarkets:[]});
 });
 it('rejects anonymous access to live files, admin actions and payment checkout', async () => {
  const t = create();
  await expect(t.query(anyApi.feed.meta, {})).rejects.toThrow('Sign in');
  await expect(t.query(anyApi.admin.overview, {})).rejects.toThrow('Administrator');
  await expect(t.mutation(anyApi.workflows.refreshData, {})).rejects.toThrow();
  await expect(t.action(anyApi.payments.checkout, { provider: 'flutterwave' })).rejects.toThrow('Sign in');
 });
 it('enforces paid access and immutable administrator identity for signed-in accounts', async () => {
  const t=create(); const {signed,localId}=await member(t,'owner@example.test');
  vi.stubEnv('SUPER_ADMIN_USER_ID','another-user');
  expect(await signed.query(anyApi.admin.status,{})).toEqual({isSuperAdmin:false});
  await expect(signed.query(anyApi.admin.overview,{})).rejects.toThrow('Administrator');
  await expect(signed.query(anyApi.feed.meta,{})).rejects.toThrow('active all-access');
  await t.run(async ctx=>ctx.db.insert('subscriptions',{userId:localId,expiresAt:Date.now()+60000,updatedAt:Date.now()}));
  expect(await signed.query(anyApi.feed.meta,{})).toBeNull();
  vi.stubEnv('SUPER_ADMIN_USER_ID',localId);
  expect(await signed.query(anyApi.admin.status,{})).toEqual({isSuperAdmin:true});
  await signed.query(anyApi.admin.overview,{});
 });
 it('RBAC protects premium slips and role changes follow subscription expiry without granting admin',async()=>{
  const t=create(),{signed,localId}=await member(t);
  expect(await signed.query(anyApi.access.role,{})).toMatchObject({role:'member',active:false});
  await expect(signed.query(anyApi.betslip.history,{})).rejects.toThrow('active all-access');
  await t.run(async ctx=>ctx.db.insert('subscriptions',{userId:localId,expiresAt:Date.now()+10000,updatedAt:Date.now()}));
  expect(await signed.query(anyApi.access.role,{})).toMatchObject({role:'subscriber',active:true});
  expect(await signed.query(anyApi.betslip.history,{})).toEqual([]);
  await expect(signed.query(anyApi.admin.overview,{})).rejects.toThrow('Administrator');
  await t.run(async ctx=>{const row=await ctx.db.query('subscriptions').unique();await ctx.db.patch(row!._id,{expiresAt:Date.now()-1});});
  await expect(signed.query(anyApi.betslip.history,{})).rejects.toThrow('active all-access');
  vi.stubEnv('SUPER_ADMIN_USER_ID',localId);expect(await signed.query(anyApi.access.role,{})).toMatchObject({role:'super_admin',active:true});
 });
 it('premium downloads require current entitlement and never disclose a storage URL in public metadata',async()=>{
  const t=create(),{signed,localId}=await member(t);
  const storageId=await t.run(ctx=>ctx.storage.store(new Blob(['test-feed'])));
  await t.run(ctx=>ctx.db.insert('feed_state',{key:'feed',data:{storageId,version:'v1',generatedAt:new Date().toISOString()}}));
  expect((await t.fetch('/feed')).status).toBe(403);
  expect((await signed.fetch('/feed')).status).toBe(403);
  const subscription=await t.run(ctx=>ctx.db.insert('subscriptions',{userId:localId,expiresAt:Date.now()+10000,updatedAt:Date.now()}));
  expect(await signed.query(anyApi.feed.meta,{})).toMatchObject({url:'/api/feed'});
  vi.stubGlobal('fetch',vi.fn(async()=>new Response('test-feed')));
  const response=await signed.fetch('/feed');expect(response.status).toBe(200);expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  await t.run(ctx=>ctx.db.patch(subscription,{expiresAt:Date.now()-1}));expect((await signed.fetch('/feed')).status).toBe(403);
 });
 it('payment status checks are owner-scoped, throttled, and verify the charge before granting access',async()=>{
  const t=create(),{signed,localId}=await member(t),other=await member(t,'another@example.test');
  const reference='pe_owner_check';
  await t.run(ctx=>ctx.db.insert('payments',{userId:localId,provider:'flutterwave',reference,apiVersion:'v4',providerCustomerId:'cus_owner',amount:10000,currency:'NGN',status:'pending',createdAt:Date.now()}));
  await expect(other.signed.action(anyApi.payments.checkStatus,{reference})).rejects.toThrow('Payment not found');
  vi.stubEnv('FLW_CLIENT_ID','unit-client');vi.stubEnv('FLW_SECRET_KEY','unit-secret');
  const charge={id:'chg_owner',reference,customer_id:'cus_owner',amount:10000,currency:'NGN',status:'succeeded'};
  vi.stubGlobal('fetch',vi.fn(async(url:string)=>url.includes('openid-connect')?Response.json({access_token:'unit-token',expires_in:3600}):url.includes('?reference=')?Response.json({status:'success',data:[charge]}):Response.json({status:'success',data:charge})));
  expect(await signed.action(anyApi.payments.checkStatus,{reference})).toEqual({paid:true});
  expect((await t.run(ctx=>ctx.db.query('subscriptions').withIndex('by_user',q=>q.eq('userId',localId)).unique()))?.expiresAt).toBeGreaterThan(Date.now());
  expect(await signed.action(anyApi.payments.checkStatus,{reference})).toEqual({paid:true});
  const next='pe_pending_check';await t.run(ctx=>ctx.db.insert('payments',{userId:localId,provider:'flutterwave',reference:next,apiVersion:'v4',providerCustomerId:'cus_owner',amount:10000,currency:'NGN',status:'pending',createdAt:Date.now()}));
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json({status:'success',data:[]})));
  expect(await signed.action(anyApi.payments.checkStatus,{reference:next})).toEqual({paid:false});
  await expect(signed.action(anyApi.payments.checkStatus,{reference:next})).rejects.toThrow('30 seconds');
 });
 it('removed Korapay routes and checkout cannot be used',async()=>{const t=create();expect((await t.fetch('/payments/korapay',{method:'POST'})).status).toBe(404);await expect(t.action(anyApi.payments.checkout,{provider:'korapay'})).rejects.toThrow('Validator');});
 it('rejects invalid webhook signatures without granting access', async () => {
  vi.stubEnv('BETTER_AUTH_SECRET',crypto.randomUUID()+crypto.randomUUID());
  vi.stubEnv('SITE_URL','https://puntersedge.example.test');
  vi.stubEnv('CONVEX_SITE_URL','https://backend.example.test');
  vi.stubEnv('FLW_SECRET_KEY','test-only-not-a-live-key');vi.stubEnv('FLW_SECRET_HASH','test-webhook-hash');vi.stubEnv('FLW_API_VERSION','v3');
  const t=create();
  const response=await t.fetch('/payments/flutterwave',{method:'POST',headers:{'Content-Type':'application/json','flutterwave-signature':'invalid'},body:JSON.stringify({event:'charge.completed',data:{reference:'forged'}})});
  expect(response.status).toBe(401);
  expect(await t.run(async ctx=>ctx.db.query('subscriptions').collect())).toEqual([]);
 });
 it('validates a signed webhook against provider data before granting membership', async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-12T12:00:00Z'));
  vi.stubEnv('BETTER_AUTH_SECRET',crypto.randomUUID()+crypto.randomUUID());
  vi.stubEnv('SITE_URL','https://puntersedge.example.test');
  vi.stubEnv('CONVEX_SITE_URL','https://backend.example.test');
  vi.stubEnv('FLW_SECRET_KEY','test-only-not-a-live-key');vi.stubEnv('FLW_SECRET_HASH','test-webhook-hash');vi.stubEnv('FLW_API_VERSION','v3');
  const t=create(); const userId=await t.run(async ctx=>ctx.db.insert('users',{}));
  await t.run(async ctx=>ctx.db.insert('payments',{userId,provider:'flutterwave',reference:'pe_signed-ref',amount:10000,currency:'NGN',status:'pending',createdAt:Date.now()}));
  const data={tx_ref:'pe_signed-ref',id:123,status:'successful'};
  vi.stubGlobal('fetch',vi.fn(async (url: string)=>{
   expect(url).toBe('https://api.flutterwave.com/v3/transactions/123/verify');
   return Response.json({status:true,data:{id:123,status:'successful',tx_ref:'pe_signed-ref',amount:10000,currency:'NGN'}});
  }));
  const init={method:'POST',headers:{'Content-Type':'application/json','verif-hash':'test-webhook-hash'},body:JSON.stringify({event:'charge.completed',data})};
  expect((await t.fetch('/payments/flutterwave',init)).status).toBe(200);
  const first=await t.run(async ctx=>ctx.db.query('subscriptions').unique());
  expect((await t.fetch('/payments/flutterwave',init)).status).toBe(200);
  expect((await t.run(async ctx=>ctx.db.query('subscriptions').unique()))?.expiresAt).toBe(first?.expiresAt);
  expect(fetch).toHaveBeenCalledTimes(1);
 });
 it('limits backend AI attempts and returns a cached answer without consuming another attempt', async () => {
  const t=create();const userId='test-user';
  for(let i=0;i<10;i++)await t.mutation(anyApi.ai_usage.reserve,{userId,cacheKey:`fixture-${i}`});
  await t.mutation(anyApi.ai_usage.save,{userId,cacheKey:'fixture-9',result:{text:'Grounded result',provider:'test',generatedAt:Date.now()}});
  expect(await t.mutation(anyApi.ai_usage.reserve,{userId,cacheKey:'fixture-9'})).toMatchObject({result:{text:'Grounded result'}});
  await expect(t.mutation(anyApi.ai_usage.reserve,{userId,cacheKey:'new-fixture'})).rejects.toThrow('Daily AI limit');
 });
 it('prevents duplicate in-flight requests and enforces an application-wide provider cap', async () => {
  const t=create();
  await t.mutation(anyApi.ai_usage.reserve,{userId:'duplicate-user',cacheKey:'fixture'});
  await expect(t.mutation(anyApi.ai_usage.reserve,{userId:'duplicate-user',cacheKey:'fixture'})).rejects.toThrow('already being requested');
  for(let i=0;i<99;i++) await t.mutation(anyApi.ai_usage.reserve,{userId:`budget-user-${i}`,cacheKey:`fixture-${i}`,provider:'agnes'});
  await expect(t.mutation(anyApi.ai_usage.reserve,{userId:'next-user',cacheKey:'last',provider:'agnes'})).rejects.toThrow("daily AI budget");
  expect(await t.mutation(anyApi.ai_usage.reserve,{userId:'other-provider',cacheKey:'free-model',provider:'aihubmix'})).toMatchObject({result:null});
 });
 it('allows subscribed device registration and rejects private network endpoints', async () => {
  const t=create(); const {signed,localId}=await member(t);
  const device={endpoint:'https://fcm.googleapis.com/fcm/send/test-device',p256dh:'B'.repeat(87),auth:'A'.repeat(22)};
  await expect(signed.mutation(anyApi.push.register,device)).rejects.toThrow('active all-access');
  await t.run(async ctx=>ctx.db.insert('subscriptions',{userId:localId,expiresAt:Date.now()+60000,updatedAt:Date.now()}));
  await expect(signed.mutation(anyApi.push.register,{...device,endpoint:'https://127.0.0.1/private'})).rejects.toThrow('Unsupported push');
  await signed.mutation(anyApi.push.register,device);
  expect(await t.run(async ctx=>ctx.db.query('push_subscriptions').collect())).toHaveLength(1);
  await signed.mutation(anyApi.push.remove,{endpoint:device.endpoint});
  expect(await t.run(async ctx=>ctx.db.query('push_subscriptions').collect())).toHaveLength(0);
 });
 it('grants one month exactly once and refuses mismatched verified payments', async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-01-31T12:00:00Z'));
  const t = create();
  const userId = await t.run(async ctx => ctx.db.insert('users', { email: 'member@example.test' }));
  await t.run(async ctx => ctx.db.insert('payments', {userId, provider:'flutterwave',reference:'trusted-reference',amount:10000,currency:'NGN',status:'pending',createdAt:Date.now()}));
  const verified = {provider:'flutterwave',reference:'trusted-reference',transactionId:'txn-1',amount:10000,currency:'NGN'};
  await expect(t.mutation(anyApi.payments.settle, {...verified,amount:100})).rejects.toThrow();
  await expect(t.mutation(anyApi.payments.settle, {...verified,currency:'USD'})).rejects.toThrow();
  await t.mutation(anyApi.payments.settle, verified);
  await t.mutation(anyApi.payments.settle, verified);
  const subscription = await t.run(async ctx => ctx.db.query('subscriptions').unique());
  expect(subscription?.expiresAt).toBe(Date.parse('2026-02-28T12:00:00Z'));
  expect(await t.run(async ctx => ctx.db.query('payments').unique())).toMatchObject({status:'paid',providerTransactionId:'txn-1'});
 });
 it('paid renewals stack from existing expiry; failed verification cannot create access', async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-12T12:00:00Z'));
  const t = create();
  const userId = await t.run(async ctx => ctx.db.insert('users', {}));
  const expiry = Date.parse('2026-11-12T12:00:00Z');
  await t.run(async ctx => ctx.db.insert('subscriptions',{userId,expiresAt:expiry,updatedAt:Date.now()}));
  await t.run(async ctx => ctx.db.insert('payments',{userId,provider:'flutterwave',reference:'renew',amount:10000,currency:'NGN',status:'pending',createdAt:Date.now()}));
  await expect(t.mutation(anyApi.payments.settle,{provider:'flutterwave',reference:'renew',transactionId:'txn',amount:9999,currency:'NGN'})).rejects.toThrow();
  await t.mutation(anyApi.payments.settle,{provider:'flutterwave',reference:'renew',transactionId:'txn',amount:10000,currency:'NGN'});
  expect((await t.run(async ctx => ctx.db.query('subscriptions').unique()))?.expiresAt).toBe(Date.parse('2026-12-12T12:00:00Z'));
 });
});

it('anonymous board preview downloads only its separate sanitized file',async()=>{
 const t=create();const previewId=await t.run(ctx=>ctx.storage.store(new Blob(['sanitized-preview']))),premiumId=await t.run(ctx=>ctx.storage.store(new Blob(['premium-data'])));
 await t.run(ctx=>ctx.db.insert('feed_state',{key:'feed',data:{storageId:premiumId,previewStorageId:previewId,previewVersion:'safe-v1'}}));
 vi.stubGlobal('fetch',vi.fn(async()=>new Response('sanitized-preview')));
 const response=await t.fetch('/preview');expect(response.status).toBe(200);expect(await response.text()).toBe('sanitized-preview');expect(response.headers.get('Cache-Control')).toContain('public');
 expect((await t.fetch('/feed')).status).toBe(403);
});
it('notification preferences are account-owned and every send rechecks preferences, subscription and duplicate rate',async()=>{
 const t=create(),a=await member(t,'alerts-a@example.test'),b=await member(t,'alerts-b@example.test');
 const preferences={newMatches:false,liveStarts:true,scoreUpdates:false,finishedGames:true,activities:true};
 await a.signed.mutation(anyApi.push.savePreferences,{preferences});expect(await b.signed.query(anyApi.push.preferences,{})).toMatchObject({newMatches:true});
 const expiry=Date.now()+60000;
 const ids=await t.run(async ctx=>{await ctx.db.insert('subscriptions',{userId:a.localId,expiresAt:expiry,updatedAt:Date.now()});const sub=await ctx.db.insert('subscriptions',{userId:b.localId,expiresAt:Date.now()-1,updatedAt:Date.now()});const first=await ctx.db.insert('push_subscriptions',{userId:a.localId,endpoint:'https://fcm.googleapis.com/fcm/send/a',p256dh:'B'.repeat(87),auth:'A'.repeat(22),createdAt:Date.now()});const second=await ctx.db.insert('push_subscriptions',{userId:b.localId,endpoint:'https://fcm.googleapis.com/fcm/send/b',p256dh:'B'.repeat(87),auth:'A'.repeat(22),createdAt:Date.now()});return {first,second,sub};});
 expect((await t.query(anyApi.push.recipients,{event:'newMatches'})).recipients).toHaveLength(0);expect((await t.query(anyApi.push.recipients,{event:'finishedGames'})).recipients).toHaveLength(1);
 expect(await t.mutation(anyApi.push.claimAlert,{id:ids.first,event:'newMatches',batchId:'one',now:Date.now()})).toBe(false);
 expect(await t.mutation(anyApi.push.claimAlert,{id:ids.first,event:'finishedGames',batchId:'one',now:Date.now()})).toBe(true);
 expect(await t.mutation(anyApi.push.claimAlert,{id:ids.first,event:'finishedGames',batchId:'one',now:Date.now()+1})).toBe(false);
 expect(await t.mutation(anyApi.push.claimAlert,{id:ids.first,event:'finishedGames',batchId:'two',now:Date.now()+2})).toBe(false);
 expect(await t.mutation(anyApi.push.claimAlert,{id:ids.second,event:'finishedGames',batchId:'three',now:Date.now()})).toBe(false);
 expect(await t.mutation(anyApi.push.claimAlert,{id:ids.first,event:'activities',targetUserId:b.localId,batchId:'wrong-owner',now:Date.now()})).toBe(false);
 expect((await t.query(anyApi.push.recipients,{event:'activities',targetUserId:b.localId})).recipients.map(d=>d.userId)).toEqual([b.localId]);
 expect(await t.mutation(anyApi.push.claimAlert,{id:ids.second,event:'activities',targetUserId:b.localId,batchId:'expired-account-notice',now:Date.now()})).toBe(true);
 await b.signed.mutation(anyApi.push.savePreferences,{preferences:{...preferences,activities:false}});
 expect(await t.mutation(anyApi.push.claimAlert,{id:ids.second,event:'activities',targetUserId:b.localId,batchId:'disabled-notice',now:Date.now()+900001})).toBe(false);
});

function pushKeys(){const keys=webpush.generateVAPIDKeys();vi.stubEnv('PUBLIC_VAPID_KEY',keys.publicKey);vi.stubEnv('VAPID_PRIVATE_KEY',keys.privateKey);vi.stubEnv('VAPID_SUBJECT','mailto:alerts@example.test');return keys;}
it('device status verifies backend ownership; a real-send test is subscribed, owner-scoped and throttled',async()=>{
 const t=create(),a=await member(t,'test-push-a@example.test'),b=await member(t,'test-push-b@example.test');
 const keys=pushKeys(),device={endpoint:'https://fcm.googleapis.com/fcm/send/device-test',p256dh:keys.publicKey,auth:Buffer.alloc(16).toString('base64url')};
 const send=vi.spyOn(webpush,'sendNotification').mockResolvedValue({statusCode:201,headers:{},body:''});
 await expect(a.signed.action(anyApi.notifications.testDevice,{endpoint:device.endpoint})).rejects.toThrow('active all-access');
 await t.run(ctx=>ctx.db.insert('subscriptions',{userId:a.localId,expiresAt:Date.now()+3600000,updatedAt:Date.now()}));
 await t.run(ctx=>ctx.db.insert('subscriptions',{userId:b.localId,expiresAt:Date.now()+3600000,updatedAt:Date.now()}));
 expect(await a.signed.query(anyApi.push.deviceStatus,{endpoint:device.endpoint})).toEqual({registered:false,lastDelivery:null});
 await a.signed.mutation(anyApi.push.register,device);
 expect(await a.signed.query(anyApi.push.deviceStatus,{endpoint:device.endpoint})).toEqual({registered:true,lastDelivery:null});
 expect(await b.signed.query(anyApi.push.deviceStatus,{endpoint:device.endpoint})).toEqual({registered:false,lastDelivery:null});
 await expect(b.signed.action(anyApi.notifications.testDevice,{endpoint:device.endpoint})).rejects.toThrow('Connect this device');
 expect(send).toHaveBeenCalledTimes(0);
 expect(await a.signed.action(anyApi.notifications.testDevice,{endpoint:device.endpoint})).toEqual({accepted:true,statusCode:201});
 expect(send).toHaveBeenCalledTimes(1);expect(JSON.parse(send.mock.calls[0][1] as string).title).toBe('PuntersEdge notification test');
 expect(await a.signed.query(anyApi.push.deviceStatus,{endpoint:device.endpoint})).toMatchObject({registered:true,lastDelivery:{outcome:'accepted',statusCode:201}});
 await expect(a.signed.action(anyApi.notifications.testDevice,{endpoint:device.endpoint})).rejects.toThrow('five minutes');expect(send).toHaveBeenCalledTimes(1);
});
it('delivery test respects saved preferences and removes an expired push endpoint',async()=>{
 const t=create(),a=await member(t,'expired-device@example.test'),keys=pushKeys();
 await t.run(ctx=>ctx.db.insert('subscriptions',{userId:a.localId,expiresAt:Date.now()+3600000,updatedAt:Date.now()}));
 const device={endpoint:'https://web.push.apple.com/test-expired',p256dh:keys.publicKey,auth:Buffer.alloc(16).toString('base64url')};await a.signed.mutation(anyApi.push.register,device);
 const preferences={newMatches:true,liveStarts:true,scoreUpdates:false,finishedGames:true,activities:false};await a.signed.mutation(anyApi.push.savePreferences,{preferences});
 const send=vi.spyOn(webpush,'sendNotification').mockRejectedValue({statusCode:410});
 await expect(a.signed.action(anyApi.notifications.testDevice,{endpoint:device.endpoint})).rejects.toThrow('Enable and save');expect(send).toHaveBeenCalledTimes(0);
 await a.signed.mutation(anyApi.push.savePreferences,{preferences:{...preferences,activities:true}});
 await expect(a.signed.action(anyApi.notifications.testDevice,{endpoint:device.endpoint})).rejects.toThrow('connection expired');expect(send).toHaveBeenCalledTimes(1);
 expect(await a.signed.query(anyApi.push.deviceStatus,{endpoint:device.endpoint})).toEqual({registered:false,lastDelivery:null});
});
it('targeted background test reaches only owner devices and records push service acceptance without claiming phone display',async()=>{
 const t=create(),a=await member(t,'background-a@example.test'),b=await member(t,'background-b@example.test'),keys=pushKeys();vi.stubEnv('SUPER_ADMIN_USER_ID',a.localId);
 await t.run(async ctx=>{await ctx.db.insert('subscriptions',{userId:b.localId,expiresAt:Date.now()+3600000,updatedAt:Date.now()});for(const id of [a.localId,b.localId])await ctx.db.insert('push_subscriptions',{userId:id,endpoint:`https://fcm.googleapis.com/fcm/send/${id}`,p256dh:keys.publicKey,auth:Buffer.alloc(16).toString('base64url'),createdAt:Date.now()});});
 const send=vi.spyOn(webpush,'sendNotification').mockResolvedValue({statusCode:201,headers:{},body:''});
 const args={event:'activities',activity:'testDelivery',count:1,targetUserId:a.localId,batchId:'background-test'};
 expect(await t.action(anyApi.notifications.deliver,args)).toEqual({sent:1,failed:0});expect(send).toHaveBeenCalledTimes(1);expect(JSON.parse(send.mock.calls[0][1] as string)).toMatchObject({title:'PuntersEdge notification test',url:'/settings'});
 expect(await t.action(anyApi.notifications.deliver,args)).toEqual({sent:0,failed:0});expect(send).toHaveBeenCalledTimes(1);
 const devices=await t.run(ctx=>ctx.db.query('push_subscriptions').collect());expect(devices.find(d=>d.userId===a.localId)?.lastDelivery).toMatchObject({outcome:'accepted',statusCode:201});expect(devices.find(d=>d.userId===b.localId)?.lastDelivery).toBeUndefined();
});

describe('individual tester access',()=>{
 it('requires a complete profile, isolates users, prevents renewal by reuse and enforces suspension',async()=>{
 const t=create(),a=await member(t,'tester-a@example.test'),b=await member(t,'tester-b@example.test'),owner=await member(t,'owner@example.test');
 vi.stubEnv('TESTER_INVITE_EMAIL','invite@example.test');vi.stubEnv('TESTER_INVITE_PASSWORD','test-only-password');vi.stubEnv('SUPER_ADMIN_USER_ID',owner.localId);
 const profile={fullName:'Example Tester',whatsapp:'+2348012345678',dob:'1990-01-01',sex:'male',state:'Abia',lga:'Aba North'};
 const args={email:'invite@example.test',password:'test-only-password',profile};
 await expect(a.signed.mutation(anyApi.testers.redeem,{...args,profile:{...profile,lga:'Invalid area'}})).rejects.toThrow('valid state');
 expect(await a.signed.mutation(anyApi.testers.redeem,args)).toHaveProperty('expiresAt');
 expect(await a.signed.query(anyApi.access.role,{})).toMatchObject({active:true});
 expect(await b.signed.query(anyApi.testers.mine,{})).toBeNull();
 expect(await a.signed.mutation(anyApi.testers.redeem,args)).toHaveProperty('error');
 await expect(a.signed.mutation(anyApi.testers.setAccess,{userId:b.localId,status:'active',period:'free'})).rejects.toThrow('Administrator');
 await owner.signed.mutation(anyApi.testers.setAccess,{userId:a.localId,status:'suspended',period:'free'});
 expect(await a.signed.query(anyApi.access.role,{})).toMatchObject({active:false,status:'suspended'});
 await expect(a.signed.query(anyApi.ticketRules.list,{})).rejects.toThrow('suspended');
 await owner.signed.mutation(anyApi.testers.setAccess,{userId:a.localId,status:'active',period:'free'});
 expect(await a.signed.query(anyApi.access.role,{})).toMatchObject({active:true});
 });
 it('limits invitation attempts and rejects expired tester grants',async()=>{
 const t=create(),a=await member(t);vi.stubEnv('TESTER_INVITE_EMAIL','invite@example.test');vi.stubEnv('TESTER_INVITE_PASSWORD','correct');
 const args={email:'invite@example.test',password:'wrong',profile:{fullName:'Example Tester',whatsapp:'+2348012345678',dob:'1990-01-01',sex:'male',state:'Abia',lga:'Aba North'}};
 for(let i=0;i<5;i++)await a.signed.mutation(anyApi.testers.redeem,args);
 expect((await a.signed.mutation(anyApi.testers.redeem,args)).error).toContain('15 minutes');
 await t.run(ctx=>ctx.db.insert('account_access',{userId:a.localId,status:'active',kind:'tester',grant:'timed',expiresAt:Date.now()-1000,updatedAt:Date.now()}));
 expect(await a.signed.query(anyApi.access.role,{})).toMatchObject({active:false});
 });
});

it('presence batches actions, strips queries, bounds history and throttles writes',async()=>{const t=create(),a=await member(t);const event={event:'slip_added',at:Date.now(),route:'/board?private=excluded'};expect(await a.signed.mutation(anyApi.testers.presence,{route:'/board?private=excluded',events:[event,{...event,event:'password'}]})).toBe(true);expect(await a.signed.mutation(anyApi.testers.presence,{route:'/account',events:[event]})).toBe(false);const rows=await t.run(ctx=>ctx.db.query('user_presence').collect());expect(rows).toHaveLength(1);expect(rows[0]).toMatchObject({route:'/board',events:[{event:'slip_added',route:'/board'}]});});
