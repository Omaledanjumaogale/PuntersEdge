# Mobile and market availability release

The market sheet uses shrinkable grid columns, full-width choice labels and wrapping notes. It was exercised locally at 320, 360, 390 and 430 pixel widths with real saved feed data and an isolated client test identity. All sizes passed document and sheet overflow checks with no browser errors. This is browser layout evidence, not a physical-device or production authenticated-session test.

Renewable sessions last up to one year. Focus no longer recreates an already signed-in session. Feed subscriptions depend on account identity and entitlement rather than every viewer update, and transient connection failures retain the last feed. Owner-scoped cached data loads only after the current account and entitlement have been verified. Sign-out removes the owner's cache. Server subscription and administrator gates remain authoritative; expiration, revocation and browser cookie deletion can still require signing in again.

Market choices defaults to every published scheduled projection instead of only approved stakes. It supports filters for observed quotes and validated value. Full-game totals, both team totals and handicap ladders supplement priced markets; fitted period artifacts add supported first-half, first-quarter, first-period, regulation, first-five and first-inning estimates. A model cannot create an executable bookmaker price.

Green badges identify their basis:

- **Projection lean:** estimated outright outcome probability of at least 55%. Grades A+ >=85%, A >=70%, B >=60%, C >=55% describe model likelihood, not measured accuracy or profit.
- **Estimated value:** independent model evidence, a fresh quoted price, the decision screen and positive EV after a five-point probability sensitivity test. Approval remains separate.
- **Validated value:** additionally passes the approved market and domain gates. Unapproved models receive no automatic stake.

Every choice has a computed note with probability, refund probability, fair price, available observed price, input basis and comparison rank. Related markets are correlated. The deterministic fixture explanation uses the same actual predictions and cannot add injury, lineup or external-news claims. Existing 14 trained artifacts remain unapproved candidates; this release is not proof of improved strike rate or bookmaker-beating ROI.

Public NHL and MLB schedules/standings and Premier League fixtures/team records supplement licensed API-Sports ingestion, cached for 30 minutes. Team identities preserve licensed IDs with conservative crosswalks. NHL partner moneylines are displayed as observed prices, not approved settlement-compatible offers. Postponed games cannot be classified as scheduled projections. NBA public CDN returned 403; NBA and other competitions remain dependent on licensed provider coverage and availability. API-Sports daily and odds monthly budgets remain enforced. Public sources cannot supply every bookmaker market, verified injury or lineup data, or missing historical executable odds.

Fixtures first seen after kickoff are never backfilled as pre-match predictions. Visible app games and inputs are restricted to publication records; raw final results remain internally available for model inputs and settlement. Full-game football projection settlement uses regulation scores when supplied. Missing scope scores remain ungraded.

Regression coverage includes fitted-only NBA projections, duplicate low-goal ladder IDs, regulation settlement, per-market quote ages, known old source timestamps, postponed schedules, public identity/table reconciliation and public cache limits. Security tests cover entitlement, administrator authorization, model activation without implicit approval and owner-scoped betslips. Production CI repeats model and backend checks before deployment.
