import {copyFileSync} from 'node:fs';
// The adapter's default 404 is a plain "Not Found". Keep a useful static recovery page.
copyFileSync('static/recovery.html','.svelte-kit/cloudflare/404.html');

await import('./security-headers.mjs');
