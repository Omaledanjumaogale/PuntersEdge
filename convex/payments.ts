import { action, internalAction, internalMutation, internalQuery, query, httpAction } from './_generated/server';
import { anyApi } from 'convex/server';
import { v } from 'convex/values';
import { getCurrentUser } from './auth';
import { isSuperAdmin } from './access';
import { nextMonthlyExpiry, validatePayment } from './lib/billing';
import { bankTransferDetails, flutterwaveCompleted, validateV4Charge, type CheckoutResult } from './lib/flutterwave';
const provider = v.literal('flutterwave');
const PRICE = 10000;
const refs = anyApi;
const secret = (name: string) => { const value = process.env[name]; if (!value) throw new Error(`${name} is not configured.`); return value; };
async function request(url: string, token: string, body?: unknown, idempotencyKey?: string) {
  const response = await fetch(url, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'PuntersEdge/1.0', 'X-Trace-Id': crypto.randomUUID(), ...(idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000) });
  const result = await response.json();
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
export const mine = query({ args: {}, handler: async ctx => {
  const userId = (await getCurrentUser(ctx))?._id; if (!userId) return null;
  const subscription = await ctx.db.query('subscriptions').withIndex('by_user', q => q.eq('userId', userId)).unique();
  const recent=await ctx.db.query('payments').withIndex('by_user',q=>q.eq('userId',userId)).order('desc').take(10);
  const pending=recent.find(p=>p.status==='pending'&&p.createdAt>Date.now()-3600000);
  return { pendingReference:pending?.reference??null, active: await isSuperAdmin(ctx) || !!subscription && subscription.expiresAt > Date.now(), expiresAt: subscription?.expiresAt ?? null, price: PRICE, currency: 'NGN', gateways: {flutterwave: process.env.FLW_ENABLED === 'true'} };
}});
export const user = internalQuery({ args: { userId: v.id('users') }, handler: (ctx, args) => ctx.db.get(args.userId) });
export const create = internalMutation({ args: { userId: v.id('users'), provider, reference: v.string(), apiVersion: v.optional(v.union(v.literal('v3'), v.literal('v4'))) }, handler: async (ctx, args) => {
  const recent = await ctx.db.query('payments').withIndex('by_user', q => q.eq('userId', args.userId)).order('desc').take(10);
  if (recent.filter(p => p.createdAt > Date.now() - 60000).length >= 3) throw new Error('Please wait before creating another checkout.');
  return ctx.db.insert('payments', { ...args, amount: PRICE, currency: 'NGN', status: 'pending', createdAt: Date.now() });
}});
export const checkout = action({ args: { provider }, handler: async (ctx, args): Promise<CheckoutResult> => {
  const userId = (await getCurrentUser(ctx))?._id; if (!userId) throw new Error('Sign in before subscribing.');
  if (process.env.FLW_ENABLED !== 'true') throw new Error('This payment gateway is temporarily unavailable. Please try again later.');
  const account = await ctx.runQuery(refs.payments.user, { userId });
  if (!account?.email) throw new Error('Your account needs an email address.');
  const origin = secret('SITE_URL').replace(/\/$/, '');
  const reference = `pe_${crypto.randomUUID()}`;
  const apiVersion = args.provider === 'flutterwave' && process.env.FLW_API_VERSION === 'v4' ? 'v4' : 'v3';
  await ctx.runMutation(refs.payments.create, { userId, provider: args.provider, reference, apiVersion });
  if (args.provider === 'flutterwave' && apiVersion === 'v4') {
    const token = await oauth();
    const names = String(account.name ?? 'PuntersEdge Member').trim().split(/\s+/);
    const customer = await request(`${V4_ORIGIN}/customers`, token, { email: account.email, name: { first: names[0] || 'PuntersEdge', last: names.slice(1).join(' ') || 'Member' } }, `${reference}_customer`);
    if (typeof customer.data?.id !== 'string' || !customer.data.id.startsWith('cus_')) throw new Error('Could not prepare your bank transfer.');
    await ctx.runMutation(refs.payments.attachV4, { reference, providerCustomerId: customer.data.id });
    const virtual = await request(`${V4_ORIGIN}/virtual-accounts`, token, { reference, customer_id: customer.data.id, amount: PRICE, currency: 'NGN', account_type: 'dynamic', expiry: 3600, narration: 'PuntersEdge monthly membership' }, `${reference}_account`);
    const details = bankTransferDetails(virtual.data ?? {}, reference, customer.data.id, PRICE);
    if (typeof virtual.data?.id !== 'string') throw new Error('Could not prepare your bank transfer.');
    await ctx.runMutation(refs.payments.attachV4, { reference, providerCustomerId: customer.data.id, virtualAccountId: virtual.data.id });
    return details;
  }
  const result = await request('https://api.flutterwave.com/v3/payments', secret('FLW_SECRET_KEY'), { tx_ref: reference, amount: PRICE, currency: 'NGN', redirect_url: `${origin}/subscribe`, customer: { email: account.email, name: account.name ?? 'PuntersEdge member' }, customizations: { title: 'PuntersEdge monthly all-access' } });
  const url = result.data?.link;
  if (typeof url !== 'string' || !url.startsWith('https://')) throw new Error('Payment provider did not return a secure checkout.');
  return { kind: 'redirect', url };
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
  const subscription = await ctx.db.query('subscriptions').withIndex('by_user', q => q.eq('userId', payment.userId)).unique();
  const values = { userId: payment.userId, expiresAt: nextMonthlyExpiry(Date.now(), subscription?.expiresAt), updatedAt: Date.now() };
  if (subscription) await ctx.db.patch(subscription._id, values); else await ctx.db.insert('subscriptions', values);
  await ctx.scheduler.runAt(values.expiresAt, refs.payments.expire, { userId: payment.userId, expiresAt: values.expiresAt });
  await ctx.db.patch(payment._id, { status: 'paid', paidAt: Date.now(), providerTransactionId: args.transactionId });
  await ctx.scheduler.runAfter(0,refs.notifications.deliver,{count:1,event:'activities',activity:'membershipActivated',targetUserId:payment.userId,batchId:`membership:${payment._id}`});
}});
export const pending = internalQuery({args:{reference:v.string()},handler:async(ctx,args)=>ctx.db.query('payments').withIndex('by_reference',q=>q.eq('reference',args.reference)).unique()});
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
  const result = await request(`https://api.flutterwave.com/v3/transactions/${encodeURIComponent(args.transactionId)}/verify`, secret('FLW_SECRET_KEY'));
  const d = result.data;
  if (!d || !['successful', 'success'].includes(d.status)) throw new Error('Payment is not successful.');
  const reference = d.tx_ref;
  if (reference !== args.reference) throw new Error('Payment reference mismatch.');
  await ctx.runMutation(refs.payments.settle, { provider: args.provider, reference, transactionId: String(d.id ?? d.reference), amount: Number(d.amount), currency: d.currency });
}});
async function hmac(message: string, key: string) {
  const enc = new TextEncoder(); const cryptoKey = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message)));
}
function equal(a: string, b: string) { if (a.length !== b.length) return false; let mismatch = 0; for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i); return mismatch === 0; }
export const flutterwaveWebhook = httpAction(async (ctx, req) => {
  try {
    const raw = await req.text(); const signed = req.headers.get('flutterwave-signature');
    const hash = secret('FLW_SECRET_HASH');
    if (signed) { const signature = btoa(String.fromCharCode(...await hmac(raw, hash))); if (!equal(signature, signed)) return new Response('Unauthorized', { status: 401 }); }
    else if (process.env.FLW_API_VERSION === 'v4' || !equal(req.headers.get('verif-hash') ?? '', hash)) return new Response('Unauthorized', { status: 401 });
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
 if(!payment||payment.userId!==args.userId||payment.provider!=='flutterwave')throw new Error('Payment not found.');
 if(payment.status==='paid')return {...payment,alreadyPaid:true};
 if(payment.lastCheckAt&&payment.lastCheckAt>Date.now()-30000)throw new Error('Please wait 30 seconds before checking again.');
 await ctx.db.patch(payment._id,{lastCheckAt:Date.now()});return {...payment,alreadyPaid:false};
}});
/** Owner-initiated fallback reconciliation; exact verified charges only, no browser-supplied success. */
export const checkStatus=action({args:{reference:v.string()},handler:async(ctx,args):Promise<{paid:boolean}>=>{
 const userId=(await getCurrentUser(ctx))?._id;if(!userId)throw new Error('Sign in to check payment.');
 const payment=await ctx.runMutation(refs.payments.beginStatusCheck,{userId,reference:args.reference});
 if(payment.alreadyPaid)return {paid:true};
 const version=payment.apiVersion??'v3';
 const response=version==='v4'?await request(`${V4_ORIGIN}/charges?reference=${encodeURIComponent(args.reference)}`,await oauth()):await request(`https://api.flutterwave.com/v3/transactions?tx_ref=${encodeURIComponent(args.reference)}`,secret('FLW_SECRET_KEY'));
 if(!Array.isArray(response.data))throw new Error('Payment lookup is unavailable. Provider confirmation remains pending.');
 const charge=response.data.find((d:Record<string,unknown>)=>(version==='v4'?d.reference:d.tx_ref)===payment.reference&&(version==='v4'?d.status==='succeeded':d.status==='successful'));
 if(!charge)return {paid:false};
 await ctx.runAction(refs.payments.verify,{provider:'flutterwave',reference:payment.reference,transactionId:String(charge.id)});
 return {paid:true};
}});
