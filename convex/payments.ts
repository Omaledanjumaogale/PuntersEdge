import type {Id} from './_generated/dataModel';
import type {ActionCtx} from './_generated/server';
import { action, internalAction, internalMutation, internalQuery, query, httpAction } from './_generated/server';
import { anyApi } from 'convex/server';
import { v } from 'convex/values';
import { getCurrentUser } from './auth';
import {requireAdmin} from './access';
import {entitlement} from './lib/entitlements';
import {accountEvent} from './lib/accountEvents';
import {bankTransferValidator} from './lib/paymentValidators';
import {checkoutUrl,validateKoraCharge,signHmac,equalSignature} from './lib/paymentSecurity';
import { nextMonthlyExpiry, validatePayment } from './lib/billing';
import { bankTransferDetails, flutterwaveCompleted, validateV4Charge, type CheckoutResult } from './lib/flutterwave';
const provider = v.union(v.literal('flutterwave'),v.literal('korapay'));
const KORA_ORIGIN='https://api.korapay.com/merchant/api/v1';
const ready=(name:'flutterwave'|'korapay')=>name==='korapay'?process.env.KORAPAY_ENABLED==='true'&&!!process.env.KORAPAY_SECRET_KEY:process.env.FLW_ENABLED==='true'&&!!process.env.FLW_SECRET_KEY&&!!process.env.FLW_SECRET_HASH&&(process.env.FLW_API_VERSION!=='v4'||!!process.env.FLW_CLIENT_ID);
const PRICE = 10000;
const refs = anyApi;
const secret = (name: string) => { const value = process.env[name]; if (!value) throw new Error(`${name} is not configured.`); return value; };
async function request(url: string, token: string, body?: unknown, idempotencyKey?: string) {
  const response = await fetch(url, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'PuntersEdge/1.0', 'X-Trace-Id': crypto.randomUUID(), ...(idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000) });
  const result = await response.json().catch(()=>{throw new Error('Payment provider returned an invalid response. Please try again later.');});
  if (!response.ok || ['error', 'failed'].includes(result.status) || result.status === false) throw new Error('Payment provider request failed. Please try again.');
  return result;
}
const V4_ORIGIN = 'https://f4bexperience.flutterwave.com';
const OAUTH_URL = 'https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token';
let tokenCache: { token: string; expiresAt: number } | null = null;
async function oauth() {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60000) return tokenCache.token;
  const response = await fetch(OAUTH_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'PuntersEdge/1.0' }, body: new URLSearchParams({ client_id: secret('FLW_CLIENT_ID'), client_secret: secret('FLW_SECRET_KEY'), grant_type: 'client_credentials' }).toString(), signal: AbortSignal.timeout(20000) });
  const data = await response.json();
  if (!response.ok || typeof data.access_token !== 'string' || !(Number(data.expires_in) > 60)) throw new Error('Flutterwave authentication is unavailable.');
  tokenCache = { token: data.access_token, expiresAt: Date.now() + Number(data.expires_in) * 1000 };
  return tokenCache.token;
}
/** Fixed, internal, read-only probe. Never returns credentials, tokens or provider bodies. */
export const probeFlutterwaveV4 = internalAction({ args: {}, handler: async () => {
  if (!process.env.FLW_CLIENT_ID || !process.env.FLW_SECRET_KEY) return { configured: false, authenticated: false, banksAvailable: false, oauthStatus: null, banksStatus: null };
  try {
    const response = await fetch(OAUTH_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'PuntersEdge/1.0' }, body: new URLSearchParams({ client_id: secret('FLW_CLIENT_ID'), client_secret: secret('FLW_SECRET_KEY'), grant_type: 'client_credentials' }).toString(), signal: AbortSignal.timeout(20000) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || typeof data.access_token !== 'string') return { configured: true, authenticated: false, banksAvailable: false, oauthStatus: response.status, banksStatus: null };
    try {
      const banks = await fetch(`${V4_ORIGIN}/banks?country=NG`, { headers: { Authorization: `Bearer ${data.access_token}`, 'User-Agent': 'PuntersEdge/1.0', 'X-Trace-Id': crypto.randomUUID() }, signal: AbortSignal.timeout(20000) });
      const body = await banks.json().catch(() => ({}));
      const charges=await fetch(`${V4_ORIGIN}/charges?reference=pe_read_only_probe`,{headers:{Authorization:`Bearer ${data.access_token}`,'User-Agent':'PuntersEdge/1.0'},signal:AbortSignal.timeout(20000)});
      const chargeBody=await charges.json().catch(()=>({}));
      return {chargeLookupAvailable:charges.ok&&Array.isArray(chargeBody.data),chargeLookupStatus:charges.status, configured: true, authenticated: true, banksAvailable: banks.ok && body.status === 'success', oauthStatus: response.status, banksStatus: banks.status };
    } catch { return { configured: true, authenticated: true, banksAvailable: false, oauthStatus: response.status, banksStatus: null, networkError: true }; }
  } catch { return { configured: true, authenticated: false, banksAvailable: false, oauthStatus: null, banksStatus: null, networkError: true }; }
}});
export const mine = query({args:{},handler:async ctx=>{
 const userId=(await getCurrentUser(ctx))?._id;if(!userId)return null;
 const subscription=await ctx.db.query('subscriptions').withIndex('by_user',q=>q.eq('userId',userId)).unique();
 const access=await entitlement(ctx,userId);
 const recent=await ctx.db.query('payments').withIndex('by_user',q=>q.eq('userId',userId)).order('desc').take(10);
 const pending=recent.find(p=>p.status==='pending'&&p.createdAt>Date.now()-3600000);
 return {active:access.active,paidActive:!!subscription&&subscription.expiresAt>Date.now(),accountStatus:access.status,expiresAt:access.expiresAt,price:PRICE,currency:'NGN',gateways:{flutterwave:ready('flutterwave'),korapay:ready('korapay')},pendingReference:pending?.reference??null,pendingProvider:pending?.provider??null,pendingCheckoutUrl:pending?.checkoutUrl??null,pendingInstructions:pending?.bankTransfer??null,recent:recent.map(p=>({reference:p.reference,provider:p.provider,status:p.status,amount:p.amount,currency:p.currency,createdAt:p.createdAt,paidAt:p.paidAt??null}))};
}});
export const user=internalQuery({args:{userId:v.id('users')},handler:async(ctx,{userId})=>{
 const account=await ctx.db.get(userId);if(!account)throw new Error('Account not found.');
 const access=await entitlement(ctx,userId);if(access.status!=='active')throw new Error('This account is '+access.status+'. Contact support.');
 return account;
}});
export const create=internalMutation({args:{userId:v.id('users'),provider,reference:v.string(),diagnostic:v.optional(v.boolean()),apiVersion:v.optional(v.union(v.literal('v3'),v.literal('v4')))},handler:async(ctx,args)=>{
 const account=await ctx.db.get(args.userId);if(!account)throw new Error('Account not found.');
 const access=await entitlement(ctx,args.userId);if(access.status!=='active')throw new Error('This account is '+access.status+'. Contact support.');
 const recent=await ctx.db.query('payments').withIndex('by_user',q=>q.eq('userId',args.userId)).order('desc').take(10);
 if(recent.filter(p=>p.createdAt>Date.now()-60000).length>=3)throw new Error('Please wait before creating another checkout.');
 const id=await ctx.db.insert('payments',{...args,customerEmail:account.email,amount:PRICE,currency:'NGN',status:'pending',createdAt:Date.now()});
 await accountEvent(ctx,args.userId,'checkout_started',{reference:args.reference,provider:args.provider});return id;
}});
export const prepared=internalMutation({args:{reference:v.string(),url:v.optional(v.string()),bankTransfer:v.optional(bankTransferValidator),failed:v.optional(v.boolean())},handler:async(ctx,args)=>{
 const payment=await ctx.db.query('payments').withIndex('by_reference',q=>q.eq('reference',args.reference)).unique();
 if(!payment||payment.status==='paid')return;
 await ctx.db.patch(payment._id,args.failed?{status:'initialization_failed',failureCode:'provider_initialization_failed'}:{checkoutUrl:args.url,bankTransfer:args.bankTransfer,checkoutExpiresAt:Date.now()+3600000});
 await accountEvent(ctx,payment.userId,args.failed?'checkout_initialization_failed':'checkout_ready',{reference:payment.reference,provider:payment.provider});
 if(!args.failed)await ctx.scheduler.runAfter(120000,refs.payments.reconcile,{reference:payment.reference,attempt:0});
}});
async function startCheckout(ctx:ActionCtx,userId:Id<'users'>,selectedProvider:'flutterwave'|'korapay',diagnostic=false):Promise<CheckoutResult>{
 const account=await ctx.runQuery(refs.payments.user,{userId});
 if(!ready(selectedProvider))throw new Error('This payment gateway is temporarily unavailable. Please choose another available gateway.');
 if(!account?.email)throw new Error('Your account needs an email address.');
 const origin=new URL(secret('SITE_URL').split(',')[0]);if(origin.protocol!=='https:')throw new Error('Secure checkout is not configured.');
 const reference=`pe_${crypto.randomUUID()}`,apiVersion=selectedProvider==='flutterwave'&&process.env.FLW_API_VERSION==='v4'?'v4':'v3';
 await ctx.runMutation(refs.payments.create,{userId,provider:selectedProvider,reference,diagnostic,...(selectedProvider==='flutterwave'?{apiVersion}:{})});
 try {
  if(selectedProvider==='korapay'){
   const notificationOrigin=secret('CONVEX_HTTP_ACTIONS_URL');if(new URL(notificationOrigin).protocol!=='https:')throw new Error('Secure payment notification is not configured.');
   const result=await request(`${KORA_ORIGIN}/charges/initialize`,secret('KORAPAY_SECRET_KEY'),{reference,amount:PRICE,currency:'NGN',customer:{email:account.email,name:account.name??'PuntersEdge member'},redirect_url:`${origin.origin}/subscribe?reference=${reference}`,notification_url:`${notificationOrigin.replace(/\/$/,'')}/payments/korapay`,narration:'PuntersEdge monthly membership',merchant_bears_cost:true});
   if(result.data?.reference!==reference)throw new Error('Payment checkout reference mismatch.');
   const url=checkoutUrl(result.data?.checkout_url,'korapay');await ctx.runMutation(refs.payments.prepared,{reference,url});return {kind:'redirect',url};
  }
  if(apiVersion==='v4'){
   const token=await oauth(),names=String(account.name??'PuntersEdge Member').trim().split(/\s+/);
   const customer=await request(`${V4_ORIGIN}/customers`,token,{email:account.email,name:{first:names[0]||'PuntersEdge',last:names.slice(1).join(' ')||'Member'}},`${reference}_customer`);
   if(typeof customer.data?.id!=='string'||!customer.data.id.startsWith('cus_'))throw new Error('Could not prepare your bank transfer.');
   await ctx.runMutation(refs.payments.attachV4,{reference,providerCustomerId:customer.data.id});
   const virtual=await request(`${V4_ORIGIN}/virtual-accounts`,token,{reference,customer_id:customer.data.id,amount:PRICE,currency:'NGN',account_type:'dynamic',expiry:3600,narration:'PuntersEdge monthly membership'},`${reference}_account`);
   const details=bankTransferDetails(virtual.data??{},reference,customer.data.id,PRICE);
   if(typeof virtual.data?.id!=='string')throw new Error('Could not prepare your bank transfer.');
   await ctx.runMutation(refs.payments.attachV4,{reference,providerCustomerId:customer.data.id,virtualAccountId:virtual.data.id});
   await ctx.runMutation(refs.payments.prepared,{reference,bankTransfer:details});return details;
  }
  const result=await request('https://api.flutterwave.com/v3/payments',secret('FLW_SECRET_KEY'),{tx_ref:reference,amount:PRICE,currency:'NGN',redirect_url:`${origin.origin}/subscribe?reference=${reference}`,customer:{email:account.email,name:account.name??'PuntersEdge member'},customizations:{title:'PuntersEdge monthly all-access'}});
  const url=checkoutUrl(result.data?.link,'flutterwave');await ctx.runMutation(refs.payments.prepared,{reference,url});return {kind:'redirect',url};
 }catch(error){await ctx.runMutation(refs.payments.prepared,{reference,failed:true});throw error;}
}
export const checkout=action({args:{provider},handler:async(ctx,args):Promise<CheckoutResult>=>{
 const userId=(await getCurrentUser(ctx))?._id;if(!userId)throw new Error('Sign in before subscribing.');
 return startCheckout(ctx,userId,args.provider);
}});
/** Deploy-key-only acceptance probe: creates an unpaid checkout for the configured owner.
 * It never charges a card, transfers money, or grants access. No customer details are returned. */
export const probeCheckout=internalAction({args:{provider},handler:async(ctx,args)=>{
 const owner=process.env.SUPER_ADMIN_USER_ID;if(!owner)throw new Error('Configured owner required.');
 const result=await startCheckout(ctx,owner as Id<'users'>,args.provider,true);
 return {provider:args.provider,initialized:true,kind:result.kind,host:result.kind==='redirect'?new URL(result.url).hostname:null,amount:PRICE,currency:'NGN',moneyMoved:false};
}});
export const attachV4 = internalMutation({ args: { reference: v.string(), providerCustomerId: v.string(), virtualAccountId: v.optional(v.string()) }, handler: async (ctx, args) => {
  const payment = await ctx.db.query('payments').withIndex('by_reference', q => q.eq('reference', args.reference)).unique();
  if (!payment || payment.provider !== 'flutterwave' || payment.apiVersion !== 'v4' || payment.status !== 'pending') throw new Error('Unknown bank transfer checkout.');
  if (payment.providerCustomerId && payment.providerCustomerId !== args.providerCustomerId) throw new Error('Checkout customer mismatch.');
  await ctx.db.patch(payment._id, { providerCustomerId: args.providerCustomerId, ...(args.virtualAccountId ? { virtualAccountId: args.virtualAccountId } : {}) });
}});
export const settle = internalMutation({ args: { provider, reference: v.string(), transactionId: v.string(), amount: v.number(), currency: v.string() }, handler: async (ctx, args) => {
  const payment = await ctx.db.query('payments').withIndex('by_reference', q => q.eq('reference', args.reference)).unique();
  if (!payment) throw new Error('Unknown payment reference.');
  validatePayment(payment, args);
  if (payment.status === 'paid') return;
  const claimed=await ctx.db.query('payments').withIndex('by_provider_transaction',q=>q.eq('provider',args.provider).eq('providerTransactionId',args.transactionId)).first();
  if(claimed&&claimed._id!==payment._id)throw new Error('Transaction already belongs to another payment.');
  const subscription = await ctx.db.query('subscriptions').withIndex('by_user', q => q.eq('userId', payment.userId)).unique();
  const values = { userId: payment.userId, expiresAt: nextMonthlyExpiry(Date.now(), subscription?.expiresAt), updatedAt: Date.now() };
  if (subscription) await ctx.db.patch(subscription._id, values); else await ctx.db.insert('subscriptions', values);
  await ctx.scheduler.runAt(values.expiresAt, refs.payments.expire, { userId: payment.userId, expiresAt: values.expiresAt });
  await ctx.db.patch(payment._id, { status: 'paid', paidAt: Date.now(), providerTransactionId: args.transactionId,failureCode:undefined });
  await accountEvent(ctx,payment.userId,'payment_verified',{reference:payment.reference,provider:payment.provider});
  await ctx.scheduler.runAfter(0,refs.notifications.deliver,{count:1,event:'activities',activity:'membershipActivated',targetUserId:payment.userId,batchId:`membership:${payment._id}`});
}});
export const pending = internalQuery({args:{reference:v.string()},handler:async(ctx,args)=>ctx.db.query('payments').withIndex('by_reference',q=>q.eq('reference',args.reference)).unique()});
export const markFailed=internalMutation({args:{reference:v.string()},handler:async(ctx,{reference})=>{
 const payment=await ctx.db.query('payments').withIndex('by_reference',q=>q.eq('reference',reference)).unique();
 if(!payment||payment.status!=='pending')return;
 await ctx.db.patch(payment._id,{status:'failed',failureCode:'provider_declined'});
 await accountEvent(ctx,payment.userId,'payment_declined',{reference,provider:payment.provider});
}});
export const verify = internalAction({ args: { provider, reference: v.string(), transactionId: v.string() }, handler: async (ctx, args) => {
  const pending = await ctx.runQuery(refs.payments.pending, {reference:args.reference});
  if (!pending || pending.provider !== args.provider) throw new Error('Unknown payment reference.');
  if (pending.status === 'paid') return;
  if (args.provider === 'flutterwave' && pending.apiVersion === 'v4') {
    const result = await request(`${V4_ORIGIN}/charges/${encodeURIComponent(args.transactionId)}`, await oauth());
    validateV4Charge(result.data ?? {}, pending, args.transactionId);
    await ctx.runMutation(refs.payments.settle, { provider: args.provider, reference: args.reference, transactionId: args.transactionId, amount: Number(result.data.amount), currency: result.data.currency });
    return;
  }
  if(args.provider==='korapay'){
   const result=await request(`${KORA_ORIGIN}/charges/${encodeURIComponent(args.reference)}`,secret('KORAPAY_SECRET_KEY'));
   validateKoraCharge(result.data??{},pending);
   await ctx.runMutation(refs.payments.settle,{provider:'korapay',reference:args.reference,transactionId:args.reference,amount:Number(result.data.amount),currency:result.data.currency});return;
  }
  const result = await request(`https://api.flutterwave.com/v3/transactions/${encodeURIComponent(args.transactionId)}/verify`, secret('FLW_SECRET_KEY'));
  const d = result.data;
  if (!d || String(d.id)!==args.transactionId || !['successful', 'success'].includes(d.status)) throw new Error('Payment is not successful.');
  const reference = d.tx_ref;
  if (reference !== args.reference) throw new Error('Payment reference mismatch.');
  await ctx.runMutation(refs.payments.settle, { provider: args.provider, reference, transactionId: String(d.id ?? d.reference), amount: Number(d.amount), currency: d.currency });
}});
export const flutterwaveWebhook = httpAction(async (ctx, req) => {
  try {
    if(Number(req.headers.get('content-length')??0)>32768)return new Response('Payload too large',{status:413});
    const raw = await req.text();if(raw.length>32768)return new Response('Payload too large',{status:413}); const signed = req.headers.get('flutterwave-signature');
    const hash = secret('FLW_SECRET_HASH');
    if (signed) { const signature = await signHmac(raw,hash,'base64'); if (!equalSignature(signature, signed)) return new Response('Unauthorized', { status: 401 }); }
    else if (process.env.FLW_API_VERSION === 'v4' || !equalSignature(req.headers.get('verif-hash') ?? '', hash)) return new Response('Unauthorized', { status: 401 });
    const completed = flutterwaveCompleted(JSON.parse(raw));
    if (completed) {
      if (completed.apiVersion === 'v4' && !signed) return new Response('Unauthorized', { status: 401 });
      const payment = await ctx.runQuery(refs.payments.pending, { reference: completed.reference });
      if (!payment || (payment.apiVersion ?? 'v3') !== completed.apiVersion) return new Response('Payment version mismatch', { status: 400 });
      await ctx.runAction(refs.payments.verify, { provider: 'flutterwave', reference: completed.reference, transactionId: completed.transactionId });
    }
    return new Response('OK');
  } catch { return new Response('Webhook verification pending', { status: 503 }); }
});
/** Scheduled changes invalidate realtime entitlement queries at expiry. */
export const expire = internalMutation({ args: { userId: v.id('users'), expiresAt: v.number() }, handler: async (ctx, args) => {
 const subscription = await ctx.db.query('subscriptions').withIndex('by_user', q => q.eq('userId', args.userId)).unique();
 if (subscription?.expiresAt === args.expiresAt && subscription.expiresAt <= Date.now()) { await ctx.db.patch(subscription._id, { updatedAt: Date.now() }); await ctx.scheduler.runAfter(0,refs.notifications.deliver,{count:1,event:'activities',activity:'membershipExpired',targetUserId:args.userId,batchId:`expired:${args.userId}:${args.expiresAt}`}); }
}});

export const beginStatusCheck=internalMutation({args:{userId:v.id('users'),reference:v.string()},handler:async(ctx,args)=>{
 const payment=await ctx.db.query('payments').withIndex('by_reference',q=>q.eq('reference',args.reference)).unique();
 if(!payment||payment.userId!==args.userId)throw new Error('Payment not found.');
 if(payment.status==='paid')return {...payment,alreadyPaid:true};
 if(payment.lastCheckAt&&payment.lastCheckAt>Date.now()-30000)throw new Error('Please wait 30 seconds before checking again.');
 await ctx.db.patch(payment._id,{lastCheckAt:Date.now()});return {...payment,alreadyPaid:false};
}});
/** Provider lookups are always server-side; URL return parameters never grant access. */
async function verifyPending(ctx:ActionCtx,payment:any):Promise<boolean>{
 if(payment.provider==='korapay'){
  const result=await request(`${KORA_ORIGIN}/charges/${encodeURIComponent(payment.reference)}`,secret('KORAPAY_SECRET_KEY'));
  if(result.data?.reference===payment.reference&&result.data?.status==='failed'){await ctx.runMutation(refs.payments.markFailed,{reference:payment.reference});return false;}
  if(result.data?.status!=='success')return false;
  validateKoraCharge(result.data??{},payment);
  await ctx.runMutation(refs.payments.settle,{provider:'korapay',reference:payment.reference,transactionId:payment.reference,amount:Number(result.data.amount),currency:result.data.currency});return true;
 }
 const version=payment.apiVersion??'v3';
 const response=version==='v4'?await request(`${V4_ORIGIN}/charges?reference=${encodeURIComponent(payment.reference)}`,await oauth()):await request(`https://api.flutterwave.com/v3/transactions?tx_ref=${encodeURIComponent(payment.reference)}`,secret('FLW_SECRET_KEY'));
 if(!Array.isArray(response.data))throw new Error('Payment lookup is unavailable. Provider confirmation remains pending.');
 const charge=response.data.find((d:Record<string,unknown>)=>(version==='v4'?d.reference:d.tx_ref)===payment.reference&&(version==='v4'?d.status==='succeeded':d.status==='successful'));
 if(!charge){if(response.data.some((d:Record<string,unknown>)=>(version==='v4'?d.reference:d.tx_ref)===payment.reference&&['failed','cancelled'].includes(String(d.status))))await ctx.runMutation(refs.payments.markFailed,{reference:payment.reference});return false;}
 await ctx.runAction(refs.payments.verify,{provider:payment.provider,reference:payment.reference,transactionId:String(charge.id)});return true;
}
export const checkStatus=action({args:{reference:v.string()},handler:async(ctx,args):Promise<{paid:boolean}>=>{
 const userId=(await getCurrentUser(ctx))?._id;if(!userId)throw new Error('Sign in to check payment.');
 await ctx.runQuery(refs.payments.user,{userId});
 const payment=await ctx.runMutation(refs.payments.beginStatusCheck,{userId,reference:args.reference});
 if(payment.alreadyPaid)return {paid:true};return {paid:await verifyPending(ctx,payment)};
}});
/** Three bounded retries recover missing webhooks without polling every visitor. */
export const reconcile=internalAction({args:{reference:v.string(),attempt:v.number()},handler:async(ctx,{reference,attempt})=>{
 if(!Number.isInteger(attempt)||attempt<0||attempt>2)return;
 const payment=await ctx.runQuery(refs.payments.pending,{reference});if(!payment||payment.status!=='pending')return;
 try{if(await verifyPending(ctx,payment))return;}catch{/* Leave pending; do not treat network failure as a declined payment. */}
 if(attempt<2)await ctx.scheduler.runAfter(attempt===0?480000:1200000,refs.payments.reconcile,{reference,attempt:attempt+1});
}});
export const korapayWebhook=httpAction(async(ctx,req)=>{
 if(Number(req.headers.get('content-length')??0)>32768)return new Response('Payload too large',{status:413});
 const raw=await req.text();if(raw.length>32768)return new Response('Payload too large',{status:413});
 let event;try{event=JSON.parse(raw);}catch{return new Response('Invalid JSON',{status:400});}
 if(!event?.data||typeof event.data!=='object'||Array.isArray(event.data))return new Response('Invalid payload',{status:400});
 if(!process.env.KORAPAY_SECRET_KEY)return new Response('Gateway unavailable',{status:503});
 const signature=await signHmac(JSON.stringify(event.data),secret('KORAPAY_SECRET_KEY'),'hex');
 if(!equalSignature(signature,req.headers.get('x-korapay-signature')??''))return new Response('Unauthorized',{status:401});
 if(event.event!=='charge.success')return new Response('OK');
 const reference=event.data.reference;if(typeof reference!=='string'||!reference.startsWith('pe_')||reference.length>100)return new Response('Invalid reference',{status:400});
 try{const payment=await ctx.runQuery(refs.payments.pending,{reference});if(payment?.provider==='korapay')await ctx.runAction(refs.payments.verify,{provider:'korapay',reference,transactionId:reference});return new Response('OK');}
 catch{return new Response('Verification pending',{status:503});}
});

export const configuration=query({args:{},handler:async ctx=>{
 await requireAdmin(ctx);const origin=process.env.CONVEX_HTTP_ACTIONS_URL??process.env.CONVEX_SITE_URL??'';
 return {flutterwave:{ready:ready('flutterwave'),webhook:origin+'/payments/flutterwave',detail:`Flutterwave ${process.env.FLW_API_VERSION??'v3'} · server verification required`},korapay:{ready:ready('korapay'),webhook:origin+'/payments/korapay',detail:process.env.KORAPAY_SECRET_KEY?'Credentials configured; live settlement acceptance still required.':'Live Korapay secret key has not been configured.'}};
}});
