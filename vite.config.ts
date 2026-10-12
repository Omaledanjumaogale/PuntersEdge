import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	// Expose PUBLIC_CONVEX_URL (written by the Convex CLI) as well as VITE_* vars.
	envPrefix: ['VITE_', 'PUBLIC_'],
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter(),
			// Registered manually in #lib/pwa.svelte.ts so the app can surface
			// an "update ready" prompt instead of swapping versions silently.
			serviceWorker: { register: false },
			prerender: {
				handleHttpError: ({ path, message }) => {
					// Manifest screenshots are optional assets, not crawlable pages.
					if (path.startsWith('/screenshots/')) return;
					throw new Error(message);
				}
			}
		})
	]
});
