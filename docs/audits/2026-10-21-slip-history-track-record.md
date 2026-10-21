# Betslip evidence, settlement and complete market track record

21 October 2026, Africa/Lagos.

Generated ticket previews and eligible options now show sport, league/tournament and country where recorded. The machine carries metadata explicitly instead of relying on individual market rows. Machine evidence and up to three alternative picks persist through working-slip sync, named-history saves and edits. A collapsed evidence panel remains readable after completion, independently of the board review window. Legacy selections without snapshots are identified honestly; no retrospective rationale is fabricated.

Working slips display scores and verdicts. Cloud draft queries resolve retained fixture states. Named histories preserve final scores/evidence after archive removal and continue overlaying corrected final scores while archives remain. Full-game projection totals, team totals and handicaps now settle; period projections use explicit observed period scores, never substitute final scores. Ingest and database metadata now retain those period scores.

Removed arbitrary ticket fixture-count caps; the persisted-item budget is 700,000 UTF-8 bytes to remain below Convex document limits. The backend regression covers saving and editing 151 fixtures and rejects oversized payloads explicitly. Combined-odds numeric overflow is still rejected rather than storing an invented return. This is larger-ticket support, not literally unlimited storage. History retains its existing 100-ticket account limit.

The old public track-record panel counted featured executable verdicts, at most one per fixture; it was not the complete market ledger. Removed that panel and enhanced the administrator track record. Published fixtures, fixtures with graded outcomes and settled market-option counts are distinct. Sport, semantic market direction, scope, exact market, grade and version breakdowns are available. All settleable published options count, including PASS/unpriced projections; ROI uses actual quoted prices only. Multiple lines/opposite sides within a fixture are correlated and are not independent observations. Pending/missing outcomes never become wins/losses.

Retained snapshots get one-time semantic-dimension reindexing. The maintenance script reindexes older archive-backed rows from their original published selections and outcomes, subtracting previous aggregates before adding replacements. No forecasts are generated after the result, and a missing archive is reported rather than guessed. Heavy evidence remains in R2; Convex stores compact aggregates and private user snapshots. Saved-slip settlement pages were reduced to ten documents per mutation to bound read/write work for larger tickets.

Acceptance and deployment results will be appended after final checks.
