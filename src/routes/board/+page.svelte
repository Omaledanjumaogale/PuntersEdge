<script lang="ts">
	import { app } from '#lib/state.svelte.ts';
	import { theme } from '#lib/theme.svelte.ts';
	import { pct, kickoff } from '#lib/format.ts';
	import ScoreSurface3D from '#lib/components/ScoreSurface3D.svelte';
	import FixtureCard from '#lib/components/FixtureCard.svelte';
	import PickTicket from '#lib/components/PickTicket.svelte';
	import DataBadge from '#lib/components/DataBadge.svelte';
	import { feed } from '#lib/feed.svelte.ts';
	import { SPORTS, SPORT_ORDER, type SportKey } from '#lib/sports.ts';

	let sport = $state<'all' | SportKey>('all');
	let innerWidth = $state(1024);

	const f = $derived(app.featured);
	const top = $derived(f?.topScorelines[0]);
	// Upcoming and live games only; finished ones live on the Results page.
	const fixtures = $derived(app.all.filter((p) => p.status.state !== 'finished' && (sport === 'all' || p.sport === sport)).slice(0, 40));
	const filters = $derived<Array<[string, string]>>([
		['all', '✨ All'],
		...SPORT_ORDER.filter((s) => app.bySport(s).length > 0).map((s) => [s, `${SPORTS[s].emoji} ${SPORTS[s].label}`] as [string, string])
	]);
	const picks = $derived(app.valueBets.slice(0, 3));
</script>

<svelte:head><title>Board — PuntersEdge</title></svelte:head>
<svelte:window bind:innerWidth />

<!-- Hero: the engine's output for the strongest edge with a score grid, in 3D -->
{#if f && top}
<section class="relative -mx-4 overflow-hidden sm:mx-0 sm:rounded-[var(--radius-sheet)] sm:border sm:border-line" aria-labelledby="hero-title">
	<div class="grid md:grid-cols-[1.1fr_1fr] md:items-center">
		<div class="order-2 px-4 pb-6 sm:px-8 md:order-1 md:py-10">
			<p class="flex flex-wrap items-center gap-2 text-sm font-medium text-haze">
				<span>🔥 Top pick, {SPORTS[f.sport as SportKey]?.emoji ?? ''} {f.league}, {kickoff(f.kickoffTime, app.now)}</span>
				<DataBadge />
			</p>
			<h1 id="hero-title" class="mt-2 text-[clamp(2.25rem,6vw,3.75rem)] font-bold leading-[0.95]">
				{f.homeTeam}<br /><span class="text-haze">vs</span> {f.awayTeam}
			</h1>
			<p class="mt-4 max-w-md text-[17px] leading-relaxed text-chalk/85">
				The most likely {f.family === 'football' ? 'result' : 'regulation score'} is <strong class="font-display text-chalk">{top.home}–{top.away}</strong> ({pct(top.prob, 1)}).
				{#if f.bestValue && f.bestValue.edgePercent > 0}
					The market underprices one outcome:
				{:else}
					No price beats fair value here.
				{/if}
			</p>
			{#if f.bestValue}
				<div class="mt-4 max-w-md"><PickTicket pick={f.bestValue} /></div>
			{/if}
			<a href="/match?id={f.fixtureId}" class="btn-ghost mt-4 text-sm">📊 See why, plus every market</a>
		</div>
		<div class="order-1 md:order-2">
			{#key `${f.fixtureId}:${theme.resolved}`}
				<ScoreSurface3D matrix={f.matrix} homeTeam={f.homeTeam} awayTeam={f.awayTeam} height={innerWidth < 768 ? 300 : 420} />
			{/key}
		</div>
	</div>
</section>
{:else}
	<section class="surface p-6" aria-labelledby="hero-title">
		<div class="flex flex-wrap items-center gap-3"><h1 id="hero-title" class="text-3xl font-bold text-chalk">📊 The board</h1><DataBadge /></div>
		<p class="mt-2 text-haze">{feed.status === 'checking' || feed.status === 'downloading' ? 'Loading the latest games…' : 'No games with a score grid to feature right now. Everything priced is below.'}</p>
	</section>
{/if}

<!-- Strongest edges on the board -->
<section class="mt-10" aria-labelledby="picks-title">
	<div class="flex items-baseline justify-between">
		<h2 id="picks-title" class="text-2xl font-bold text-chalk">🔥 Strongest edges</h2>
		<a href="/value-bets" class="text-sm font-semibold text-pop hover:underline">All {app.valueBets.length} value bets</a>
	</div>
	<div class="scrollbar-none -mx-4 mt-4 flex snap-x gap-3 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0">
		{#each picks as pick (pick.id)}
			<div class="w-[85%] shrink-0 snap-start md:w-auto"><PickTicket {pick} showMatch /></div>
		{/each}
	</div>
</section>

<!-- Fixtures -->
<section class="mt-10" aria-labelledby="fixtures-title">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<h2 id="fixtures-title" class="text-2xl font-bold text-chalk">📅 Fixtures</h2>
		<div class="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
			<div class="flex w-max rounded-full bg-deep p-1 text-sm ring-1 ring-line" role="tablist" aria-label="Filter by sport">
				{#each filters as [value, label] (value)}
					<button
						role="tab"
						aria-selected={sport === value}
						onclick={() => (sport = value as typeof sport)}
						class="whitespace-nowrap rounded-full px-3.5 py-1.5 font-medium transition-colors {sport === value ? 'bg-raised text-chalk ring-1 ring-pop' : 'text-haze hover:text-chalk'}"
					>
						{label}
					</button>
				{/each}
			</div>
		</div>
	</div>
	<div class="mt-4 grid gap-4 md:grid-cols-2">
		{#each fixtures as p (p.fixtureId)}
			<FixtureCard {p} />
		{/each}
	</div>
	<p class="mt-6 text-sm text-haze">
		{feed.mode === 'live' ? '📡 Fixtures and prices from the live feed' : '🧪 Prices come from a sample feed'}; every probability, fair price and stake is computed on your device.
		Model weight {Math.round(app.settings.modelWeight * 100)}% vs market, adjustable in <a href="/settings" class="text-chalk underline underline-offset-4">Settings</a>.
	</p>
</section>
