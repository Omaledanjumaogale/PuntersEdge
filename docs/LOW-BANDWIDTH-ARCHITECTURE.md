# Low-bandwidth data architecture

PuntersEdge uses private Cloudflare R2 Standard storage for bulk data and Convex for transactional metadata. D1 is not required. No paid plan has been selected by this change.

## Ownership and data flow

- Convex: verified accounts, subscription checks, working/saved tickets, saved rules, provider quota reservations, feed pointers, compact performance counters and archive pointers.
- R2 `puntersedge-data`: compressed hot ingest state, provider lookups, subscriber feeds, deliberately limited public previews, new immutable forecast evidence and durable retry outboxes. The bucket has no public domain.
- GitHub Actions `sports-ingest.yml`: the public repository's standard Linux runner executes the existing sports pipeline at minutes 7 and 37. Scheduled jobs can be delayed by GitHub. The same provider quotas remain enforced by durable Convex reservations before each paid request.
- Cloudflare Pages: R2 binding `DATA_BUCKET` serves streams. `/api/feed` checks current membership before any private read; `/api/archive` requires super-admin. Both return private/no-store responses. `/api/preview` only reads `preview/current.gz` and may be publicly cached for five minutes.
- `/api/internal/blob/*` is server-to-server only, with a random secret in Cloudflare, GitHub production secrets and Convex environment variables. It rejects traversal and unauthorized reads/writes. It never returns an R2 public URL.

## Why the former usage grew

The measured live store was 61,495,041 JSON bytes (3,803,886 gzip bytes), with 59,552,440 bytes of projections. Each scheduled tick loaded that store from Convex. Upcoming forecasts were refreshed simply because 30 minutes had elapsed, even when their inputs were unchanged. Per-fixture archival then repeatedly read and wrote aggregate counter documents. Feed HTTP proxying also downloaded Convex files before returning their bytes.

The replacement stops unchanged publications, batches up to 20 metadata updates per transaction, avoids rewriting settled aggregate counters for pre-match refreshes, separates quota ledgers from the larger ingest-state document, and stops quota-only updates from invalidating every subscriber feed query. Detailed admin performance subscriptions are active only in the performance workspace. Anonymous previews poll every ten minutes while visible and wait for initial session restoration.

## Evidence and failure recovery

New publications retain compressed original evidence in R2. Only hot settlement copies omit repeated prose and the already archived prior publication. A private migration backup preserves the original live store. Existing cold Convex archives remain available: mass-downloading them now would itself consume the remaining Convex egress. They incur no download egress while idle.

A tick writes an R2 outbox, atomically commits its pointer with the feed pointer, then applies idempotent archive, saved-fixture and notification updates. A failure leaves the outbox for the next tick to replay. Replaced hot-state files have a two-hour grace period for in-flight downloads and training jobs before a later successful tick removes them. Forecast archives and migration backups are not bulk-deleted.

Daily chronological retraining still runs. Collection reads the R2 live store; the relatively small retained training corpus/dataset remains on Convex storage. Promotion and betting-approval gates are unchanged. Manual admin refreshes use the same R2 pipeline from a Convex action, so use the automatic schedule for normal operation: manual bulk writes still count as Convex outgoing fetch traffic.

## Cost boundaries

This change reduces future consumption. It cannot reset already metered monthly usage or guarantee uninterrupted Convex service once the account has crossed a limit. R2's free allowance is account-wide and shared with other projects: Standard storage includes 10 GB-month, one million Class A operations and ten million Class B operations per month, with free Internet egress. Check Cloudflare account totals, not just this bucket. No automatic model training or feed refresh should spend extra sports-provider allowance outside the existing ledgers.

Sources: [Convex usage definitions](https://docs.convex.dev/production/usage-limits), [Convex query best practices](https://docs.convex.dev/understanding/best-practices), [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/), [GitHub scheduled-event limitations](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows).

## Verification

Regression tests exercise unchanged input deduplication, immutable evidence versus hot compaction, outbox replay, batch counter idempotency, isolated quota writes, private endpoint denial, subscriber-versus-admin access and limited public preview routing. Deployment acceptance must confirm the live preview reports `X-Data-Source: r2`, unauthorized private routes fail, the scheduled ingest completes and Convex metadata contains R2 pointers with no pending outbox or held lock.
