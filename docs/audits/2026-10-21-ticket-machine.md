# Ticket machine and market-card repair

Date: 21 October 2026 (Africa/Lagos).

## Root causes and repair

The default fallback `buildModelShortlist` sliced its results to ten fixtures (and capped any explicit limit at thirty). Its default is now all eligible distinct events. The quoted-odds optimizer is a separate operation: it can choose up to thirty distinct events when their actual prices reach the requested target. A local low-price regression requires and obtains 23 legs. All eligible options remain browsable in batches of thirty for mobile responsiveness; Show more reveals the remaining options rather than discarding them.

Direction filtering depended on legacy ID prefixes and did not recognize newer `forecast:full` or `period` team-total choices. Filters now use selection direction, market meaning and scope; explicit team Over/team Under and match Over/match Under choices are always available. Existing group filters still work. Older saved Today/Tomorrow presets load as Next 24/48 hours; those calendar-day dropdown entries are removed.

A machine ticket now uses normalized sport, fixture name and kickoff minute to recognize matching provider event copies, with fixture ID as fallback when identity data is absent. Rematches at another kickoff remain distinct. Equivalent option copies prefer an actual quote; distinct scopes and lines remain separate. This does not infer that differently spelled provider aliases are the same team. Generated tickets have one leg per recognized event; adding another option for that event manually through the machine replaces its previous leg.

The market book formerly discarded any option whose estimated price edge exceeded 25%. It now retains the option for comparison. Existing decision rules still reject implausible value gaps, assign PASS and zero the recommended stake. Tests demonstrate both an Under-favoured lower projection and an Over-favoured higher projection at the same line. No probabilities were adjusted to manufacture balance, and these UI/selection repairs do not establish improved forecasting accuracy.

Working-slip fixture names were plain text. They are now actual analysis links with a touch target; navigation closes the sheet. Tennis links use the informational fixture anchor. Period team-total labels now include the team name.

## Visual implementation

The supplied coupon reference is implemented through a shared violet-charcoal card surface, subtle inset highlights, perforated side notches, rounded borders and readable wrapping. Page backgrounds remain black in dark mode; the light theme uses a pale lavender card with dark text. Existing yellow fixture identity, green/blue home/away identity, model percentage, quote labels, evidence accordions and add/remove controls remain present. Accordions initialize collapsed. No per-card blur or additional requests were introduced.

## Verification

- Existing plus new application regression suite: 159 tests passed before the final identity test addition.
- Specific shortlist/direction/duplicate tests: 15 passed before the final addition. New cases cover 45 fallback fixtures, 23 quoted legs, team Over/Under, period filters, provider copies and rematches.
- Frontend check: zero errors and zero warnings.
- Synthetic responsive/browser QA and deployment results: pending final acceptance below.

## Limits

All matches in the selected data window that pass the rules can be listed; missing or unpublished forecasts are not invented. A quoted accumulator is a subset constrained by the actual odds target, not a promise that every eligible fixture fits into one accumulator. Bounded beam search is not a proof of global optimality. Saved tickets now support 100 selections (previously 30), with a shared frontend/backend capacity guard and finite-price validation. A regression covers saving and editing a 45-fixture shortlist through the real backend. Longer research lists remain complete; the save control explicitly asks for at most 100 selections rather than failing unexpectedly. No win, bookmaker superiority or positive ROI is guaranteed by these engineering fixes.
