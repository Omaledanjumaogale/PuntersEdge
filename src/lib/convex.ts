/**
 * Optional Convex connection.
 *
 * The app runs fully on-device from the sample feed. When PUBLIC_CONVEX_URL
 * (or VITE_CONVEX_URL) is set, accounts and betslip sync use that deployment;
 * otherwise no network connection is attempted.
 */

export const convexUrl: string | undefined =
	(import.meta.env.PUBLIC_CONVEX_URL as string | undefined) || (import.meta.env.VITE_CONVEX_URL as string | undefined) || undefined;

export function isConvexConfigured() {
	return Boolean(convexUrl);
}
