<script lang="ts">
	/** Compact schedule/result line for games without a full card. */
	import { app } from '#lib/state.svelte.ts';
	import type { FeedGame } from '#lib/feed.svelte.ts';
	import { kickoff, sportEmoji } from '#lib/format.ts';
	import StatusPill from './StatusPill.svelte';

	let { g, showSport = false }: { g: FeedGame; showSport?: boolean } = $props();
	const done = $derived(g.status.state === 'finished');
	const hw = $derived(done && (g.status.home ?? 0) > (g.status.away ?? 0));
	const aw = $derived(done && (g.status.away ?? 0) > (g.status.home ?? 0));
</script>

<a href="/match?id={g.id}" class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-deep px-3.5 py-2.5 ring-1 ring-line transition-colors hover:ring-pop">
	<span class="min-w-0">
		<span class="block truncate text-xs font-medium text-haze">{showSport ? `${sportEmoji[g.sport]} ` : ''}{g.league}{g.status.state === 'scheduled' ? ` · ${kickoff(g.kickoff, app.now)}` : ''}</span>
		<span class="block truncate font-semibold text-chalk">
			<span class={hw ? 'text-model' : ''}>{g.home}</span>
			<span class="font-normal text-haze">vs</span>
			<span class={aw ? 'text-model' : ''}>{g.away}</span>
		</span>
	</span>
	{#if g.status.state === 'scheduled'}
		<span class="text-xs font-medium text-haze">{g.books ? `${g.books} books` : 'no prices yet'}</span>
	{:else}
		<StatusPill status={g.status} />
	{/if}
</a>
