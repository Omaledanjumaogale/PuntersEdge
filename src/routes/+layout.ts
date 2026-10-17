// Public content and metadata are rendered on the server for search and AI discovery.
// Authenticated state and realtime subscriptions initialize only after mounting.
export const ssr = true;
// Every page is a data-free static shell. APIs retain runtime authorization.
export const prerender = true;
export const trailingSlash = 'never';
