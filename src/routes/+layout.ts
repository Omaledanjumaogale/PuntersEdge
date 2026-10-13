// Public content and metadata are rendered on the server for search and AI discovery.
// Authenticated state and realtime subscriptions initialize only after mounting.
export const ssr = true;
export const prerender = false;
export const trailingSlash = 'never';
