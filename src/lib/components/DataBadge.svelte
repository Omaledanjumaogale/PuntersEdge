<script lang="ts">
	/** Where the numbers come from right now: live feed (and how fresh) or sample data. */
	import { feed } from '#lib/feed.svelte.ts';
	import { isConvexConfigured } from '#lib/convex.ts';
	import { ago } from '#lib/format.ts';
</script>

{#if feed.mode === 'live' && feed.data}
	<a href="/results#data" class="inline-flex items-center gap-1.5 rounded-full tint-model px-3 py-1 text-xs font-semibold text-model ring-1 ring-model/50" title="Live data: fixtures, results and prices from API-Sports, The Odds API and OddsPapi">
		<span class="h-1.5 w-1.5 rounded-full bg-model {feed.ageHours < 2 ? 'animate-pulse' : ''}" aria-hidden="true"></span>
		Live data · {ago(feed.data.generatedAt)}
	</a>
{:else}
	<a href="/results#data" class="inline-flex items-center gap-1.5 rounded-full bg-raised px-3 py-1 text-xs font-semibold text-chalk ring-1 ring-line" title={isConvexConfigured() ? 'Waiting for the first live feed from the backend' : 'No backend configured: built-in sample games'}>
		🧪 Sample games{isConvexConfigured() && (feed.status === 'checking' || feed.status === 'downloading') ? ' · connecting…' : ''}
	</a>
{/if}
