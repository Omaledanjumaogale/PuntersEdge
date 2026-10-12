<script lang="ts">
	/**
	 * One sport's dashboard: live games, upcoming priced games with picks,
	 * the rest of the schedule, and recent results. Shared by all five sports.
	 */
	import { app } from '#lib/state.svelte.ts';
	import { SPORTS, type SportKey } from '#lib/sports.ts';
	import FixtureCard from './FixtureCard.svelte';
	import GameRow from './GameRow.svelte';
	import SportTabs from './SportTabs.svelte';
	import DataBadge from './DataBadge.svelte';

	let { sport }: { sport: SportKey } = $props();
	const info = $derived(SPORTS[sport]);
	let league = $state<string>('all');

	const preds = $derived(app.bySport(sport));
	const games = $derived(app.games.filter((g) => g.sport === sport));
	const leagues = $derived([...new Set([...preds.map((p) => p.league), ...games.map((g) => g.league)])].sort());
	const inLeague = (l: string) => league === 'all' || l === league;

	const live = $derived(preds.filter((p) => p.status.state === 'live' && inLeague(p.league)));
	const upcoming = $derived(preds.filter((p) => p.status.state === 'scheduled' && inLeague(p.league)));
	const pricedIds = $derived(new Set(preds.map((p) => p.fixtureId)));
	const liveUnpriced = $derived(games.filter((g) => g.status.state === 'live' && !pricedIds.has(g.id) && inLeague(g.league)));
	const unpriced = $derived(games.filter((g) => g.status.state === 'scheduled' && !pricedIds.has(g.id) && inLeague(g.league)));
	const results = $derived(
		games
			.filter((g) => (g.status.state === 'finished' || g.status.state === 'postponed') && inLeague(g.league))
			.sort((a, b) => b.kickoff.localeCompare(a.kickoff))
			.slice(0, 24)
	);
	const edges = $derived(upcoming.filter((p) => p.bestValue && p.bestValue.edgePercent > 0 && p.bestValue.grade !== 'PASS').length);
</script>

<svelte:head><title>{info.label} — PuntersEdge</title></svelte:head>

<header class="max-w-3xl">
	<div class="flex flex-wrap items-center gap-3">
		<h1 class="text-4xl font-extrabold text-chalk"><span aria-hidden="true">{info.emoji}</span> {info.label}</h1>
		<DataBadge />
	</div>
	<p class="mt-2 text-haze">
		{upcoming.length} upcoming {upcoming.length === 1 ? 'game' : 'games'} priced{edges ? `, ${edges} with a price above fair value` : ''}. {info.engine}
	</p>
	<p class="mt-1 text-sm text-haze">Markets: {info.markets}.</p>
</header>

<div class="mt-5"><SportTabs /></div>

{#if leagues.length > 1}
	<div class="mt-4 flex flex-wrap gap-2" role="group" aria-label="Competition">
		{#each ['all', ...leagues] as l (l)}
			<button
				onclick={() => (league = l)}
				aria-pressed={league === l}
				class="rounded-full px-3 py-1.5 text-sm font-medium ring-1 transition-colors {league === l ? 'bg-chalk text-ink ring-chalk' : 'bg-deep text-chalk ring-line hover:ring-pop'}"
			>
				{l === 'all' ? 'All competitions' : l}
			</button>
		{/each}
	</div>
{/if}

{#if live.length || liveUnpriced.length}
	<section class="mt-8" aria-labelledby="live-{sport}">
		<h2 id="live-{sport}" class="flex items-center gap-2 text-2xl font-bold text-chalk"><span class="h-2.5 w-2.5 animate-pulse rounded-full bg-loss" aria-hidden="true"></span> Live now</h2>
		<div class="mt-4 grid gap-4 md:grid-cols-2">
			{#each live as p (p.fixtureId)}<FixtureCard {p} />{/each}
		</div>
		{#if liveUnpriced.length}
			<div class="mt-3 grid gap-2 md:grid-cols-2">{#each liveUnpriced as g (g.id)}<GameRow {g} />{/each}</div>
		{/if}
	</section>
{/if}

<section class="mt-8" aria-labelledby="up-{sport}">
	<h2 id="up-{sport}" class="text-2xl font-bold text-chalk">📅 Upcoming</h2>
	{#if upcoming.length}
		<div class="mt-4 grid gap-4 md:grid-cols-2">
			{#each upcoming as p (p.fixtureId)}<FixtureCard {p} />{/each}
		</div>
	{:else}
		<p class="surface mt-4 p-5 text-haze">No {info.label.toLowerCase()} games we can price in the next few days{league !== 'all' ? ` in ${league}` : ''}. {info.key === 'baseball' || info.key === 'hockey' || info.key === 'nba' ? 'Check the season calendar: off-season months are quiet.' : 'New fixtures arrive automatically.'}</p>
	{/if}
</section>

{#if unpriced.length}
	<section class="mt-8" aria-labelledby="sched-{sport}">
		<h2 id="sched-{sport}" class="text-xl font-bold text-chalk">🗓️ Also on the schedule</h2>
		<p class="mt-1 text-sm text-haze">Known fixtures without prices or ratings yet.</p>
		<div class="mt-3 grid gap-2 md:grid-cols-2">{#each unpriced.slice(0, 20) as g (g.id)}<GameRow {g} />{/each}</div>
	</section>
{/if}

{#if results.length}
	<section class="mt-8" aria-labelledby="res-{sport}">
		<h2 id="res-{sport}" class="text-xl font-bold text-chalk">✅ Recent results</h2>
		<div class="mt-3 grid gap-2 md:grid-cols-2">{#each results as g (g.id)}<GameRow {g} />{/each}</div>
	</section>
{/if}
