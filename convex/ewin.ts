import { v } from 'convex/values';
import { action } from './_generated/server';
import { components } from './_generated/api';

/**
 * E-WIN Hub single sign-on.
 *
 * The Hub redirects a signed-in member back with a one-time, platform-bound
 * ticket. This action exchanges it server-to-server and mints a local Better
 * Auth session. Identity is never trusted from the browser; the Hub's signature
 * and single-use nonce are the only source of trust.
 *
 * The Better Auth adapter is a Convex component, so its functions are called
 * through `components.betterAuth` rather than a generated `internal.*`
 * namespace. That keeps this module independent of codegen state.
 */
const PLATFORM_ID = 'puntersedge';
const REDEEM_URL = process.env.EWIN_SSO_REDEEM_URL ?? 'https://affable-dragon-883.eu-west-1.convex.site/sso/redeem';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

type EwinIdentity = { subject: string; email: string; name: string; platformId: string };

export const redeem = action({
  args: { ticket: v.string() },
  handler: async (ctx, { ticket }): Promise<{ token: string; isNewUser: boolean }> => {
    if (!ticket || ticket.length > 4096) throw new Error('EWIN_SSO_INVALID_TICKET');
    const response = await fetch(REDEEM_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ version: 1, platformId: PLATFORM_ID, ticket }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error('EWIN_SSO_REJECTED');
    const body = (await response.json().catch(() => null)) as { ok?: boolean; identity?: EwinIdentity } | null;
    if (!body?.ok || !body.identity || body.identity.platformId !== PLATFORM_ID) throw new Error('EWIN_SSO_REJECTED');
    const email = body.identity.email.toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !body.identity.subject) throw new Error('EWIN_SSO_REJECTED');
    const name = (body.identity.name || email.split('@')[0]).slice(0, 120);

    // Find or create the local user by verified Hub email.
    const existing = (await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: 'user',
      where: [{ field: 'email', operator: 'eq', value: email }],
    })) as { _id: string } | null;

    const user =
      existing ??
      ((await ctx.runMutation(components.betterAuth.adapter.create, {
        input: {
          model: 'user',
          data: { name, email, emailVerified: true, createdAt: Date.now(), updatedAt: Date.now() },
        },
      })) as { _id: string });

    // Mint the session the membership reader forwards to Convex.
    const token = (crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')).slice(0, 48);
    const now = Date.now();
    await ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: 'session',
        data: { token, userId: user._id, expiresAt: now + SESSION_TTL_MS, createdAt: now, updatedAt: now },
      },
    });

    return { token, isNewUser: !existing };
  },
});
