/**
 * Optional Convex connection.
 *
 * The app runs fully on-device from the sample feed. When VITE_CONVEX_URL is
 * set, `getConvexClient()` returns a lazily created client for live fixtures
 * and synced betslips (see convex/); otherwise it returns null and no network
 * connection is attempted.
 */
import type { ConvexClient } from 'convex/browser';

let client: Promise<ConvexClient> | null = null;

export function isConvexConfigured() {
	return Boolean(import.meta.env.VITE_CONVEX_URL);
}

export function getConvexClient(): Promise<ConvexClient> | null {
	const url = import.meta.env.VITE_CONVEX_URL;
	if (!url || typeof window === 'undefined') return null;
	client ??= import('convex/browser').then(({ ConvexClient }) => new ConvexClient(url));
	return client;
}
