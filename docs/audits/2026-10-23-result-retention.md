# Finished-result review retention — 23 October 2026

Full published match analysis now stays available for 24 hours after the first verified final result is received, instead of 12 hours. This applies to all sports using the shared production feed. A recently finished projection remains in the feed even if a delayed final result belongs to an older kickoff date. Results pages state the same window.

Recent provider scores already remain in the hot feed for up to three days from kickoff, with show-more pagination. Evidence history keeps recorded default-rule pre-match shortlist entries in protected R2 daily shards beyond 24 hours, with immutable qualification evidence and updated final outcomes. The protected admin history and production ledger remain the review/training provenance source; no post-result prediction is invented. Existing scheduled archival and retraining workflows are unchanged, and this change does not assert an accuracy improvement or automatic promotion of a candidate model.

Cost boundary: no new Convex tables, archive copies, retention-extension writes or polling schedules. Existing seven-day retained projection snapshots are reused. Full review inputs remain in the current compressed feed for another twelve hours, so its size and corresponding R2 storage/transfer can increase modestly. There is no honest zero-byte/zero-request guarantee; strict zero growth would require leaving the existing display window unchanged. This implementation avoids adding a duplicate historical dataset.

Verification: exact 24-hour boundary, availability at hour 23, delayed final-result visibility, immutable pre-match inputs, settled record survival and existing evidence-history settlement tests. Full checks and production release are recorded in the task response.
