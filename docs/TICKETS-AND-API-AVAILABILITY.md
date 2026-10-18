# Ticket metadata and API availability

## Ticket repair

Working slips, saved histories, PDF and clipboard/native/WhatsApp sharing use the
same sport/competition metadata formatter. A distinct tournament is retained
alongside the league; if the provider supplies one competition name, it appears
as “League / tournament”. Country appears only when recorded or sourced from the
same fixture. Unknown countries are not inferred from team or player names.

The saved-slip editor previously omitted league and country when rebuilding its
mutation payload. The on-screen ticket and history also omitted metadata even
when it was available to PDF/share code. Both paths are repaired, and optional
tournament fields now survive draft synchronization, named save, editing and
exports. Older slips can recover known fields from current feed data or retained
projection metadata. Records whose source metadata no longer exists cannot have
unknown countries reconstructed honestly.

Ingestion enriches retained projection metadata from known fixture fields without
changing the original numerical forecast or publication time. Convex stores only
compact metadata; full evidence remains in private R2. Tennis records distinguish
the tour (ATP/WTA) from the tournament title.

## API investigation and prevention

The built Worker returned the expected API responses locally. Production initially
returned the static HTML recovery page for all probed API routes across both the
custom domain and Pages hosts. After the daily quota reset, the same deployed
code returned gzip preview data and a proper membership rejection for anonymous
tennis requests. The project had fail-open enabled. This evidence supports shared
Functions quota exhaustion followed by static-asset fallback, rather than a missing
SvelteKit endpoint. Do not claim an API is healthy merely because its page shell
renders.

Production and preview now use fail-closed configuration. The deployment workflow
reapplies and verifies it. Static HTML remains outside the Functions route list.
Inside the application, accidental HTML API errors are normalized to JSON, and
runtime responses carry `X-PuntersEdge-API: 1`. Production verification now checks
actual preview gzip/schema and the expected anonymous tennis 403, including the
runtime marker. It rejects recovery HTML.

Cloudflare references:
- https://developers.cloudflare.com/pages/functions/routing/
- https://developers.cloudflare.com/pages/functions/pricing/

## Public preview without Worker invocations

The dedicated `puntersedge-public` R2 bucket serves only the existing limited
five-fixture preview at
`https://data.puntersedge.ewinproject.org/preview/current.gz`. The private
`puntersedge-data` bucket was not made public. The scheduled runner reconstructs
the public document from an explicit whitelist; raw inputs, full markets,
historical records, usage and private URLs cannot pass through this publisher.

The custom domain has read-only CORS for the application origins. The frontend
uses credential-free direct preview fetches with a five-minute cache-key window;
the same-origin API is a bounded fallback. Private tennis/full-feed/auth requests
remain authorized APIs. Direct public preview delivery and scheduled R2 transfers
avoid app Worker invocations; they do not increase the shared account's quota or
guarantee private API availability if other applications exhaust that quota.

`PUBLIC_PREVIEW_URL` is configured in the Pages deployment workflow. Scheduled
ingestion uses existing Cloudflare deployment credentials to publish the sanitized
object, with no additional sports-provider call.
