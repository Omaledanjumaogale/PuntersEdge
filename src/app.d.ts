// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
	namespace App {
		interface Platform {
			env: Record<string, unknown>;
			ctx: { waitUntil(promise: Promise<unknown>): void; passThroughOnException(): void };
			caches: CacheStorage;
		}
	}

	interface ImportMetaEnv {
		readonly VITE_CONVEX_URL?: string;
		readonly PUBLIC_CONVEX_URL?: string;
	}
}

export {};
