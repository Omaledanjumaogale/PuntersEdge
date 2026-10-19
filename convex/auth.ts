import { createClient, type GenericCtx } from '@convex-dev/better-auth';
import type { ComponentApi } from '@convex-dev/better-auth/_generated/component.js';
import { convex } from '@convex-dev/better-auth/plugins';
import { betterAuth,type BetterAuthOptions } from 'better-auth/minimal';
import authSchema from './betterAuth/schema';
import {twoFactor} from 'better-auth/plugins';
import { componentsGeneric, anyApi } from 'convex/server';
import {syncAuthAccount,accountEvent} from './lib/accountEvents';
import { internal } from './_generated/api';
import type { DataModel, Doc } from './_generated/dataModel';
import type { QueryCtx, MutationCtx, ActionCtx } from './_generated/server';
import authConfig from './auth.config';

export const authComponent = createClient<DataModel,typeof authSchema>(componentsGeneric().betterAuth as unknown as ComponentApi,{
 local:{schema:authSchema},
 authFunctions:{onCreate:anyApi.auth.onCreate,onUpdate:anyApi.auth.onUpdate},
 triggers:{user:{onCreate:async(ctx,doc)=>{await syncAuthAccount(ctx,doc,true);},onUpdate:async(ctx,doc,old)=>{await syncAuthAccount(ctx,doc);if(doc.twoFactorEnabled&&!old.twoFactorEnabled){const local=await ctx.db.query('users').withIndex('by_auth_subject',q=>q.eq('authSubject',doc._id)).unique();if(local)await ctx.db.patch(local._id,{mfaSinceAt:Date.now()});await ctx.runMutation(componentsGeneric().betterAuth.adapter.deleteMany,{input:{model:'session',where:[{field:'userId',value:doc._id}]},paginationOpts:{numItems:100,cursor:null}});}}},
 session:{onCreate:async(ctx,doc)=>{const user=await ctx.db.query('users').withIndex('by_auth_subject',q=>q.eq('authSubject',doc.userId)).unique();if(user)await accountEvent(ctx,user._id,'session_created');}}}
});
export const {onCreate,onUpdate}=authComponent.triggersApi();

async function sendMail(email: string, subject: string, url: string) {
  const key = process.env.PUNTERSEDGE_RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!key || !from) throw new Error('Email delivery is not configured.');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'User-Agent': 'PuntersEdge/1.0' },
    body: JSON.stringify({ from, to: [email], subject, text: `${subject}\n\n${url}\n\nIf you did not request this, ignore this email.` }),
  });
  if (!response.ok) throw new Error(`Email delivery failed (${response.status}).`);
}

export const createAuthOptions = (ctx: GenericCtx<DataModel>) => {
  return {
  appName: 'PuntersEdge',
  // Email links return through the Pages proxy so cookies belong to the app.
  baseURL: (process.env.SITE_URL ?? 'http://localhost:5173').split(',')[0].trim(),
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: (process.env.SITE_URL ?? 'http://localhost:5173').split(',').map((url) => url.trim()),
  database: authComponent.adapter(ctx),
  session: {expiresIn:60*60*24*365,updateAge:60*60*24},
  // Persist protection for sensitive auth operations across server instances.
  // Ordinary session/token reads do not write a rate-limit counter.
  rateLimit:{enabled:true,storage:'database',window:60,max:30,customRules:{
    '/get-session':false,'/convex/token':false,
    '/sign-in/email':{window:60,max:5},'/sign-up/email':{window:60,max:5},
    '/two-factor/*':{window:60,max:5},'/request-password-reset':{window:60,max:3},'/send-verification-email':{window:60,max:3}
  }},
  advanced:{ipAddress:{ipAddressHeaders:['cf-connecting-ip']}},
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => sendMail(user.email, 'Reset your PuntersEdge password', url),
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => sendMail(user.email, 'Verify your PuntersEdge email', url),
  },
  plugins: [twoFactor({issuer:'PuntersEdge',accountLockout:{enabled:true,maxFailedAttempts:5,durationSeconds:900}}),convex({ authConfig })],
  } satisfies BetterAuthOptions;
};

export const createAuth=(ctx:GenericCtx<DataModel>)=>{if(!process.env.BETTER_AUTH_SECRET||process.env.BETTER_AUTH_SECRET.length<32)throw new Error('Configure BETTER_AUTH_SECRET with at least 32 random characters.');return betterAuth(createAuthOptions(ctx));};

/** Local application profiles are keyed to immutable Better Auth subjects. */
export async function getCurrentUser(ctx: QueryCtx | MutationCtx | ActionCtx): Promise<Doc<'users'> | null> {
  const user = await authComponent.safeGetAuthUser(ctx);
  if (!user || !user.emailVerified) return null;
  if ('db' in ctx){const local=await ctx.db.query('users').withIndex('by_auth_subject', (q) => q.eq('authSubject', user._id)).unique();return local?.erasingAt?null:local;}
  return ctx.runQuery(internal.users.byAuthSubject, { subject: user._id });
}
