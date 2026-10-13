/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

/**
 * PuntersEdge service worker.
 *
 * - Precaches the app shell: every hashed build asset, static file and
 *   prerendered page, versioned by the build so deploys never mix assets.
 * - Assets: cache-first (they're immutable).
 * - Pages: network-first with a 3s timeout, falling back to the cached page,
 *   then the cached board, so the app opens instantly offline.
 * - Fonts are self-hosted build assets, so they are precached with the shell.
 * - Waits for the page to send SKIP_WAITING so updates are user-approved.
 */

import { immutable, assets, prerendered } from '$app/manifest';
import { version } from '$app/env';
import { self as sw } from '$app/service-worker';

/** Manifest paths are base-relative; normalise to absolute pathnames. */
const abs = (path: string) => `/${path.replace(/^\/+/, '')}`;
const build = immutable.map((f) => abs(f.path));
const files = assets.map((f) => abs(f.path));
const pages = [...prerendered.map((f) => abs(f.path)), '/', '/board', '/sports', '/football', '/nba', '/basketball', '/hockey', '/baseball', '/glossary'];

const SHELL = `qe-shell-${version}`;

// Screenshots are only for install UI; keep them out of the offline payload.
const PRECACHE = [...build, ...files.filter((f) => !f.startsWith('/screenshots/')), ...pages];
const PRECACHED = new Set(PRECACHE);

sw.addEventListener('install', (event) => {
	event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll(PRECACHE)));
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			for (const key of await caches.keys()) {
				if (key !== SHELL) await caches.delete(key);
			}
			await sw.clients.claim();
		})()
	);
});

sw.addEventListener('message', (event) => {
	if (event.data?.type === 'SKIP_WAITING') sw.skipWaiting();
});

function timeout(ms: number) {
	return new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
}

async function networkFirstPage(request: Request, path: string): Promise<Response> {
	const cache = await caches.open(SHELL);
	try {
		const response = await Promise.race([fetch(request), timeout(3000)]);
		if (response.ok && response.type === 'basic') cache.put(path, response.clone());
		return response;
	} catch {
		return (
			(await cache.match(path)) ??
			(await cache.match(path.replace(/\/$/, '') || '/')) ??
			(await cache.match('/')) ??
			new Response('PuntersEdge is offline and this page has not been saved yet.', {
				status: 503,
				headers: { 'content-type': 'text/plain; charset=utf-8' }
			})
		);
	}
}

sw.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;

	const url = new URL(request.url);

	if (url.origin !== sw.location.origin) return;
	// Auth, billing, administration and API responses must never enter the shared offline cache.
	if (/^\/(?:api|admin|bet-machine|betslips|account|login|signup|subscribe|auth)(?:\/|$)/.test(url.pathname)) return;

	if (PRECACHED.has(url.pathname) && request.mode !== 'navigate') {
		event.respondWith(caches.match(url.pathname).then((hit) => hit ?? fetch(request)));
		return;
	}

	if (request.mode === 'navigate') {
		event.respondWith(networkFirstPage(request, url.pathname));
	}
});

// Notification links are restricted to the application origin.
sw.addEventListener('notificationclick', (event) => {
 event.notification.close();
 event.waitUntil((async () => {
  const url = new URL(event.notification.data?.url ?? '/', sw.location.origin);
  if (url.origin !== sw.location.origin) return;
  const clients = await sw.clients.matchAll({ type: 'window', includeUncontrolled: true });
  const existing = clients.find((client) => new URL(client.url).origin === url.origin);
  if (existing) { await existing.navigate(url.href); await existing.focus(); }
  else await sw.clients.openWindow(url.href);
 })());
});

sw.addEventListener('push', (event) => {
 event.waitUntil((async () => {
  let payload: { title?: string; body?: string; url?: string } = {};
  try { payload = event.data?.json() ?? {}; } catch { /* Show a generic alert for malformed payloads. */ }
  let url = new URL('/results', sw.location.origin);
  try { url = new URL(typeof payload.url === 'string' ? payload.url : '/results', sw.location.origin); } catch { /* Retain the safe results link. */ }
  await sw.registration.showNotification(typeof payload.title === 'string' ? payload.title.slice(0,100) : 'PuntersEdge update', {
   body: typeof payload.body === 'string' ? payload.body.slice(0,240) : 'Open PuntersEdge for the latest results.',
   icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', tag: 'puntersedge-results',
   data: { url: url.origin === sw.location.origin ? url.href : '/results' }
  });
 })());
});
