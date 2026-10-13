import { createClient, type GenericCtx } from '@convex-dev/better-auth';
import type { ComponentApi } from '@convex-dev/better-auth/_generated/component.js';
import { convex } from '@convex-dev/better-auth/plugins';
import { betterAuth } from 'better-auth/minimal';
import { componentsGeneric } from 'convex/server';
import { internal } from './_generated/api';
import type { DataModel, Doc } from './_generated/dataModel';
import type { QueryCtx, MutationCtx, ActionCtx } from './_generated/server';
import authConfig from './auth.config';

export const authComponent = createClient<DataModel>(componentsGeneric().betterAuth as unknown as ComponentApi);

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

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  if (!process.env.BETTER_AUTH_SECRET || process.env.BETTER_AUTH_SECRET.length < 32) throw new Error('Configure BETTER_AUTH_SECRET with at least 32 random characters.');
  return betterAuth({
  appName: 'PuntersEdge',
  // Email links return through the Pages proxy so cookies belong to the app.
  baseURL: (process.env.SITE_URL ?? 'http://localhost:5173').split(',')[0].trim(),
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: (process.env.SITE_URL ?? 'http://localhost:5173').split(',').map((url) => url.trim()),
  database: authComponent.adapter(ctx),
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
  plugins: [convex({ authConfig })],
  });
};

/** Local application profiles are keyed to immutable Better Auth subjects. */
export async function getCurrentUser(ctx: QueryCtx | MutationCtx | ActionCtx): Promise<Doc<'users'> | null> {
  const user = await authComponent.safeGetAuthUser(ctx);
  if (!user || !user.emailVerified) return null;
  if ('db' in ctx) return ctx.db.query('users').withIndex('by_auth_subject', (q) => q.eq('authSubject', user._id)).unique();
  return ctx.runQuery(internal.users.byAuthSubject, { subject: user._id });
}
