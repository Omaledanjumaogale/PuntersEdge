# PuntersEdge application and integration audit

Date: 19 October 2026 (Africa/Lagos). Scope: the SvelteKit application, Convex account/billing backend, Cloudflare Pages/R2 delivery, provider integrations, model publication/evaluation boundaries, deployment workflows and automated test suites.

## Assessment

The application has useful authorization, owner-scoped records, private R2 delivery, deterministic prediction engines and chronological evaluation controls. This release repairs member-specific access management, adds Korapay alongside Flutterwave, records signup/payment lifecycle events, reconnects R2 explanations and adds renewal interfaces. It also patches dependency advisories and several security controls.

**This is an evidence-based engineering audit, not a penetration-test certification, payment-acquirer approval or proof that predictions are profitable.** Source review and simulated tests cannot establish successful live settlement, receipt of a bank credit, physical-device behavior, or future betting returns. No customer card was charged and no funds were transferred during this audit.

## Architecture and synchronization reviewed

| Boundary | Current implementation | Review result |
|---|---|---|
| Sign-in and registration | Better Auth component, same-origin Pages proxy, verified-email gate, immutable auth-subject/local-user link | Pending-verification signups now synchronize through supported adapter triggers; existing registrations have a bounded idempotent migration. Passwords, tokens and card details are excluded from member logs. |
| Entitlement | Server-owned `account_access` and `subscriptions`; configured owner ID | Each request checks suspension and current access. Trial/free access and paid subscription are distinct. A verified payment cannot override a suspended status. |
| Admin UI | Shared navigation and paginated member workspace | Each card now has independent status/access drafts, save state and feedback. “Keep current access” prevents a status-only change from resetting trial dates. |
| Billing | Server-fixed NGN 10,000/month; Flutterwave v3 hosted/v4 dynamic transfer; Korapay hosted redirect | Provider initialization and verification are server-side. Callback query parameters cannot grant membership. Secrets never enter browser checkout payloads. |
| Webhooks | Public Convex HTTP routes with provider-specific signatures | Flutterwave raw-body HMAC/v3 secret header and Korapay data-object HMAC; exact provider/reference/amount/currency verification; duplicate settlement and transaction reuse protection. |
| Renewal | Calendar-month extension from the later of now or existing paid expiry | Expiry invalidates backend access. Upcoming/expired notices lead to checkout. Renewal is manual, not a recurring automatic debit mandate. |
| Activity | Server-recorded account/payment events; admin audit; sampled client presence | Histories load only when an admin opens a member. Presence remains approximate and client-reported, not a forensic record of every action. |
| Feed/storage | Private R2 bulk data; Convex small account/access/feed metadata | Feed/archive APIs recheck access; no public private-bucket URL. R2 explanation lookup repaired. Public preview remains separate and bounded. |
| Models | Sport-specific engines, immutable artifacts, retained forecasts/results, offline chronological comparisons | Tests verify promotion gates and non-improving candidate rejection. Model percentages are estimates; green screening indicators are not a validated ROI claim. |
| Tennis | Private informational snapshot and separate shadow evaluation | Experimental predictions exist; broader calibrated markets, settlement coverage and optimizer parity remain incomplete. |
| PWA | Static application shells, hashed assets, network-first public pages | Auth/admin/billing/premium APIs avoid shared offline caching. Missing tester/tennis navigation exclusions repaired. Physical installed-app acceptance remains separate. |
| Operations | Separate Pages/Convex deployments, ingestion quotas, daily retraining workflows | Source/CI coverage reviewed. Provider/hosting quotas still impose external capacity limits; no code change creates unlimited free capacity. |

## Findings repaired in this release

Severity denotes the consequence before repair, not a claim that an exploit occurred.

| ID | Severity | Finding and repair | Evidence |
|---|---|---|---|
| F01 | High | Shared member status/period state made independent access choices unclear. Replaced with per-ID drafts and individual mutation targets. Added `keep` semantics. | `src/routes/admin/members/+page.svelte`, `convex/testers.ts`; cross-user isolation tests. |
| F02 | High | Checkout used authenticated identity without rejecting suspended/deactivated access. Backend user/create/status checks now reject blocked accounts; frontend also disables checkout. | `convex/payments.ts`; blocked-account test makes no provider request. |
| F03 | High | Korapay was removed from callable billing despite a schema provider value. Added initialization, allowlisted redirect, signed webhook and server verification/reconciliation. | `convex/payments.ts`, `convex/http.ts`, `convex/lib/paymentSecurity.ts`. |
| F04 | High | Verified transactions lacked a cross-payment transaction-ID reuse check; v3 verification did not bind the returned transaction ID explicitly. Both checks added. | `payments.settle` and `payments.verify`; underpayment/reuse tests. |
| F05 | High | Checkout accepted any HTTPS redirect from a provider response. Added exact hosted-checkout host allowlists, no userinfo/alternate ports. | `convex/lib/paymentSecurity.ts`; malicious-host test. |
| F06 | High dependency advisory | Installed authentication packages had known advisories: initial production scan reported one critical and one high package. Updated `@auth/core` to 0.41.3+, Better Auth to 1.6.22+, and compatible jose 6.1.3+. Runtime tests retained. Installed features do not establish that every advisory was exploitable here. | `package.json`, lockfile; final npm audit and authentication tests. |
| F07 | Medium | User management missed signups until verified sign-in. Supported auth triggers now register unverified accounts by immutable subject and record verification/sign-in events; bounded import covers older registrations. | `convex/auth.ts`, `convex/users.ts`, `convex/lib/accountEvents.ts`; real HTTP signup path tested with mocked email. |
| F08 | Medium | Failed checkout initialization disappeared into generic UI errors. It now leaves a payment attempt, failure classification and server event. Verified provider declines are retained separately. | `payments.create/prepared/markFailed`; member history and checkout attempt list. |
| F09 | Medium | Return URLs did not initiate owner-scoped reconciliation. Checkout page now checks the returned reference server-side, preserves manual status checks and displays pending/verified states. | `src/routes/subscribe/+page.svelte`; owner/throttle and UI tests. |
| F10 | Medium | Temporary Flutterwave transfer instructions disappeared on reload. They are stored in the owner's payment record and restored through the owner-only subscription query. | `payments.prepared/mine`; transfer round-trip test. |
| F11 | Medium | Missing webhook delivery had no bounded automatic reconciliation. Three delayed provider checks now run per prepared checkout; paid/nonpending records stop. | `payments.reconcile`; idempotent settlement tests. This is recovery, not constant polling. |
| F12 | Medium | Generic expiry notices and paid-only billing summary omitted complimentary grants/status. Billing uses the common entitlement helper; renewal notices cover approaching/expired access. | `RenewalNotice.svelte`, layout, subscription query. |
| F13 | Medium | Admin loader could subscribe to its own busy state and repeatedly reload. The auth-triggered initial load now runs untracked. | Member workspace; browser assertion counts a single list load. |
| F14 | Medium | Explanation service rejected R2 feed metadata because its old Convex file URL was null. Added restricted private R2 fetch with server secret and cached evidence-only prose. | `convex/ai_insights.ts`; private-feed/cache regression test. |
| F15 | Medium | Tester and tennis routes were missing from shared-offline-cache exclusions. Added both. | `src/service-worker/index.ts`. |
| F16 | Medium | Anti-framing/base/object protections were absent from shared responses. Added consistent static and runtime headers without blocking required app scripts. | `_headers`, `src/hooks.server.ts`. This is not a full script/style CSP. |
| F17 | Medium | Sensitive auth rate-limit persistence was implicit/per-instance. Enabled database-backed limits for sensitive auth actions; ordinary session/token reads are excluded to limit I/O. | `convex/auth.ts`; HTTP signup integration test. Trusted edge-IP/rate-limit deployment acceptance remains an operational check. |
| F18 | Medium | Live Flutterwave initialization exposed an existing-customer conflict (HTTP 409). Added exact-email resolution for legacy customers, account-bound cached IDs and a stable customer idempotency key for renewals. Unmatched customer records are rejected. | `payments.customerForCheckout/attachV4`; duplicate, mismatch and renewal-cache tests. |
| F19 | Medium | Live Flutterwave virtual-account validation requires an alphanumeric reference. New v4 references now use cryptographically random alphanumeric IDs; callbacks accept both new and legacy formats. | Provider HTTP 400 field-level validation; v4 initialization and callback regression tests. |

## Open gaps and limits

| Priority | Gap | Consequence / next acceptance criterion |
|---|---|---|
| P1 | Real paid settlement acceptance | Live keys and unpaid checkout initialization do not prove a funded payment. Complete one genuine NGN payment per gateway, verify the provider dashboard/webhook delivery, local paid record and expiry, then replay the callback without a second extension. No funds were moved by this audit. |
| P1 | Refund/chargeback operations | Subscription fulfillment covers verified incoming payments. Automated refund/chargeback access adjustments and a reconciliation inbox are not implemented. Handle disputes through the provider dashboard plus audited per-account suspension/revocation until that workflow is built. |
| P1 | Administrator MFA | Admin authorization is server-verified by owner ID, but a mandatory MFA/recovery workflow is not implemented. Add tested MFA and recovery before increasing administrative staff/access. |
| P1 | Credential rotation after disclosure | Several credentials were supplied in chat. No raw live credential was found by the targeted tracked-file scan. Rotate exposed provider/deployment keys through their dashboards and update deployment secrets after acceptance; the audit does not silently revoke live integrations. |
| P2 | Auth abuse deployment proof | Persistent backend throttles are configured; confirm trusted client IP propagation and limits across real edge/backend instances. Do not infer distributed abuse resistance from a local test alone. |
| P2 | Payment monitoring depth | Pending and failed attempts are visible; an admin provider-query/retry dashboard, stale-pending alerts and refund reconciliation are not complete. Three recovery checks are intentionally bounded. |
| P2 | Event retention and search | Account events and admin audit are paginated/indexed for recent views, but a configurable retention/export policy and global searchable member/transaction index are not implemented. Establish retention before volume grows. |
| P2 | Personal-data operations | Member contact, DOB and location are admin-only. Dedicated data export/deletion requests and documented retention/legal notices need a separate verified product workflow. Password/session/card logging is intentionally excluded. |
| P2 | Browser security policy | Anti-framing, nosniff and basic CSP directives are present. A full nonce/hash-based script/style CSP and a tested report endpoint remain outstanding. |
| P2 | Model validation | Chronological training/promotions are guarded, but prediction UI availability is not proof of calibration or positive ROI for every market. Keep segment-level sample sizes, Brier/log-loss, calibration and realized return review visible. Never relabel unvalidated estimates as proven winning percentages. |
| P2 | Tennis parity | Informational winner projections/shadow research do not establish calibrated first-set, totals, handicaps or automatic settlement parity. Do not activate unsupported outcomes as validated betting markets. |
| P2 | Data licensing | Source attribution and private storage exist for research inputs. Review the dataset/provider license ledger for a paid subscription product; backend training alone does not automatically remove license restrictions. |
| P2 | Hosting/provider free limits | Static shells, direct public preview, R2 bulk storage and quotas reduce usage. They cannot eliminate per-request authorization costs or guarantee unlimited free capacity. Review actual post-release usage and avoid blanket polling/whole-feed subscriptions. |
| P2 | Full external-device acceptance | Real email verification/reset delivery, real user payment, physical Android/iOS installation updates and push receipt require separate live/device evidence. Mocked tests establish code behavior, not those outcomes. |
| P3 | Admin workflow scale | Per-member controls and lazy histories are improved; global member search, advanced payment filtering and richer accessibility/usability testing remain improvements. |

## Evidence and testing

- Full application test suite: 153 tests passed before final release validation.
- Backend suites: 58 tests passed before customer-reuse expansion; the expanded 60-test suite passed in production CI. Resource-constrained Windows runs hit 5-second timeouts in existing tests; these were not suppressed or relaxed. The three targeted Flutterwave initialization/cache/conflict tests passed locally.
- Frontend type check: zero errors and zero warnings before final release validation; backend type check passed.
- Dependency audit after patching: zero known advisories across the installed dependency tree at scan time. This is not a guarantee of absence of vulnerabilities.
- Targeted tracked-file secret scan: 430 tracked files inspected; no matches for the checked live-key patterns. It is not a full Git-history or external-secret exposure audit.
- Flutterwave read-only production probes: OAuth 200, bank directory 200 and charge lookup 200.
- Korapay read-only production authentication: 200; no balance values or credentials were logged.
- Local browser QA passed at 390px and 1440px: separate member selectors, access persistence, lazy histories, gateway controls, restored transfer instructions, renewal links and no horizontal overflow.
- Tests use synthetic accounts, mocked provider settlement and mocked email delivery. Browser account/payment QA runs only on localhost; no real member's access was edited by these tests.

## Provider implementation references

- [Korapay hosted checkout initialization and return verification](https://developers.korapay.com/docs/checkout-redirect): server initialization, unique reference, callback handling and verification.
- [Korapay webhook signatures](https://developers.korapay.com/docs/webhooks): HMAC-SHA256 over the data object, hexadecimal signature header and duplicate-delivery handling.
- [Flutterwave customer API](https://developer.flutterwave.com/v4/reference/customers_create) and [customer listing](https://developer.flutterwave.com/v4.0.0/reference/customers_list): conflict handling and server-side exact matching.
- [Flutterwave webhook guidance](https://developer.flutterwave.com/v4.0/docs/webhooks): authenticate callbacks and verify provider transaction data before fulfillment.
- [Auth.js advisory GHSA-7rqj-j65f-68wh](https://github.com/advisories/GHSA-7rqj-j65f-68wh), [Auth.js advisory GHSA-x445-f3h2-j279](https://github.com/advisories/GHSA-x445-f3h2-j279), [Better Auth advisory GHSA-qq9h-g4jm-xgf3](https://github.com/advisories/GHSA-qq9h-g4jm-xgf3): dependency patch rationale. Feature applicability was not treated as proof of exploitation.

## Release acceptance record

- Initial backend and frontend release at `3e8a40f` passed [backend CI/deploy](https://github.com/Omaledanjumaogale/PuntersEdge/actions/runs/39293737802) and [Pages CI/deploy](https://github.com/Omaledanjumaogale/PuntersEdge/actions/runs/39293992461).
- Five existing registrations imported idempotently; no access grants changed and no verification emails sent.
- Korapay live unpaid hosted-checkout initialization succeeded at checkout.korapay.com for NGN 10,000. No funds moved.
- Flutterwave authenticated but first live checkout initialization returned HTTP 409, customer already exists. Customer reuse was repaired and deployed with the full 60-test CI passing. The next live request exposed an alphanumeric-reference validation requirement, now repaired with explicit initialization and callback tests. Final initialization acceptance is recorded below.
- Expanded browser assertions at 390px and 1440px passed, including automatic removal of paid transfer instructions; final frontend type check found zero errors and warnings.
- First CI run stopped before deployment on an environment-dependent test expectation. The test now explicitly clears the Korapay key for its unconfigured-gateway scenario; the corrected full CI passed.
- Local production build and static application-shell/API routing checks passed. Provider dashboard webhook delivery and funded settlement still require a genuine payment.
