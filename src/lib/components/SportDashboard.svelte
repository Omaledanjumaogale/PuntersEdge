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
	import Accordion from './Accordion.svelte';

	let { sport }: { sport: SportKey } = $props();
	const info = $derived(SPORTS[sport]);
	let league = $state<string>('all');
	let competitionSearch = $state('');
	let scheduleLimit=$state(20),resultLimit=$state(24);
	$effect(() => { sport; league = 'all'; competitionSearch = ''; scheduleLimit=20;resultLimit=24; });

	const preds = $derived(app.bySport(sport));
	const games = $derived(app.games.filter((g) => g.sport === sport));
	const leagues = $derived([...new Set([...preds.map((p) => p.league), ...games.map((g) => g.league)])].sort());
	const visibleLeagues = $derived(leagues.filter((name) => name.toLocaleLowerCase().includes(competitionSearch.trim().toLocaleLowerCase())));
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
			.slice(0, resultLimit)
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
		{upcoming.length} upcoming {upcoming.length === 1 ? 'game' : 'games'} analysed{edges ? `, ${edges} with a price above fair value` : ''}. {info.engine}
	</p>
	<p class="mt-1 text-sm text-haze">Markets: {info.markets}.</p>
</header>

<div class="mt-5"><SportTabs /></div>

<Accordion title="All competitions" count={leagues.length}>
 <p class="mb-3 text-sm text-haze">{league === 'all' ? `Showing all ${info.label.toLowerCase()} competitions in the provider feed.` : `Selected: ${league}`}</p>
 <label class="block text-sm font-medium text-haze">Find a league or tournament
  <input type="search" bind:value={competitionSearch} placeholder="Search competitions…" class="mt-2 w-full rounded-xl border border-line bg-deep p-3 text-chalk" />
 </label>
 <div class="mt-4 grid max-h-80 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3" role="group" aria-label={`${info.label} competitions`}>
  {#each ['all', ...visibleLeagues] as l (l)}
   <button onclick={() => (league = l)} aria-pressed={league === l} class="min-h-11 rounded-xl px-3 py-2 text-left text-sm font-medium ring-1 transition-colors {league === l ? 'tint-pop text-chalk ring-pop' : 'bg-deep text-chalk ring-line hover:ring-pop'}">
    {l === 'all' ? 'All competitions' : l}
   </button>
  {/each}
 </div>
 {#if !leagues.length}<p class="mt-3 text-sm text-haze">Competition names appear when the provider fixture feed is available.</p>{:else if !visibleLeagues.length}<p class="mt-3 text-sm text-haze">No competitions match your search.</p>{/if}
</Accordion>

	<Accordion title="Live now" count={live.length + liveUnpriced.length}>
		{#if !live.length&&!liveUnpriced.length}<p class="mb-3 text-sm text-haze">No live fixtures in this selection.</p>{/if}
		<h2 id="live-{sport}" class="flex items-center gap-2 text-2xl font-bold text-chalk"><span class="h-2.5 w-2.5 animate-pulse rounded-full bg-loss" aria-hidden="true"></span> Live now</h2>
		<div class="mt-4 grid gap-4 md:grid-cols-2">
			{#each live as p (p.fixtureId)}<FixtureCard {p} />{/each}
		</div>
		{#if liveUnpriced.length}
			<div class="mt-3 grid gap-2 md:grid-cols-2">{#each liveUnpriced as g (g.id)}<GameRow {g} />{/each}</div>
		{/if}
	</Accordion>

<Accordion title="Upcoming" count={upcoming.length}>
	<h2 id="up-{sport}" class="text-2xl font-bold text-chalk">📅 Upcoming</h2>
	{#if upcoming.length}
		<div class="mt-4 grid gap-4 md:grid-cols-2">
			{#each upcoming as p (p.fixtureId)}<FixtureCard {p} />{/each}
		</div>
	{:else}
		<p class="surface mt-4 p-5 text-haze">No {info.label.toLowerCase()} games we can price in the next few days{league !== 'all' ? ` in ${league}` : ''}. {info.key === 'baseball' || info.key === 'hockey' || info.key === 'nba' ? 'Check the season calendar: off-season months are quiet.' : 'New fixtures arrive automatically.'}</p>
	{/if}
</Accordion>

<Accordion title="Also on the schedule" count={unpriced.length}>
		<h2 id="sched-{sport}" class="text-xl font-bold text-chalk">🗓️ Also on the schedule</h2>
		<p class="mt-1 text-sm text-haze">Known fixtures without prices or ratings yet.</p>
		<div class="mt-3 grid gap-2 md:grid-cols-2">{#each unpriced.slice(0, scheduleLimit) as g (g.id)}<GameRow {g} />{/each}</div>
 {#if !unpriced.length}<p class="mt-3 text-sm text-haze">No provider fixtures awaiting analysis in this selection.</p>{:else if unpriced.length>scheduleLimit}<button class="btn-secondary mt-4" onclick={()=>scheduleLimit+=40}>Show more scheduled fixtures</button>{/if}
	</Accordion>

{#if ['football','basketball','nba'].includes(sport)}<section class="surface mt-5 border-l-4 border-yellow-400 p-4"><h2 class="font-bold">🟡 Scoring market coverage</h2><p class="mt-2 text-sm text-haze">{sport==='football'?'Compare BTTS Yes/No, home and away goal totals, match goals and supported first-half goal forecasts.':'Compare full-game, first-half and first-quarter totals, both team totals and handicaps where mapped fitted team data is available.'} Open a fixture for exact lines, model percentages and selection evidence. Unpriced forecasts are estimates; missing period data does not become a zero score.</p></section>{/if}
<Accordion title="Recent results" count={results.length}>
		<h2 id="res-{sport}" class="text-xl font-bold text-chalk">✅ Recent results</h2>
		<div class="mt-3 grid gap-2 md:grid-cols-2">{#each results as g (g.id)}<GameRow {g} />{/each}</div>
 {#if !results.length}<p class="mt-3 text-sm text-haze">No recent provider scores in this selection.</p>{:else if games.filter(g=>(g.status.state==='finished'||g.status.state==='postponed')&&inLeague(g.league)).length>resultLimit}<button class="btn-secondary mt-4" onclick={()=>resultLimit+=24}>Show more results</button>{/if}
	</Accordion>
