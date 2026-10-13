# Authentication deployment

PuntersEdge uses the official Convex Better Auth component. The Pages `/api/auth/*` route proxies to Convex while keeping session cookies on the app origin. Better Auth validates the original browser `Origin` against trusted origins; the proxy preserves that header. Public endpoints never accept an arbitrary upstream URL. Tokens and API credentials are not embedded in frontend JavaScript. Sessions use HttpOnly cookies; Convex JWTs are fetched from the cookie session for authenticated realtime queries.

Set these Convex variables securely:

- `BETTER_AUTH_SECRET`: a random secret of at least 32 characters.
- `SITE_URL`: `https://puntersedge.ewinproject.org`; the first entry is the canonical origin used in email links. Additional exact trusted origins may be comma separated for development.
- `PUNTERSEDGE_RESEND_API_KEY`: the Resend credential.
- `RESEND_FROM_EMAIL`: a sender on a verified Resend domain, for example `PuntersEdge <puntersedge@ewinproject.org>` using the verified mother domain ewinproject.org.

Set `PUBLIC_CONVEX_URL` for the frontend build and Pages runtime. The proxy derives the corresponding `.convex.site` origin, or accepts `PUBLIC_CONVEX_SITE_URL` as an explicit public override. Deploy the Convex component configuration before deploying Pages. Email verification is required before password sign-in. Reset-password links return to `/reset-password`.

## Super administrator

1. Register the intended administrator through `/signup` using the owner's email and a strong password. Passwords go directly to Better Auth and must not be added to repository files or frontend environment variables.
2. Open the Resend verification email, complete verification, and sign in through `/login`.
3. Obtain this account's **local application user ID** from the `users:viewer` authenticated result or the Convex `users` table. It is different from the Better Auth component user ID.
4. Set `SUPER_ADMIN_USER_ID` in Convex to that exact local user ID. Only that immutable ID receives administrator access; an email address or matching password never grants a role.
5. Refresh the signed-in application. The header reveals the admin-console link. Console actions independently validate the role on the server.

This bootstrap requires a working verified Resend sender and backend deployment. `SUPER_ADMIN_PASSWORD` and `ADMIN_SESSION_SECRET` are unnecessary: Better Auth handles password hashing and session issuance. No unauthenticated admin-bootstrap endpoint exists.

## Existing accounts

The old Convex Auth tables are retained to avoid deleting existing records. The new Better Auth identity is bound by immutable `authSubject` to a local application profile. Existing accounts, profiles, and betslips are not automatically linked by email: that would allow account takeover when an address has not been proven under the old system. A separate migration must verify ownership of both identities before linking records. Until that migration is implemented, previous accounts need to register and verify under Better Auth and receive a separate application profile.

## Compatibility and verification

The repository uses SvelteKit 3. Better Auth 1.6.11 declares an optional SvelteKit 2 peer dependency for its own SvelteKit adapter. This implementation uses its framework-neutral browser client and Convex backend, with a custom SvelteKit 3 request handler; it does not import the Better Auth SvelteKit adapter. Dependency installation currently requires `npm ci --legacy-peer-deps` to bypass that optional adapter peer declaration. Convex and frontend TypeScript checks validate these integration boundaries, but live verification/reset delivery and production sessions must be tested after the external services are available.
