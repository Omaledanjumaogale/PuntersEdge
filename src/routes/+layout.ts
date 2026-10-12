// The app is a client-rendered PWA: every route is prerendered to a static
// shell so it can be precached by the service worker and served from any CDN.
export const ssr = false;
export const prerender = true;
export const trailingSlash = 'never';
