# Tester entry and recent model evaluation

Tester credentials are shared invitation credentials. They are not a shared
Better Auth user. Each adult creates a personal account, verifies their email,
returns to `/tester`, completes the mandatory profile and redeems the invitation.
Production invitation configuration has been reset and read back for an exact
match; values are deliberately excluded from source and public pages.

The tester signup link previously discarded its return path, and signup always
generated an email-verification callback to `/account`. The new path survives
signup and verification. Login and tester entry explain which credentials belong
in each step. Return paths reject external, protocol-relative, backslash and
control-character inputs. Personal authentication, verification and per-user
access controls remain required.

Fixture identities and projected scores use a shared yellow token. Daylight mode
uses deeper gold for readable contrast. The landing page describes current
ranked markets, saved rules, ticket sharing and experimental tennis coverage;
it makes no promise of offline fresh data, automatic profit or verified tennis
betting value.

The October 18 production retraining run collected 33,903 result rows, compared
with 33,889 in the earlier daily evaluation. These are fixture/sport/period rows,
not a count of unique matches. Fourteen segments were evaluated and no candidate
qualified for replacement. Full-game holdout counts were MLB 7, EuroLeague 15,
Premier League 7, NHL 40 and NBA 27. New training rows beyond each incumbent's
cutoff were zero after reserving holdout and the 48-hour availability gap. The
recent sample cannot establish a reliable improvement. Incumbent probabilities
were retained; validation thresholds were not relaxed to manufacture progress.

The refreshed machine-readable evaluation is in
`training/reports/continuous-upgrade-evaluation.json`. The chronological daily
workflow continues to collect actual results and evaluate challengers. No new
strike-rate or ROI improvement is claimed by this release.
