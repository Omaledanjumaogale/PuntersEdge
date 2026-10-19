# Audit remediation and acceptance record

Date: 20 October 2026 (Africa/Lagos). Follow-up to [the application and integration audit](2026-10-19-platform-audit.md). This document distinguishes implemented controls from external acceptance and statistical evidence.

## Changes implemented

- Authenticator enrollment, sign-in challenge, single-use recovery codes and recovery-code replacement. MFA is enforced server-side for the configured owner when `ADMIN_MFA_REQUIRED=true`; a session epoch also rejects surviving sessions created before enrollment. Enrollment revokes old sessions. The owner must personally enroll and retain recovery codes.
- A local, Apache-licensed Better Auth component schema preserves the existing component name and tables while adding the installed plugin's failed-attempt/lockout fields. HTTP integration tests exercise actual password, TOTP and backup-code endpoints.
- Throttled verification-email resend, trusted edge-IP forwarding and bounded streaming authentication requests. No passwords, setup keys or recovery codes enter activity logs.
- Paginated member search, exact-reference/status payment search, stale-payment indicators and an administrator-triggered bounded provider status check.
- Audited refund/dispute cases with optional per-member suspension. Restoring a case hold cannot override an independent account-status change or another open hold. Financial refunds remain provider-dashboard operations; no refund or charge was issued by this work.
- Owner-scoped paginated JSON data export, authenticated deletion requests, cancellation before processing and explicit admin fulfilment. Erasure blocks application access immediately, deletes personal application/authentication records in batches of 50 and scrubs checkout contact details. A deactivated ledger identity and minimum financial evidence remain. Owner accounts and open payment reviews are protected.
- Public privacy notice, account privacy/security interfaces and admin privacy/payment workspaces in the shared navigation.
- Daily indexed retention: at most 50 expired rows from each of five categories (250 deletes/day). Account events 90 days, admin audits 365 days, presence 30 days; financial evidence approximately seven years. A small aggregate status record exposes last run and capped stale-pending count. This bounds usage; it does not guarantee that a large backlog clears in one run.
- Per-page hash-based script CSP for static HTML, blocked script attributes, no eval permission and a bounded report endpoint that logs only a sanitized directive at most once/minute/isolate. Generated headers respect Cloudflare's 2,000-character line and 100-rule limits without adding Worker calls to page delivery. Dynamic inline styles remain allowed for existing application effects.
- Dataset licence ledger and visible Valuebetennis attribution. No non-commercial-only corpus was authorized for the paid product.

## Original open-gap disposition

| Original gap | Disposition and remaining acceptance |
|---|---|
| Real paid settlement | Remains external acceptance. Both gateways already initialized unpaid live checkouts; one genuine funded payment per gateway, provider dashboard delivery, expiry and replay evidence are still needed. No simulated test proves receipt of money. |
| Refund/chargeback operations | Reconciliation inbox and audited access holds implemented. Automatic provider refund initiation, refund/chargeback callbacks and automatic financial entitlement adjustments remain unimplemented. Operator records the provider decision manually. |
| Administrator MFA | Code and HTTP integration tests implemented. Production enforcement and the owner's personal enrollment must be recorded below. Do not treat merely enabling the flag as completed enrollment. |
| Credential rotation | Requires issuing replacement keys in the respective account dashboards and securely updating deployment secrets. Existing integrations were not silently revoked. No raw credentials belong in this report. |
| Verification-email recovery | Resend interface and backend limiter implemented. Actual inbox receipt/anti-spam acceptance remains unverified. |
| Auth abuse deployment proof | Spoofed forwarding headers removed and stream sizes bounded. Persistent limits and plugin lockout tested locally; distributed edge abuse/load testing remains separate. |
| Payment monitoring | Status/reference search, manual provider checks and capped stale counters implemented. Outbound incident notifications and automated refund reconciliation remain incomplete. |
| Event retention/search | Indexed bounded retention, member search and per-user export implemented. Retention constants are documented, not yet editable through an admin form. Transaction search uses exact reference/status rather than arbitrary full-text search. |
| Personal-data operations | Export, request/cancel/fulfil erasure, access fencing and scrubbing implemented/tested. This is an operational policy, not a legal compliance certification. |
| Browser security policy | Hash-based static script CSP and bounded report collection implemented. Dynamic inline styles remain allowed; a full restrictive style nonce/hash migration remains open. |
| Model validation | Existing chronological gates, segment diagnostics and retained results remain authoritative. Refresh execution/results are recorded below; no unsupported win-rate or ROI improvement is claimed. |
| Tennis parity | Licensed results-only training and informational winner/first-set research remain separate from unvalidated totals/handicaps/service-point markets. Broader live-market validation remains incomplete. |
| Data licensing | Ledger and attribution added. Account-holder review of API-Sports/odds subscription-product contract rights remains external. |
| Hosting/provider limits | New operations are paginated/indexed; retention and status checks bounded. Static page CSP adds no Worker request. Actual post-release quota trends and any platform limit increase remain external. |
| External-device acceptance | Physical installed PWA/icon/push receipt, actual email delivery and funded payments remain unverified. |
| Admin workflow scale | Shared navigation, member search and payment/privacy workspaces implemented. Larger-scale usability/accessibility acceptance remains ongoing. |

## Verification

- Existing application suite: 153/153 passed locally. New security-header generation test also passed (exact hashes, idempotence and header limits).
- Targeted audit backend suite: 10/10 passed on the warm final run, including actual HTTP MFA enrollment/challenge and used recovery-code rejection. Earlier cold Windows runs timed out at the unchanged 5-second limit; no timeout was relaxed or hidden.
- Backend TypeScript check passed before final deployment validation.
- Production HTML/static route checks passed locally. Vite finished generation, but the local Windows build process remained alive after adapter completion and was stopped; finalization and shell checks were then run explicitly. CI must confirm the complete command exits normally.
- Browser, CI, deployment, production enforcement and refreshed model outcomes: pending release verification below.

## Release acceptance

Pending execution. The report must not be read as evidence that external gates above have passed.
